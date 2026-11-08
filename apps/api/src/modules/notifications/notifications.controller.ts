import { Controller, Get, Post, Param, Sse, MessageEvent, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Observable } from "rxjs";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@ApiTags("Notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Sse("stream")
  @ApiOperation({ summary: "Live notification stream over SSE" })
  stream(@CurrentUser() user: any): Observable<MessageEvent> {
    return this.notificationsService.getStream(user.gymId, user.sub, user.role);
  }

  @Get()
  @ApiOperation({ summary: "Get live notifications and unread count" })
  async getNotifications(@CurrentUser() user: any) {
    return this.notificationsService.getNotifications(
      user.gymId,
      user.sub,
      user.role
    );
  }

  @Post(":id/read")
  @ApiOperation({ summary: "Mark a notification as read" })
  async markRead(@CurrentUser() user: any, @Param("id") id: string) {
    return this.notificationsService.markRead(user.gymId, user.sub, id);
  }

  @Post("read-all")
  @ApiOperation({ summary: "Mark all notifications as read" })
  async markAllRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllRead(user.gymId, user.sub, user.role);
  }
}
