import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invite } from '@/modules/invites/entities/invite.entity';
import { InvitesController } from '@/modules/invites/invites.controller';
import { InvitesService } from '@/modules/invites/invites.service';
import { RolesModule } from '@/modules/roles/roles.module';
import { User } from '@/modules/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invite, User]), RolesModule],
  controllers: [InvitesController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
