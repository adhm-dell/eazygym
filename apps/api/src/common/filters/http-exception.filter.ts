import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_SERVER_ERROR";
    let message = "Internal server error";
    let details: any = undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        const obj = res as Record<string, any>;
        message = obj.message || message;
        code = obj.code || this.defaultCodeForStatus(statusCode);
        details = obj.details;
      }
      if (!code || code === "INTERNAL_SERVER_ERROR") {
        code = this.defaultCodeForStatus(statusCode);
      }
    } else if (this.isPrismaError(exception)) {
      const prismaErr = exception as any;
      if (prismaErr.code === "P2002") {
        statusCode = HttpStatus.CONFLICT;
        const targets = prismaErr.meta?.target || [];
        if (Array.isArray(targets) && targets.some((t: string) => t.includes("phone"))) {
          code = "PHONE_EXISTS";
          message = "Phone number already exists in this gym";
        } else {
          code = "CONFLICT";
          message = "Unique constraint violation";
        }
      } else if (prismaErr.code === "P2025") {
        statusCode = HttpStatus.NOT_FOUND;
        code = "NOT_FOUND";
        message = "Requested record was not found";
      } else {
        statusCode = HttpStatus.BAD_REQUEST;
        code = "DATABASE_ERROR";
        message = prismaErr.message || "Database error";
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      message = exception.message;
    }

    const payload: { statusCode: number; code: string; message: string; details?: any } = {
      statusCode,
      code,
      message,
    };

    if (details !== undefined) {
      payload.details = details;
    }

    response.status(statusCode).json(payload);
  }

  private defaultCodeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return "BAD_REQUEST";
      case HttpStatus.UNAUTHORIZED:
        return "UNAUTHORIZED";
      case HttpStatus.FORBIDDEN:
        return "FORBIDDEN";
      case HttpStatus.NOT_FOUND:
        return "NOT_FOUND";
      case HttpStatus.CONFLICT:
        return "CONFLICT";
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return "UNPROCESSABLE_ENTITY";
      default:
        return "INTERNAL_SERVER_ERROR";
    }
  }

  private isPrismaError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as any).code === "string" &&
      (error as any).code.startsWith("P")
    );
  }
}
