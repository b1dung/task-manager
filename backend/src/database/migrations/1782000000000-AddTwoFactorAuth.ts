import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTwoFactorAuth1782000000000 implements MigrationInterface {
  name = 'AddTwoFactorAuth1782000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean NOT NULL DEFAULT false',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_secret" varchar',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "two_factor_secret"',
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "two_factor_enabled"',
    );
  }
}
