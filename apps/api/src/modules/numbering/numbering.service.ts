import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class NumberingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a unique 6-digit numeric member code (100000..999999) for a given gym.
   */
  async generateMemberCode(gymId: string): Promise<string> {
    for (let attempts = 0; attempts < 20; attempts++) {
      // 100000 to 999999
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const existing = await this.prisma.member.findUnique({
        where: {
          gymId_code: {
            gymId,
            code,
          },
        },
        select: { id: true },
      });
      if (!existing) {
        return code;
      }
    }

    // Fallback: sequential search based on highest numeric code
    const latest = await this.prisma.member.findFirst({
      where: { gymId },
      orderBy: { createdAt: "desc" },
      select: { code: true },
    });
    const nextNum = latest && /^\d+$/.test(latest.code) ? parseInt(latest.code, 10) + 1 : 100001;
    return nextNum.toString();
  }

  /**
   * Generates a sequential invoice number for a given gym.
   * e.g. "INV-2026-0001" or running counter.
   */
  async getNextInvoiceNumber(gymId: string): Promise<string> {
    const count = await this.prisma.invoice.count({
      where: { gymId },
    });
    const year = new Date().getFullYear();
    const nextSeq = (count + 1).toString().padStart(5, "0");
    return `INV-${year}-${nextSeq}`;
  }
}

