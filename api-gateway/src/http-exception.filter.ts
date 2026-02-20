/**
 * HTTP EXCEPTION FILTER - Globalni filter za formatiranje gresaka
 *
 * Kada servis baci gresku (throw new BadRequestException(...)),
 * NestJS je uhvati i prosledjuje ovom filteru koji formatira odgovor.
 *
 * Ovaj filter osigurava da SVE greske imaju isti format:
 * {
 *   statusCode: 400,
 *   message: "Opis greske",
 *   error: "Bad Request",
 *   timestamp: "2026-02-20T...",
 *   path: "/api/bookings"
 * }
 *
 * Bez ovog filtera, razlicite greske bi imale razlicite formate,
 * sto otezava obradu na frontend-u.
 */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

// @Catch(HttpException) - ovaj filter hvata samo HTTP greske (400, 401, 404, 500...)
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception.getStatus();

    // Izvlacimo originalni odgovor greske
    const exceptionResponse = exception.getResponse();
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message || exception.message;

    // Formatiramo odgovor sa svim korisnim informacijama
    const errorResponse = {
      statusCode: status,
      message,
      error: HttpStatus[status], // Tekstualni opis status koda (npr. "BAD_REQUEST")
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Logujemo gresku sa detaljima
    this.logger.warn(
      `${request.method} ${request.url} - ${status} - ${JSON.stringify(message)}`,
    );

    response.status(status).json(errorResponse);
  }
}
