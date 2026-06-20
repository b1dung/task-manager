import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';

export interface JwtRefreshPayload extends JwtPayload {
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromBodyField('refreshToken'),
        (req: Request) => {
          const cookie = req.headers.cookie
            ?.split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith('refresh_token='));
          return cookie
            ? decodeURIComponent(cookie.slice('refresh_token='.length))
            : null;
        },
      ]),
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKey: config.get<string>(
        'JWT_REFRESH_SECRET',
        'dev_refresh_secret',
      ),
    });
  }

  validate(req: Request, payload: JwtPayload): JwtRefreshPayload {
    const bodyToken = (req.body as { refreshToken?: string }).refreshToken;
    const cookie = req.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('refresh_token='));
    const refreshToken =
      bodyToken ??
      (cookie ? decodeURIComponent(cookie.slice('refresh_token='.length)) : '');
    return { ...payload, refreshToken };
  }
}
