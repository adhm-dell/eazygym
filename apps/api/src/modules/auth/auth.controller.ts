import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Response, Request } from "express";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { Public } from "../../common/decorators/public.decorator";
import { NoGymContext } from "../../common/decorators/no-gym-context.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  LoginRequestSchema,
  MemberLoginRequestSchema,
  type LoginRequest,
  type MemberLoginRequest,
} from "@gym/contracts";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("switch")
  @ApiOperation({ summary: "Switch user in development/portal and return access token" })
  async switchUser(
    @Body() body: { email?: string; staffId?: string; memberPhone?: string; memberId?: string; memberCode?: string },
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.switchUser(
      body.email,
      body.staffId,
      body.memberPhone,
      body.memberId,
      body.memberCode
    );
    res.cookie("refresh_token", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600 * 1000,
    });
    return {
      accessToken: result.accessToken,
      user: result.user,
      gym: result.gym,
    };
  }

  @Public()
  @Post("login")
  @ApiOperation({ summary: "Staff login with email and password" })
  async loginStaff(
    @Body(new ZodValidationPipe(LoginRequestSchema)) dto: LoginRequest,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.loginStaff(dto);

    res.cookie("refresh_token", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600 * 1000,
    });

    return {
      accessToken: result.accessToken,
      user: result.user,
      gym: result.gym,
    };
  }

  @Public()
  @Post("member/login")
  @ApiOperation({ summary: "Member login with phone and password" })
  async loginMember(
    @Body(new ZodValidationPipe(MemberLoginRequestSchema)) dto: MemberLoginRequest,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.loginMember(dto);

    res.cookie("refresh_token", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600 * 1000,
    });

    return {
      accessToken: result.accessToken,
      member: result.member,
      gym: result.gym,
    };
  }

  @Public()
  @Post("refresh")
  @ApiOperation({ summary: "Rotate refresh token and issue new access token" })
  async refresh(
    @Req() req: Request,
    @Body("refreshToken") bodyToken: string,
    @Res({ passthrough: true }) res: Response
  ) {
    const refreshToken = (req.cookies && req.cookies.refresh_token) || bodyToken;
    if (!refreshToken) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: "UNAUTHORIZED",
        message: "No refresh token provided",
      });
    }

    const result = await this.authService.refreshTokens(refreshToken);

    res.cookie("refresh_token", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600 * 1000,
    });

    return { accessToken: result.accessToken };
  }

  @Public()
  @Post("logout")
  @ApiOperation({ summary: "Logout and revoke refresh token" })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie("refresh_token", { path: "/" });
    return { success: true };
  }
}

@ApiTags("Auth")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@NoGymContext()
@Controller()
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get("me")
  @ApiOperation({ summary: "Get current authenticated user profile and gym settings" })
  async getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.sub || user.id, user.role);
  }

  @Get("auth/me")
  @ApiOperation({ summary: "Get current authenticated user profile (alias)" })
  async getAuthMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.sub || user.id, user.role);
  }
}
