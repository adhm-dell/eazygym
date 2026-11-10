import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { NO_GYM_CONTEXT_KEY } from "../decorators/no-gym-context.decorator";

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

    const noGymContext = this.reflector.getAllAndOverride<boolean>(NO_GYM_CONTEXT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      return true;
    }

    const headerGymId = req.headers["x-gym-id"];
    const resolvedGymId = (typeof headerGymId === "string" ? headerGymId : user.gymId) || null;
    req.gymId = resolvedGymId;

    if (noGymContext) {
      return true;
    }

    // Safety fallback for platform administration and user introspection endpoints
    const targetClass = context.getClass();
    const className = targetClass?.name;
    if (
      className === "SuperAdminGymsController" ||
      className === "MeController" ||
      className === "AppController" ||
      className === "AuthController"
    ) {
      return true;
    }

    if (user.role === "SUPER_ADMIN") {
      if (!resolvedGymId) {
        throw new BadRequestException({
          statusCode: 400,
          code: "MISSING_GYM_CONTEXT",
          message: "No gym associated with this account. Platform SuperAdmin must access /platform or specify x-gym-id header.",
        });
      }
      return true;
    }

    if (!resolvedGymId) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: "MISSING_GYM_CONTEXT",
        message: "No gym associated with this account",
      });
    }

    return true;
  }
}
