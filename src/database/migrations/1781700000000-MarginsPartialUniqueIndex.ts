import { MigrationInterface, QueryRunner } from 'typeorm';

export class MarginsPartialUniqueIndex1781700000000
  implements MigrationInterface
{
  name = 'MarginsPartialUniqueIndex1781700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Borra el unique index normal generado por TypeORM (nombre auto-generado desconocido)
    await queryRunner.query(`
      DO $$
      DECLARE idx_name text;
      BEGIN
        SELECT indexname INTO idx_name
        FROM pg_indexes
        WHERE tablename = 'margins'
          AND indexdef LIKE '%UNIQUE%'
          AND indexdef LIKE '%name%'
          AND indexdef NOT LIKE '%WHERE%';
        IF idx_name IS NOT NULL THEN
          EXECUTE 'DROP INDEX "' || idx_name || '"';
        END IF;
      END $$
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_margins_name_active" ON "margins" ("name") WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_margins_name_active"`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_margins_name_unique" ON "margins" ("name")`,
    );
  }
}
