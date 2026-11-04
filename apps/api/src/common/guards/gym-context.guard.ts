import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class GymContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const gymId = req.headers["x-gym-id"] || req.user?.gymId || "gym_cairo_01";
    if (!gymId) {
      throw new UnauthorizedException("Missing Gym Context (gymId)");
    }
    req.gymId = gymId;
    return true;
  }
}

