import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { ENV } from "../../config/env";
import type { LoginRequest, MemberLoginRequest } from "@gym/contracts";

interface LockRecord {
  attempts: number;
  lockedUntil?: number;
}

@Injectable()
export class AuthService {
  private loginAttempts = new Map<string, LockRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  /**
   * Helper to verify password using bcrypt, with fallback to plain comparison for mock seeds.
   */
  async verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
    if (!hash) return false;
    try {
      const match = await bcrypt.compare(plain, hash);
      if (match) return true;
    } catch {
      // not a valid bcrypt hash, try plain comparison
    }
    return plain === hash;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  private checkBruteForce(identifier: string) {
    const key = identifier.toLowerCase().trim();
    const record = this.loginAttempts.get(key);
    const now = Date.now();

    if (record && record.lockedUntil && record.lockedUntil > now) {
      const remainingSecs = Math.ceil((record.lockedUntil - now) / 1000);
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "ACCOUNT_LOCKED",
        message: `Account is temporarily locked. Try again in ${remainingSecs} seconds.`,
      });
    }
  }

  private recordFailedAttempt(identifier: string) {
    const key = identifier.toLowerCase().trim();
    const now = Date.now();
    const record = this.loginAttempts.get(key) || { attempts: 0 };
    record.attempts += 1;

    if (record.attempts >= 5) {
      record.lockedUntil = now + 15 * 60 * 1000; // 15 mins lock
    }
    this.loginAttempts.set(key, record);
  }

  private clearFailedAttempts(identifier: string) {
    this.loginAttempts.delete(identifier.toLowerCase().trim());
  }

  async switchUser(email?: string, staffId?: string) {
    const where = staffId
      ? { id: staffId }
      : email
      ? { email: email.toLowerCase() }
      : null;

    if (!where) {
      throw new BadRequestException("Must provide email or staffId");
    }

    const staff = await this.prisma.staff.findFirst({
      where: { ...where, isActive: true },
      include: { gym: true },
    });

    if (!staff) {
      throw new NotFoundException("Staff member not found");
    }

    const accessToken = this.jwtService.sign(
      {
        sub: staff.id,
        gymId: staff.gymId,
        role: staff.role,
        email: staff.email,
        name: staff.name,
      },
      {
        secret: ENV.JWT_SECRET,
        expiresIn: "7d",
      }
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: staff.id,
        type: "refresh",
      },
      {
        secret: ENV.JWT_REFRESH_SECRET,
        expiresIn: "7d",
      }
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: staff.id,
        gymId: staff.gymId,
        name: staff.name,
        email: staff.email,
        role: staff.role,
      },
      gym: staff.gym,
    };
  }

  async loginStaff(dto: LoginRequest) {
    this.checkBruteForce(dto.email);

    const staff = await this.prisma.staff.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { gym: true },
    });

    if (!staff || !staff.isActive) {
      this.recordFailedAttempt(dto.email);
      this.checkBruteForce(dto.email);
      throw new UnauthorizedException({
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }

    const isValid = await this.verifyPassword(dto.password, staff.passwordHash);
    if (!isValid) {
      this.recordFailedAttempt(dto.email);
      this.checkBruteForce(dto.email);
      throw new UnauthorizedException({
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }

    this.clearFailedAttempts(dto.email);

    await this.prisma.staff.update({
      where: { id: staff.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = this.jwtService.sign(
      {
        sub: staff.id,
        gymId: staff.gymId,
        role: staff.role,
        email: staff.email,
        name: staff.name,
      },
      {
        secret: ENV.JWT_SECRET,
        expiresIn: "15m",
      }
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: staff.id,
        type: "refresh",
      },
      {
        secret: ENV.JWT_REFRESH_SECRET,
        expiresIn: "7d",
      }
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: staff.id,
        gymId: staff.gymId,
        name: staff.name,
        email: staff.email,
        role: staff.role,
      },
      gym: staff.gym,
    };
  }

  async loginMember(dto: MemberLoginRequest) {
    this.checkBruteForce(dto.phone);

    const member = await this.prisma.member.findFirst({
      where: { phone: dto.phone.trim() },
      include: { gym: true },
    });

    if (!member) {
      this.recordFailedAttempt(dto.phone);
      this.checkBruteForce(dto.phone);
      throw new UnauthorizedException({
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid phone or password",
      });
    }

    if (member.isBlocked) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "MEMBER_BLOCKED",
        message: member.blockedReason || "Member account is blocked",
      });
    }

    const isValid = await this.verifyPassword(dto.password, member.passwordHash);
    if (!isValid) {
      this.recordFailedAttempt(dto.phone);
      this.checkBruteForce(dto.phone);
      throw new UnauthorizedException({
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid phone or password",
      });
    }

    this.clearFailedAttempts(dto.phone);

    const accessToken = this.jwtService.sign(
      {
        sub: member.id,
        gymId: member.gymId,
        role: "MEMBER",
        phone: member.phone,
        name: member.name,
      },
      {
        secret: ENV.JWT_SECRET,
        expiresIn: "15m",
      }
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: member.id,
        type: "refresh",
      },
      {
        secret: ENV.JWT_REFRESH_SECRET,
        expiresIn: "7d",
      }
    );

    return {
      accessToken,
      refreshToken,
      member: {
        id: member.id,
        gymId: member.gymId,
        code: member.code,
        name: member.name,
        phone: member.phone,
        role: "MEMBER",
      },
      gym: member.gym,
    };
  }

  async refreshTokens(oldRefreshToken: string) {
    try {
      const payload = this.jwtService.verify(oldRefreshToken, {
        secret: ENV.JWT_REFRESH_SECRET,
      });

      if (payload.type !== "refresh" || !payload.sub) {
        throw new UnauthorizedException({
          statusCode: 401,
          code: "INVALID_TOKEN",
          message: "Invalid refresh token",
        });
      }

      // Check if it's staff
      const staff = await this.prisma.staff.findUnique({
        where: { id: payload.sub },
      });

      if (staff && staff.isActive) {
        const accessToken = this.jwtService.sign(
          {
            sub: staff.id,
            gymId: staff.gymId,
            role: staff.role,
            email: staff.email,
            name: staff.name,
          },
          { secret: ENV.JWT_SECRET, expiresIn: "15m" }
        );
        const refreshToken = this.jwtService.sign(
          { sub: staff.id, type: "refresh" },
          { secret: ENV.JWT_REFRESH_SECRET, expiresIn: "7d" }
        );
        return { accessToken, refreshToken };
      }

      // Check if it's member
      const member = await this.prisma.member.findUnique({
        where: { id: payload.sub },
      });

      if (member && !member.isBlocked) {
        const accessToken = this.jwtService.sign(
          {
            sub: member.id,
            gymId: member.gymId,
            role: "MEMBER",
            phone: member.phone,
            name: member.name,
          },
          { secret: ENV.JWT_SECRET, expiresIn: "15m" }
        );
        const refreshToken = this.jwtService.sign(
          { sub: member.id, type: "refresh" },
          { secret: ENV.JWT_REFRESH_SECRET, expiresIn: "7d" }
        );
        return { accessToken, refreshToken };
      }

      throw new UnauthorizedException({
        statusCode: 401,
        code: "UNAUTHORIZED",
        message: "User account not active",
      });
    } catch (err: any) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: "INVALID_TOKEN",
        message: err.message || "Failed to verify refresh token",
      });
    }
  }

  async getMe(userId: string, role: string) {
    if (role === "MEMBER") {
      const member = await this.prisma.member.findUnique({
        where: { id: userId },
        include: {
          gym: true,
          wallet: true,
        },
      });
      if (!member) {
        throw new NotFoundException({
          statusCode: 404,
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }
      return {
        member: {
          id: member.id,
          gymId: member.gymId,
          code: member.code,
          name: member.name,
          phone: member.phone,
          email: member.email,
          role: "MEMBER",
          walletBalance: member.wallet?.balance ? Number(member.wallet.balance) : 0,
        },
        gym: member.gym,
      };
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: userId },
      include: { gym: true },
    });

    if (!staff) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Staff member not found",
      });
    }

    return {
      user: {
        id: staff.id,
        gymId: staff.gymId,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        isActive: staff.isActive,
      },
      gym: staff.gym,
    };
  }
}
