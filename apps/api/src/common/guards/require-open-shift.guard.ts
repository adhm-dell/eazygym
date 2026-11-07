import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRE_OPEN_SHIFT_KEY } from "../decorators/require-open-shift.decorator";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RequireOpenShiftGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireOpenShift = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_OPEN_SHIFT_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requireOpenShift) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.gymId || !user.sub) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "NO_OPEN_SHIFT",
        message: "No user context found for shift requirement",
      });
    }

    const shift = await this.prisma.shift.findFirst({
      where: {
        gymId: user.gymId,
        staffId: user.sub,
        status: "OPEN",
      },
    });

    if (!shift) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "NO_OPEN_SHIFT",
        message: "An active open shift is required to perform this action",
      });
    }

    request.shift = shift;
    return true;
  }
}
