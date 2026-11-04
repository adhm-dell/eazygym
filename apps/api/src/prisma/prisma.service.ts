import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@gym/db";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Database connection initialized on startup
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Helper to run money movements and multiple operations inside one atomic transaction.
   */
  async runInTransaction<T>(
    fn: (tx: PrismaClient) => Promise<T>,
    options?: Parameters<PrismaClient["$transaction"]>[1]
  ): Promise<T> {
    return this.$transaction(fn as any, options) as Promise<T>;
  }
}
