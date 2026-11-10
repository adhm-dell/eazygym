/**
 * packages/db/prisma/bootstrap.ts
 * Creates the MINIMUM needed to start a real trial: one gym + one GYM_ADMIN (+ optional SUPER_ADMIN).
 * No members, plans, invoices, shifts or notifications. Idempotent (safe to run twice).
 *
 * Required env: BOOTSTRAP_GYM_NAME, BOOTSTRAP_GYM_SLUG, BOOTSTRAP_ADMIN_NAME,
 *               BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD (>= 10 chars)
 * Optional env: BOOTSTRAP_TIMEZONE (default Africa/Cairo),
 *               BOOTSTRAP_SUPER_ADMIN_EMAIL + BOOTSTRAP_SUPER_ADMIN_PASSWORD
 */
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

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

const WEAK = new Set(["123456", "12345678", "password", "admin123", "1234567890"]);

function need(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

function strongPassword(name: string): string {
  const v = need(name);
  if (v.length < 10 || WEAK.has(v.toLowerCase())) {
    throw new Error(`${name} must be at least 10 characters and not a common password`);
  }
  return v;
}

export async function bootstrap(prisma: PrismaClient) {
  const gymName = need("BOOTSTRAP_GYM_NAME");
  const slug = need("BOOTSTRAP_GYM_SLUG").toLowerCase();
  const adminName = need("BOOTSTRAP_ADMIN_NAME");
  const adminEmail = need("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const adminPassword = strongPassword("BOOTSTRAP_ADMIN_PASSWORD");
  const timezone = process.env.BOOTSTRAP_TIMEZONE?.trim() || "Africa/Cairo";

  const gym = await prisma.gym.upsert({
    where: { slug },
    update: {},
    create: { name: gymName, slug, timezone, currency: "EGP" }, // every other setting uses the schema defaults
  });

  await prisma.staff.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "GYM_ADMIN",
      isActive: true,
    },
    create: {
      gymId: gym.id,
      name: adminName,
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "GYM_ADMIN",
    },
  });

  const superEmail = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (superEmail) {
    const superPassword = strongPassword("BOOTSTRAP_SUPER_ADMIN_PASSWORD");
    await prisma.staff.upsert({
      where: { email: superEmail },
      update: {
        passwordHash: await bcrypt.hash(superPassword, 12),
        role: "SUPER_ADMIN",
        isActive: true,
      },
      create: {
        gymId: null,
        name: "Platform Admin",
        email: superEmail,
        passwordHash: await bcrypt.hash(superPassword, 12),
        role: "SUPER_ADMIN",
      },
    });
  }

  return { gymId: gym.id, slug, adminEmail };
}

// run directly: `pnpm --filter @gym/db db:bootstrap`
if (process.argv[1] && /bootstrap\.(ts|js)$/.test(process.argv[1])) {
  const prisma = new PrismaClient();
  bootstrap(prisma)
    .then((r) => console.log(`Bootstrap done. Gym "${r.slug}" (${r.gymId}), admin ${r.adminEmail}`))
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

