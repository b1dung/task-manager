import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFilterIndexes1780800000000 implements MigrationInterface {
  name = 'AddFilterIndexes1780800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tasks — frequently filtered columns
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_assignee_id" ON "tasks" ("assignee_id") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_reporter_id" ON "tasks" ("reporter_id") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_priority" ON "tasks" ("priority") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_status" ON "tasks" ("status") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_type" ON "tasks" ("type") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_due_date" ON "tasks" ("due_date") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_sprint_id" ON "tasks" ("sprint_id") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_column_id_position" ON "tasks" ("column_id", "position") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_project_created" ON "tasks" ("project_id", "created_at") WHERE deleted_at IS NULL`,
    );

    // Activity logs — frequently filtered
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_activity_logs_project_created" ON "activity_logs" ("project_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_activity_logs_user_id" ON "activity_logs" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_activity_logs_entity" ON "activity_logs" ("entity_type", "entity_id")`,
    );

    // Notifications
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_recipient_read" ON "notifications" ("recipient_id", "read_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_assignee_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_reporter_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_priority"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_due_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_sprint_id"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tasks_column_id_position"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_project_created"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_activity_logs_project_created"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_activity_logs_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_activity_logs_entity"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_recipient_read"`,
    );
  }
}
