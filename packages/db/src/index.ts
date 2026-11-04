import { PrismaClient, Prisma } from "@prisma/client";

export * from "@prisma/client";
export { PrismaClient, Prisma };

/**
 * Converts a database Decimal(12,2) (or string/number) to integer piasters (minor units).
 */
export function decimalToPiasters(val: Prisma.Decimal | number | string | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return Math.round(Number(val) * 100);
}

/**
 * Converts integer piasters (minor units) to a Prisma Decimal(12,2) string/instance.
 */
export function piastersToDecimal(piasters: number): Prisma.Decimal {
  return new Prisma.Decimal((piasters / 100).toFixed(2));
}

let prismaInstance: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

