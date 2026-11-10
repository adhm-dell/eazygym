import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Optional,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class GymContextGuard implements CanActivate {
  private reflector: Reflector;

  constructor(@Optional() reflector?: Reflector) {
    this.reflector = reflector || new Reflector();
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      return true;
    }

    if (user.role === "SUPER_ADMIN") {
      const headerGymId = req.headers["x-gym-id"];
      const resolvedGymId = (typeof headerGymId === "string" ? headerGymId : user.gymId) || null;
      if (!resolvedGymId) {
        throw new UnauthorizedException({
          statusCode: 401,
          code: "MISSING_GYM_CONTEXT",
          message: "No gym associated with this account. Platform SuperAdmin must access /platform or specify x-gym-id header.",
        });
      }
      req.gymId = resolvedGymId;
      return true;
    }

    if (!user.gymId) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: "MISSING_GYM_CONTEXT",
        message: "No gym associated with this account",
      });
    }

    req.gymId = user.gymId;
    return true;
  }
}
