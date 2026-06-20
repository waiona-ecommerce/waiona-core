import { MigrationInterface, QueryRunner } from 'typeorm';

export class ImagePositionPartialUniqueIndex1781920000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE iname TEXT;
      BEGIN
        SELECT indexname INTO iname
        FROM pg_indexes
        WHERE tablename = 'product_images'
          AND indexdef LIKE '%UNIQUE%'
          AND indexdef LIKE '%product_id%'
          AND indexdef LIKE '%position%'
        LIMIT 1;
        IF iname IS NOT NULL THEN
          EXECUTE 'DROP INDEX ' || quote_ident(iname);
        END IF;
      END $$
    `);

    await queryRunner.query(`
      DO $$
      DECLARE iname TEXT;
      BEGIN
        SELECT indexname INTO iname
        FROM pg_indexes
        WHERE tablename = 'combo_images'
          AND indexdef LIKE '%UNIQUE%'
          AND indexdef LIKE '%combo_id%'
          AND indexdef LIKE '%position%'
        LIMIT 1;
        IF iname IS NOT NULL THEN
          EXECUTE 'DROP INDEX ' || quote_ident(iname);
        END IF;
      END $$
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_product_images_position_active"
       ON "product_images" ("product_id", "position")
       WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_combo_images_position_active"
       ON "combo_images" ("combo_id", "position")
       WHERE "deletedAt" IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_images_position_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_combo_images_position_active"`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM product_images
          GROUP BY product_id, position HAVING COUNT(*) > 1
        ) THEN
          CREATE UNIQUE INDEX ON "product_images" ("product_id", "position");
        ELSE
          RAISE NOTICE 'Índice único global en product_images no restaurado: existen posiciones duplicadas entre registros eliminados y activos.';
        END IF;
      END $$
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM combo_images
          GROUP BY combo_id, position HAVING COUNT(*) > 1
        ) THEN
          CREATE UNIQUE INDEX ON "combo_images" ("combo_id", "position");
        ELSE
          RAISE NOTICE 'Índice único global en combo_images no restaurado: existen posiciones duplicadas entre registros eliminados y activos.';
        END IF;
      END $$
    `);
  }
}
