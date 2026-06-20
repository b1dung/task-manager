import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPreferences1781600000000 implements MigrationInterface {
  name = 'AddUserPreferences1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "language" character varying(5) NOT NULL DEFAULT 'vi'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "appearance" character varying(16) NOT NULL DEFAULT 'midnight'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "appearance"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "language"`);
  }
}
