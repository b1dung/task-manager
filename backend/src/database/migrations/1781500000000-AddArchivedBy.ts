import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArchivedBy1781500000000 implements MigrationInterface {
  name = 'AddArchivedBy1781500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "archived_by" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "archived_by" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN IF EXISTS "archived_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP COLUMN IF EXISTS "archived_by"`,
    );
  }
}
