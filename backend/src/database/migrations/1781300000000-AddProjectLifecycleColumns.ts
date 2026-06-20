import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectLifecycleColumns1781300000000
  implements MigrationInterface
{
  name = 'AddProjectLifecycleColumns1781300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects"
         ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMP WITH TIME ZONE,
         ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP WITH TIME ZONE,
         ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects"
         DROP COLUMN IF EXISTS "deleted_at",
         DROP COLUMN IF EXISTS "archived_at",
         DROP COLUMN IF EXISTS "deadline"`,
    );
  }
}
