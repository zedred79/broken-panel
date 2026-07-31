import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  clearLoginAttempts,
  isLoginRateLimited,
  registerFailedLogin,
} from "@/lib/login-rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
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
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const rateLimitKey = email.trim().toLowerCase();
        if (isLoginRateLimited(rateLimitKey)) {
          // Messaggio distinguibile in src/app/login/actions.ts, per mostrare
          // "riprova più tardi" invece del generico "credenziali non valide".
          throw new CredentialsSignin("rate-limited");
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          registerFailedLogin(rateLimitKey);
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          registerFailedLogin(rateLimitKey);
          return null;
        }

        clearLoginAttempts(rateLimitKey);
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
