import { MigrationInterface, QueryRunner } from 'typeorm';

export class CouponsPartialUniqueIndexes1781940000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // ── coupons.code ────────────────────────────────────────────────────────
    // Drop UNIQUE constraint global en code (no filtra soft-deleted)
    await queryRunner.query(`
      DO $$
      DECLARE cname TEXT;
      BEGIN
        SELECT tc.constraint_name INTO cname
        FROM information_schema.table_constraints tc
        INNER JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = 'coupons'
          AND tc.constraint_type = 'UNIQUE'
          AND kcu.column_name = 'code'
        LIMIT 1;
        IF cname IS NOT NULL THEN
          EXECUTE 'ALTER TABLE coupons DROP CONSTRAINT ' || quote_ident(cname);
        END IF;
      END $$
    `);

    // Drop índice UNIQUE en code si existía como INDEX (en lugar de constraint)
    await queryRunner.query(`
      DO $$
      DECLARE iname TEXT;
      BEGIN
        SELECT indexname INTO iname
        FROM pg_indexes
        WHERE tablename = 'coupons'
          AND indexdef LIKE '%UNIQUE%'
          AND indexdef LIKE '%code%'
        LIMIT 1;
        IF iname IS NOT NULL THEN
          EXECUTE 'DROP INDEX ' || quote_ident(iname);
        END IF;
      END $$
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_coupons_code_active"
       ON "coupons" ("code")
       WHERE "deletedAt" IS NULL`,
    );

    // ── coupon_product_targets ───────────────────────────────────────────────
    await queryRunner.query(`
      DO $$
      DECLARE iname TEXT;
      BEGIN
        SELECT indexname INTO iname
        FROM pg_indexes
        WHERE tablename = 'coupon_product_targets'
          AND indexdef LIKE '%UNIQUE%'
          AND indexdef LIKE '%coupon_id%'
          AND indexdef LIKE '%product_id%'
        LIMIT 1;
        IF iname IS NOT NULL THEN
          EXECUTE 'DROP INDEX ' || quote_ident(iname);
        END IF;
      END $$
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_coupon_product_targets_active"
       ON "coupon_product_targets" ("coupon_id", "product_id")
       WHERE "deletedAt" IS NULL`,
    );

    // ── coupon_combo_targets ─────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$
      DECLARE iname TEXT;
      BEGIN
        SELECT indexname INTO iname
        FROM pg_indexes
        WHERE tablename = 'coupon_combo_targets'
          AND indexdef LIKE '%UNIQUE%'
          AND indexdef LIKE '%coupon_id%'
          AND indexdef LIKE '%combo_id%'
        LIMIT 1;
        IF iname IS NOT NULL THEN
          EXECUTE 'DROP INDEX ' || quote_ident(iname);
        END IF;
      END $$
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_coupon_combo_targets_active"
       ON "coupon_combo_targets" ("coupon_id", "combo_id")
       WHERE "deletedAt" IS NULL`,
    );

    // ── coupon_usages ────────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$
      DECLARE iname TEXT;
      BEGIN
        SELECT indexname INTO iname
        FROM pg_indexes
        WHERE tablename = 'coupon_usages'
          AND indexdef LIKE '%UNIQUE%'
          AND indexdef LIKE '%coupon_id%'
          AND indexdef LIKE '%user_id%'
        LIMIT 1;
        IF iname IS NOT NULL THEN
          EXECUTE 'DROP INDEX ' || quote_ident(iname);
        END IF;
      END $$
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_coupon_usages_coupon_user_active"
       ON "coupon_usages" ("coupon_id", "user_id")
       WHERE "deletedAt" IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_coupons_code_active"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_coupon_product_targets_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_coupon_combo_targets_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_coupon_usages_coupon_user_active"`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM coupons GROUP BY code HAVING COUNT(*) > 1
        ) THEN
          ALTER TABLE "coupons" ADD CONSTRAINT "UQ_coupons_code" UNIQUE ("code");
        ELSE
          RAISE NOTICE 'Constraint único en coupons.code no restaurado: existen códigos duplicados entre registros eliminados y activos.';
        END IF;
      END $$
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX ON "coupon_product_targets" ("coupon_id", "product_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX ON "coupon_combo_targets" ("coupon_id", "combo_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX ON "coupon_usages" ("coupon_id", "user_id")`,
    );
  }
}
