import { MigrationInterface, QueryRunner } from 'typeorm';

export class DiscountTargetsPartialUniqueIndex1781900000000 implements MigrationInterface {
  name = 'DiscountTargetsPartialUniqueIndex1781900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_discount_product_targets_active"
       ON "discount_product_targets" ("discount_id", "product_id")
       WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_discount_combo_targets_active"
       ON "discount_combo_targets" ("discount_id", "combo_id")
       WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_discount_product_targets_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_discount_combo_targets_active"`,
    );
  }
}
