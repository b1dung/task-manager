import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvitesTable1781000000000 implements MigrationInterface {
  name = 'AddInvitesTable1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "invites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "role_id" uuid,
        "token_hash" character varying NOT NULL,
        "invited_by" uuid,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "accepted_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invites_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_invites_role" FOREIGN KEY ("role_id")
          REFERENCES "roles"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_invites_inviter" FOREIGN KEY ("invited_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invites_token_hash" ON "invites" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_invites_email" ON "invites" ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invites_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invites_token_hash"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invites"`);
  }
}
