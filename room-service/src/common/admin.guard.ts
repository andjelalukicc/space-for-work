import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/** Provera zaglavlja prosleđenog sa API Gateway-a (x-user-role). */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const role = String(req.headers['x-user-role'] ?? '').toLowerCase();
    if (role !== 'admin') {
      throw new ForbiddenException('Admin role required');
    }
    return true;
  }
}
