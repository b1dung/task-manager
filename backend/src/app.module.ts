import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ActivityModule } from '@/modules/activity/activity.module';
import { ArchivedModule } from '@/modules/archived/archived.module';
import { AttachmentsModule } from '@/modules/attachments/attachments.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { ColumnsModule } from '@/modules/columns/columns.module';
import { CommentsModule } from '@/modules/comments/comments.module';
import { ExportModule } from '@/modules/export/export.module';
import { InvitesModule } from '@/modules/invites/invites.module';
import { LabelsModule } from '@/modules/labels/labels.module';
import { MembersModule } from '@/modules/members/members.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { ProjectsModule } from '@/modules/projects/projects.module';
import { ReportsModule } from '@/modules/reports/reports.module';
import { RolesModule } from '@/modules/roles/roles.module';
import { SprintsModule } from '@/modules/sprints/sprints.module';
import { TasksModule } from '@/modules/tasks/tasks.module';
import { UsersModule } from '@/modules/users/users.module';
import { WebsocketModule } from '@/modules/websocket/websocket.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'taskboard'),
        password: config.get<string>('DB_PASSWORD', 'taskboard'),
        database: config.get<string>('DB_NAME', 'taskboard'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
        entities: [join(__dirname, '**', '*.entity.{ts,js}')],
        migrations: [join(__dirname, 'database', 'migrations', '*.{ts,js}')],
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads', 'avatars'),
      serveRoot: '/uploads/avatars',
    }),
    UsersModule,
    AuthModule,
    ProjectsModule,
    MembersModule,
    ColumnsModule,
    LabelsModule,
    SprintsModule,
    ReportsModule,
    RolesModule,
    TasksModule,
    CommentsModule,
    AttachmentsModule,
    ActivityModule,
    NotificationsModule,
    ExportModule,
    InvitesModule,
    ArchivedModule,
    WebsocketModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
