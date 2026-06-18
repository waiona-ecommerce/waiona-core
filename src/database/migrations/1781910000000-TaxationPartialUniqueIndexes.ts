import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaxationPartialUniqueIndexes1781910000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Drop la unique constraint simple en tax_types.code (no es soft-delete-aware)
    await queryRunner.query(`
      DO $$
      DECLARE cname TEXT;
      BEGIN
        SELECT tc.constraint_name INTO cname
        FROM information_schema.table_constraints tc
        INNER JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = 'tax_types'
          AND tc.constraint_type = 'UNIQUE'
          AND kcu.column_name = 'code'
        LIMIT 1;
        IF cname IS NOT NULL THEN
          EXECUTE 'ALTER TABLE tax_types DROP CONSTRAINT ' || quote_ident(cname);
        END IF;
      END $$
    `);

    // Drop el unique index simple en product_taxes(product_id, tax_id) (no es soft-delete-aware)
    await queryRunner.query(`
      DO $$
      DECLARE iname TEXT;
      BEGIN
        SELECT indexname INTO iname
        FROM pg_indexes
        WHERE tablename = 'product_taxes'
          AND indexdef LIKE '%UNIQUE%'
          AND indexdef LIKE '%product_id%'
          AND indexdef LIKE '%tax_id%'
        LIMIT 1;
        IF iname IS NOT NULL THEN
          EXECUTE 'DROP INDEX ' || quote_ident(iname);
        END IF;
      END $$
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_tax_types_code_active"
       ON "tax_types" ("code")
       WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_product_taxes_product_tax_active"
       ON "product_taxes" ("product_id", "tax_id")
       WHERE "deletedAt" IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tax_types_code_active"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_taxes_product_tax_active"`,
    );

    await queryRunner.query(
      `ALTER TABLE "tax_types" ADD CONSTRAINT "UQ_tax_types_code" UNIQUE ("code")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX ON "product_taxes" ("product_id", "tax_id")`,
    );
  }
}
