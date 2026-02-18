import {
  Controller,
  All,
  Get,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import axios from 'axios';

@Controller()
export class AppController {
  private serviceUrls: Record<string, string>;

  constructor(private configService: ConfigService) {
    this.serviceUrls = {
      users: configService.get('USER_SERVICE_URL', 'http://localhost:3001'),
      rooms: configService.get('ROOM_SERVICE_URL', 'http://localhost:3002'),
      bookings: configService.get('BOOKING_SERVICE_URL', 'http://localhost:3003'),
      notifications: configService.get('NOTIFICATION_SERVICE_URL', 'http://localhost:3004'),
    };
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: Object.keys(this.serviceUrls),
    };
  }

  // Public routes (no auth needed)
  @All('api/users/register')
  async proxyRegister(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'users', '/users/register');
  }

  @All('api/users/login')
  async proxyLogin(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'users', '/users/login');
  }

  @All('api/rooms')
  async proxyRooms(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'rooms', '/rooms');
  }

  @All('api/rooms/*path')
  async proxyRoomsById(@Req() req, @Res() res) {
    const path = req.url.replace('/api/rooms', '/rooms');
    return this.proxyRequest(req, res, 'rooms', path);
  }

  // Protected routes (auth required)
  @UseGuards(JwtAuthGuard)
  @All('api/users/profile')
  async proxyProfile(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'users', '/users/profile');
  }

  @UseGuards(JwtAuthGuard)
  @All('api/bookings')
  async proxyBookings(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'bookings', '/bookings', req.user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @All('api/bookings/*path')
  async proxyBookingsById(@Req() req, @Res() res) {
    const path = req.url.replace('/api/bookings', '/bookings');
    return this.proxyRequest(req, res, 'bookings', path, req.user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @All('api/notifications')
  async proxyNotifications(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'notifications', '/notifications', req.user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @All('api/notifications/*path')
  async proxyNotificationsById(@Req() req, @Res() res) {
    const path = req.url.replace('/api/notifications', '/notifications');
    return this.proxyRequest(req, res, 'notifications', path, req.user?.id);
  }

  private async proxyRequest(
    req: any,
    res: any,
    service: string,
    path: string,
    userId?: string,
  ) {
    const url = `${this.serviceUrls[service]}${path}`;
    const headers: Record<string, string> = {
      'content-type': req.headers['content-type'] || 'application/json',
    };
    if (userId) {
      headers['x-user-id'] = userId;
    }
    if (req.headers.authorization) {
      headers['authorization'] = req.headers.authorization;
    }

    try {
      const response = await axios({
        method: req.method,
        url,
        data: req.body,
        headers,
        params: req.query,
      });
      res.status(response.status).json(response.data);
    } catch (error) {
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(503).json({
          statusCode: 503,
          message: `Service ${service} is unavailable`,
        });
      }
    }
  }
}
