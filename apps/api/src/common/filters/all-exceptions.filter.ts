import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import type { RequestWithContext } from '@/common/types/request-context';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  requestId?: string;
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithContext>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'InternalServerError';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const obj = body as Record<string, unknown>;
        message = (obj.message as string) ?? message;
        error = (obj.error as string) ?? exception.name;
        details = obj.details;
      }
      error = error ?? exception.name;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          error = 'UniqueConstraintViolation';
          message = 'A record with these values already exists.';
          details = { target: exception.meta?.target };
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          error = 'NotFound';
          message = 'Record not found.';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          error = 'PrismaError';
          message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    const body: ErrorBody = {
      statusCode: status,
      error,
      message,
      requestId: request.ctx?.requestId,
      details,
    };

    if (status >= 500) {
      this.logger.error(
        { requestId: request.ctx?.requestId, exception },
        `${request.method} ${request.url} -> ${status}`,
      );
    }

    response.status(status).json(body);
  }
}
