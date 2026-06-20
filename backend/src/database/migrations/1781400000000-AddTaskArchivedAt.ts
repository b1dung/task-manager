import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskArchivedAt1781400000000 implements MigrationInterface {
  name = 'AddTaskArchivedAt1781400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN IF EXISTS "archived_at"`,
    );
  }
}
