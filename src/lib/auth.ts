import { randomBytes } from "crypto";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  clearLoginAttempts,
  clientIpKey,
  isLoginRateLimited,
  loginThrottleDelayMs,
  registerFailedLogin,
} from "@/lib/login-rate-limit";

const BCRYPT_COST = 12;

// Hash "civetta" contro cui confrontare la password quando l'email non esiste
// nel DB. Senza, il ramo "utente inesistente" tornava in <1ms mentre quello
// "utente esistente, password sbagliata" pagava i ~200ms di bcrypt: misurando i
// tempi di risposta si capiva quale email corrisponde a un account reale.
// Generato pigramente da byte casuali — nessuna password lo soddisfa mai, serve
// solo a bruciare lo stesso tempo di CPU dell'altro ramo.
let dummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHash ??= bcrypt.hash(randomBytes(32).toString("hex"), BCRYPT_COST);
  return dummyHash;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    // Il default di Auth.js è 30 giorni. Le sessioni sono JWT stateless: il
    // token non viene mai ri-verificato contro il DB, quindi un cambio password
    // non invalida le sessioni già aperte altrove (limite noto, vedi
    // PROJECT.md). Accorciare la finestra è il modo economico di limitarne
    // l'esposizione senza introdurre sessioni lato DB.
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: { signIn: "/login" },
  // Self-hosted dietro un reverse proxy (SWAG): senza questo, Auth.js rifiuta
  // l'Host header inoltrato dal proxy con "UntrustedHost".
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const emailKey = email.trim().toLowerCase();
        const ipKey = clientIpKey(request);

        // Unico blocco duro, e vale per IP: un attaccante che conosce l'email
        // dell'admin non può più impedirgli di entrare dalla propria rete.
        if (isLoginRateLimited(ipKey)) {
          // Messaggio distinguibile in src/app/login/actions.ts, per mostrare
          // "riprova più tardi" invece del generico "credenziali non valide".
          throw new CredentialsSignin("rate-limited");
        }

        // Il ritardo si paga *prima* di rispondere, sia in caso di successo che
        // di fallimento: se scattasse solo sui fallimenti diventerebbe a sua
        // volta un oracolo sulla correttezza della password.
        const delay = loginThrottleDelayMs(emailKey);
        if (delay > 0) await sleep(delay);

        const user = await prisma.user.findUnique({ where: { email } });
        const valid = await bcrypt.compare(
          password,
          user?.passwordHash ?? (await getDummyHash())
        );

        if (!user || !valid) {
          registerFailedLogin(ipKey, emailKey);
          return null;
        }

        clearLoginAttempts(ipKey, emailKey);
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
