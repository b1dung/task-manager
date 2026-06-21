import { MigrationInterface, QueryRunner } from 'typeorm';

export class DefaultLanguageToEnglish1781800000000 implements MigrationInterface {
  name = 'DefaultLanguageToEnglish1781800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "language" SET DEFAULT 'en'`,
    );
    // Existing preferences are intentionally preserved; only new accounts use English.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "language" SET DEFAULT 'vi'`,
    );
  }
}
