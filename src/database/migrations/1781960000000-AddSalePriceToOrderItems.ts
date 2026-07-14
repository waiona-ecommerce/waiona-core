import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSalePriceToOrderItems1781960000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD COLUMN "sale_price" NUMERIC(12,2)`,
    );
    await queryRunner.query(
      `UPDATE "order_items" SET "sale_price" = "unit_price" WHERE "sale_price" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ALTER COLUMN "sale_price" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN "sale_price"`,
    );
  }
}
