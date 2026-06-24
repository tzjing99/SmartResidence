import type { RequestWithContext } from '@/common/types/request-context';
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
import { MulterError } from 'multer';

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
    } else if (exception instanceof MulterError) {
      // Multipart upload failures (size/file-count) should be 4xx, not 500.
      error = 'UploadError';
      if (exception.code === 'LIMIT_FILE_SIZE') {
        status = HttpStatus.PAYLOAD_TOO_LARGE;
        message = 'File is too large.';
      } else if (
        exception.code === 'LIMIT_FILE_COUNT' ||
        exception.code === 'LIMIT_UNEXPECTED_FILE'
      ) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Too many files in this upload.';
      } else {
        status = HttpStatus.BAD_REQUEST;
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
