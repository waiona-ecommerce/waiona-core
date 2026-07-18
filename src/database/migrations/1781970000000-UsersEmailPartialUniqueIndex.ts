import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsersEmailPartialUniqueIndex1781970000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    // Drop unique constraint/index en users.email (no excluye soft-deleted)
    await queryRunner.query(`
      DO $$
      DECLARE cname TEXT;
      BEGIN
        SELECT tc.constraint_name INTO cname
        FROM information_schema.table_constraints tc
        INNER JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = 'users'
          AND tc.constraint_type = 'UNIQUE'
          AND kcu.column_name = 'email'
        LIMIT 1;
        IF cname IS NOT NULL THEN
          EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(cname);
        END IF;
      END $$
    `);

    await queryRunner.query(`
      DO $$
      DECLARE iname TEXT;
      BEGIN
        SELECT indexname INTO iname
        FROM pg_indexes
        WHERE tablename = 'users'
          AND indexdef LIKE '%UNIQUE%'
          AND indexdef LIKE '%email%'
        LIMIT 1;
        IF iname IS NOT NULL THEN
          EXECUTE 'DROP INDEX ' || quote_ident(iname);
        END IF;
      END $$
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_email_active"
       ON "users" ("email")
       WHERE "deletedAt" IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email_active"`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM users
          GROUP BY email HAVING COUNT(*) > 1
        ) THEN
          ALTER TABLE "users" ADD CONSTRAINT "UQ_users_email" UNIQUE ("email");
        ELSE
          RAISE NOTICE 'Constraint único en users.email no restaurado: existen emails duplicados entre registros eliminados y activos.';
        END IF;
      END $$
    `);
  }
}
