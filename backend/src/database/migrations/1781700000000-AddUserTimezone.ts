import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTimezone1781700000000 implements MigrationInterface {
  name = 'AddUserTimezone1781700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "timezone" character varying(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "timezone"`);
  }
}
