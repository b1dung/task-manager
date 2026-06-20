import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '@/modules/roles/entities/role.entity';
import { RolesController } from '@/modules/roles/roles.controller';
import { RolesService } from '@/modules/roles/roles.service';
import { User } from '@/modules/users/entities/user.entity';

// Global so the (also global) ProjectMemberGuard can resolve RolesService in
// every module that uses it, without each module importing RolesModule.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Role, User])],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
