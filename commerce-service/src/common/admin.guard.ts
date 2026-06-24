import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

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
