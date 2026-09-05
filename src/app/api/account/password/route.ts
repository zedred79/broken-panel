import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import {
  clearLoginAttempts,
  clientIpKey,
  isLoginRateLimited,
  registerFailedLogin,
} from "@/lib/login-rate-limit";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Stesso contatore del login (src/lib/login-rate-limit.ts): è lo stesso
  // attaccante e la stessa credenziale, non ha senso tenerli separati.
  // Serve al caso in cui una sessione admin sia stata dirottata: senza, chi la
  // controlla può provare `currentPassword` all'infinito, e indovinarla gli
  // permette di cambiare la password e scacciare l'admin legittimo.
  const ipKey = clientIpKey(request);
  if (isLoginRateLimited(ipKey)) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const currentPassword = body?.currentPassword;
  const newPassword = body?.newPassword;

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `The new password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    registerFailedLogin(ipKey, user.email.toLowerCase());
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  // L'admin ha appena dimostrato di conoscere la password: azzera i tentativi
  // accumulati, così qualche errore di battitura prima del cambio non lo lascia
  // bloccato al login successivo.
  clearLoginAttempts(ipKey, user.email.toLowerCase());

  return NextResponse.json({ ok: true });
}
