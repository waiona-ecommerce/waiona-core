import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveMarginsAddSalePrice1781950000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Quitar FK de margin_id en product_pricing
    await queryRunner.query(
      `ALTER TABLE "product_pricing" DROP CONSTRAINT IF EXISTS "FK_product_pricing_margin_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_pricing" DROP CONSTRAINT IF EXISTS "FK_40b1510e04fef846f8874889841"`,
    );

    // Quitar FK de margin_id en combo_pricing
    await queryRunner.query(
      `ALTER TABLE "combo_pricing" DROP CONSTRAINT IF EXISTS "FK_combo_pricing_margin_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "combo_pricing" DROP CONSTRAINT IF EXISTS "FK_904de7191294cdcb96965ff2b32"`,
    );

    // Agregar sale_price en product_pricing (nullable primero para poder poblar)
    await queryRunner.query(
      `ALTER TABLE "product_pricing" ADD COLUMN IF NOT EXISTS "sale_price" NUMERIC(12,2)`,
    );
    await queryRunner.query(
      `UPDATE "product_pricing" SET "sale_price" = "unit_price" WHERE "sale_price" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_pricing" ALTER COLUMN "sale_price" SET NOT NULL`,
    );

    // Agregar sale_price en combo_pricing
    await queryRunner.query(
      `ALTER TABLE "combo_pricing" ADD COLUMN IF NOT EXISTS "sale_price" NUMERIC(12,2)`,
    );
    await queryRunner.query(
      `UPDATE "combo_pricing" SET "sale_price" = "unit_price" WHERE "sale_price" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "combo_pricing" ALTER COLUMN "sale_price" SET NOT NULL`,
    );

    // Quitar columnas margin_id
    await queryRunner.query(
      `ALTER TABLE "product_pricing" DROP COLUMN IF EXISTS "margin_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "combo_pricing" DROP COLUMN IF EXISTS "margin_id"`,
    );

    // Eliminar tabla e índice de margins
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_margins_name_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "margins"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "margins" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR NOT NULL,
        "value" NUMERIC(12,2) NOT NULL,
        "is_percentage" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP
      )`,
    );

    await queryRunner.query(
      `ALTER TABLE "product_pricing" ADD COLUMN IF NOT EXISTS "margin_id" INT`,
    );
    await queryRunner.query(
      `ALTER TABLE "combo_pricing" ADD COLUMN IF NOT EXISTS "margin_id" INT`,
    );

    await queryRunner.query(
      `ALTER TABLE "product_pricing" DROP COLUMN IF EXISTS "sale_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "combo_pricing" DROP COLUMN IF EXISTS "sale_price"`,
    );
  }
}
