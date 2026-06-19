import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductSkuPartialUniqueIndex1781930000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Drop unique constraint/index en products.sku (no excluye soft-deleted)
    await queryRunner.query(`
      DO $$
      DECLARE cname TEXT;
      BEGIN
        SELECT tc.constraint_name INTO cname
        FROM information_schema.table_constraints tc
        INNER JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = 'products'
          AND tc.constraint_type = 'UNIQUE'
          AND kcu.column_name = 'sku'
        LIMIT 1;
        IF cname IS NOT NULL THEN
          EXECUTE 'ALTER TABLE products DROP CONSTRAINT ' || quote_ident(cname);
        END IF;
      END $$
    `);

    await queryRunner.query(`
      DO $$
      DECLARE iname TEXT;
      BEGIN
        SELECT indexname INTO iname
        FROM pg_indexes
        WHERE tablename = 'products'
          AND indexdef LIKE '%UNIQUE%'
          AND indexdef LIKE '%sku%'
        LIMIT 1;
        IF iname IS NOT NULL THEN
          EXECUTE 'DROP INDEX ' || quote_ident(iname);
        END IF;
      END $$
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_products_sku_active"
       ON "products" ("sku")
       WHERE "deletedAt" IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_sku_active"`);

    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "UQ_products_sku" UNIQUE ("sku")`,
    );
  }
}
