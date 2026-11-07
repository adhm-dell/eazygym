import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient, Prisma } from "@gym/db";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log("Prisma connected to PostgreSQL database");
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("Prisma disconnected");
  }

  /**
   * Helper to execute operations in a transaction with optional Serializable isolation
   * and retry on serialization conflict (Postgres code 40001 / P2034).
   */
  async runInTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    isolationLevel: Prisma.TransactionIsolationLevel = Prisma.TransactionIsolationLevel.Serializable,
    maxRetries = 3
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await this.$transaction(
          async (tx) => {
            return await fn(tx);
          },
          {
            isolationLevel,
            timeout: 10000,
          }
        );
      } catch (err: any) {
        attempt++;
        const isSerializationFailure =
          err.code === "P2034" ||
          (err.message && err.message.includes("could not serialize access"));
        if (isSerializationFailure && attempt < maxRetries) {
          this.logger.warn(`Serialization conflict on attempt ${attempt}. Retrying...`);
          await new Promise((res) => setTimeout(res, 50 * Math.pow(2, attempt)));
          continue;
        }
        throw err;
      }
    }
    throw new Error("Transaction failed after maximum retries");
  }
}
