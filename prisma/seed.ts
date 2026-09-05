import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./admin-credentials";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL non impostata");
}

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = ADMIN_EMAIL;
  const password = ADMIN_PASSWORD;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Non tocca mai la password di un utente già esistente: questo script
    // gira ad ogni avvio del container (docker-entrypoint.sh), non solo la
    // prima volta. Se aggiornasse sempre passwordHash da ADMIN_PASSWORD,
    // un cambio password fatto da /admin/settings verrebbe cancellato al
    // primo riavvio/ricreazione del container. Per un reset forzato vedi
    // `npm run db:reset-admin-password`.
    console.log(`Admin user già presente: ${existing.email} (password invariata)`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: "Admin" },
  });

  console.log(`Admin user creato: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
