import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from '@/modules/auth/auth.controller';
import { AuthService } from '@/modules/auth/auth.service';
import { RefreshToken } from '@/modules/auth/entities/refresh-token.entity';
import { GoogleStrategy } from '@/modules/auth/strategies/google.strategy';
import { JwtRefreshStrategy } from '@/modules/auth/strategies/jwt-refresh.strategy';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { LocalStrategy } from '@/modules/auth/strategies/local.strategy';
import { InvitesModule } from '@/modules/invites/invites.module';
import { UsersModule } from '@/modules/users/users.module';
import { AccountToken } from '@/modules/auth/entities/account-token.entity';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    TypeOrmModule.forFeature([RefreshToken, AccountToken]),
    UsersModule,
    InvitesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET', 'dev_access_secret'),
        signOptions: {
          expiresIn: config.get<string>(
            'JWT_ACCESS_EXPIRES_IN',
            '15m',
          ) as unknown as number,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    LocalStrategy,
    GoogleStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
