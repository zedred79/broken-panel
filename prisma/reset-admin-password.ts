import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

// A differenza di seed.ts (che gira automaticamente ad ogni avvio del
// container e non tocca mai un utente già esistente), questo script va
// eseguito a mano, apposta, quando serve un reset forzato — es. l'admin ha
// dimenticato la password e non c'è nessun flusso "password dimenticata" in
// UI. Uso: `npm run db:reset-admin-password` (in locale) o
// `docker exec <container> npx tsx prisma/reset-admin-password.ts` (in
// produzione), con ADMIN_EMAIL/ADMIN_PASSWORD impostate nell'ambiente a
// dovere.

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL non impostata");
}

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@brokenpanel.local";
  const password = process.env.ADMIN_PASSWORD ?? "changeme123";

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, name: "Admin" },
  });

  console.log(`Password reimpostata per: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
