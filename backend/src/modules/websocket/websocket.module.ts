import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TaskboardGateway } from '@/modules/websocket/websocket.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { Task } from '@/modules/tasks/entities/task.entity';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectMember, Task]),
    UsersModule,
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
  providers: [TaskboardGateway],
  exports: [TaskboardGateway],
})
export class WebsocketModule {}
