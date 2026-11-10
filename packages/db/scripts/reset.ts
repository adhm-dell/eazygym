/**
 * packages/db/scripts/reset.ts
 * Wipes ALL data (keeps the schema and the _prisma_migrations table), then runs bootstrap.
 *
 *   pnpm --filter @gym/db db:reset -- --confirm=<database-name>
 *
 * Safety:
 *  - needs ALLOW_DB_RESET=true in the environment
 *  - needs --confirm=<exact database name taken from DATABASE_URL>
 *  - refuses a non-local host unless --allow-remote is also passed
 *  - prints row counts first, and a pg_dump reminder
 * Flags: --no-bootstrap (leave the DB completely empty)
 */
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { bootstrap } from "../prisma/bootstrap";

function loadEnvFile() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../.env"),
    path.resolve(__dirname, "../../.env"),
    path.resolve(__dirname, "../../../.env"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}
loadEnvFile();

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.split("=").slice(1).join("=") : "true";
}

export async function resetDatabase(options?: {
  confirm?: string;
  allowRemote?: boolean;
  noBootstrap?: boolean;
}) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (process.env.ALLOW_DB_RESET !== "true") throw new Error("Set ALLOW_DB_RESET=true to allow a reset");

  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, "");
  const host = parsed.hostname;
  const isLocal = ["localhost", "127.0.0.1", "::1", "postgres", "db"].includes(host);

  const confirmArg = options?.confirm ?? arg("confirm");
  const allowRemoteArg = options?.allowRemote ? "true" : arg("allow-remote");
  const noBootstrapArg = options?.noBootstrap ? "true" : arg("no-bootstrap");

  if (confirmArg !== dbName) throw new Error(`Pass --confirm=${dbName} to confirm the database to wipe`);
  if (!isLocal && allowRemoteArg !== "true") {
    throw new Error(`Host "${host}" is not local. Pass --allow-remote if you really mean it.`);
  }

  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tables.length === 0) throw new Error("No tables found. Run the migrations first.");

    console.log(`Database "${dbName}" on ${host}. Tables: ${tables.length}`);
    console.log(`Backup first if needed:  pg_dump "${url.replace(/\?.*$/, "")}" > backup-${Date.now()}.sql`);

    const list = tables.map((t) => `"${t.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    console.log("All data wiped.");

    if (noBootstrapArg === "true") {
      console.log("Left empty (--no-bootstrap). Run `db:bootstrap` before logging in.");
      return { wiped: true, bootstrapped: false, tablesCount: tables.length };
    } else {
      const r = await bootstrap(prisma);
      console.log(`Bootstrapped gym "${r.slug}" with admin ${r.adminEmail}`);
      return { wiped: true, bootstrapped: true, tablesCount: tables.length, bootstrapResult: r };
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await resetDatabase();
}

if (process.argv[1] && /reset\.(ts|js)$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}

