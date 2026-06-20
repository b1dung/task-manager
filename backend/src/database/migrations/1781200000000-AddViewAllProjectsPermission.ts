import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddViewAllProjectsPermission1781200000000
  implements MigrationInterface
{
  name = 'AddViewAllProjectsPermission1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Grant the new super permission to the Owner role on existing installs.
    await queryRunner.query(
      `UPDATE roles
         SET permissions = (permissions::jsonb || '["view_all_projects"]'::jsonb)
       WHERE key = 'owner'
         AND NOT (permissions::jsonb ? 'view_all_projects')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE roles
         SET permissions = (permissions::jsonb - 'view_all_projects')
       WHERE key = 'owner'`,
    );
  }
}
