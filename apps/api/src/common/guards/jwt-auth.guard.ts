import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Optional,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { ENV } from "../../config/env";

export interface AuthenticatedUser {
  id: string;
  gymId: string | null;
  email?: string;
  phone?: string;
  role: string;
  name?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private reflector: Reflector;
  private jwtService: JwtService;

  constructor(
    @Optional() reflector?: Reflector,
    @Optional() jwtService?: JwtService
  ) {
    this.reflector = reflector || new Reflector();
    this.jwtService = jwtService || new JwtService();
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
    const token = this.extractToken(req);

    if (!token) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: "UNAUTHORIZED",
        message: "Missing authentication token",
      });
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: ENV.JWT_SECRET,
      });
      req.user = payload as AuthenticatedUser;
      return true;
    } catch (err: any) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: "INVALID_TOKEN",
        message: err.message || "Invalid or expired token",
      });
    }
  }

  private extractToken(req: any): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }
    if (req.cookies && req.cookies.access_token) {
      return req.cookies.access_token;
    }
    return null;
  }
}
