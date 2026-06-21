import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountSecurity1781900000000 implements MigrationInterface {
  name = 'AddAccountSecurity1781900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMPTZ',
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "account_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" varchar(32) NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "used_at" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_account_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_account_tokens_hash" UNIQUE ("token_hash"),
        CONSTRAINT "FK_account_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_account_tokens_user_type" ON "account_tokens" ("user_id", "type")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_refresh_tokens_hash" ON "refresh_tokens" ("token_hash")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_refresh_tokens_hash"');
    await queryRunner.query('DROP TABLE IF EXISTS "account_tokens"');
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verified_at"',
    );
  }
}
