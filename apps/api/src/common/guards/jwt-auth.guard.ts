import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    // Stub JWT validation: attach mock user if not present
    req.user = req.user || {
      id: "staff_01",
      gymId: "gym_cairo_01",
      role: "RECEPTION",
      email: "reception@powercore.gym",
    };
    return true;
  }
}

