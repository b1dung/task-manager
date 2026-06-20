import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRolesTable1780900000000 implements MigrationInterface {
  name = 'AddRolesTable1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "is_system" boolean NOT NULL DEFAULT false,
        "permissions" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_roles_key" UNIQUE ("key"),
        CONSTRAINT "PK_roles_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_roles_key" ON "roles" ("key")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_roles_key"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
  }
}
