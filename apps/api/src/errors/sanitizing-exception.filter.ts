import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'
import { GENERIC_ERROR_MESSAGE, NON_ERROR_THROWN } from './constants'

/**
 * `sanitized-error-responses` / `hosted-agent-tools`: only a deliberately
 * thrown HttpException's message reaches a caller; anything else gets a
 * generic message. The log keeps the error's name and message only — this
 * service stores no secrets, so its query errors carry none.
 */
@Catch()
export class SanitizingExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SanitizingExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>()
    if (exception instanceof HttpException) {
      res.status(exception.getStatus()).json({
        statusCode: exception.getStatus(),
        message: exception.message,
      })
      return
    }
    this.logger.error(
      exception instanceof Error
        ? `${exception.name}: ${exception.message}`
        : NON_ERROR_THROWN,
    )
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: GENERIC_ERROR_MESSAGE,
    })
  }
}
