import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenTaskConcurrencyAndSearch1781100000000 implements MigrationInterface {
  name = 'HardenTaskConcurrencyAndSearch1781100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS project_task_counters (
        project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        last_number integer NOT NULL DEFAULT 0
      )
    `);
    await queryRunner.query(`
      INSERT INTO project_task_counters(project_id, last_number)
      SELECT project_id, COALESCE(MAX(task_number), 0) FROM tasks GROUP BY project_id
      ON CONFLICT (project_id) DO UPDATE SET last_number = GREATEST(project_task_counters.last_number, EXCLUDED.last_number)
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS IDX_tasks_project_task_number ON tasks(project_id, task_number) WHERE task_number IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_tasks_title_trgm ON tasks USING gin(title gin_trgm_ops) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_tasks_description_trgm ON tasks USING gin(description gin_trgm_ops) WHERE deleted_at IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_tasks_description_trgm`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_tasks_title_trgm`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_tasks_project_task_number`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS project_task_counters`);
  }
}
