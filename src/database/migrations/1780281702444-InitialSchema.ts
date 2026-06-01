import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1780281702444 implements MigrationInterface {
  name = 'InitialSchema1780281702444';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "profiles" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying(255) NOT NULL, "last_name" character varying(255) NOT NULL, "avatar" character varying(255), CONSTRAINT "PK_8e520eb4da7dc01d0e190447c8e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."roles_type_enum" AS ENUM('super_admin', 'admin', 'client')`,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "type" "public"."roles_type_enum" NOT NULL, CONSTRAINT "UQ_ff503f858b61860b2b7d7a55ceb" UNIQUE ("type"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "email" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, "isActive" boolean NOT NULL DEFAULT false, "profile_id" integer NOT NULL, "role_id" integer, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "REL_23371445bd80cb3e413089551b" UNIQUE ("profile_id"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tax_types" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "code" character varying(20) NOT NULL, "name" character varying(150) NOT NULL, CONSTRAINT "UQ_e55508e555edfdd379ff6772a47" UNIQUE ("code"), CONSTRAINT "PK_0eb0ecec0ae0c193f791057058a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "taxes" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "tax_type_id" integer NOT NULL, "value" numeric(10,2) NOT NULL, "is_global" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_6c58c9cbb420c4f65e3f5eb8162" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_23dcfd0ceab5fa8f46a1843514" ON "taxes" ("tax_type_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "product_images" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "product_id" integer NOT NULL, "url" character varying(255) NOT NULL, "public_id" character varying(255), "position" integer NOT NULL, CONSTRAINT "PK_1974264ea7265989af8392f63a1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1f77fd3293d18eba249603c545" ON "product_images" ("product_id", "position") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4f166bb8c2bfcef2498d97b406" ON "product_images" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "combo_images" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "combo_id" integer NOT NULL, "url" character varying(255) NOT NULL, "public_id" character varying(255), "position" integer NOT NULL, CONSTRAINT "PK_3ca82deb38d1873ed35923bfa33" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ef9d86a23af81870cca5eb876e" ON "combo_images" ("combo_id", "position") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_00196ec352478827c88b28f6a1" ON "combo_images" ("combo_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying(100) NOT NULL, "description" character varying(255), "isActive" boolean NOT NULL DEFAULT true, "parent_id" integer, CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878" UNIQUE ("name"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_88cea2dc9c31951d06437879b4" ON "categories" ("parent_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8b0be371d28245da6e4f4b6187" ON "categories" ("name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "combos" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying(150) NOT NULL, "description" character varying(255) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "category_id" integer NOT NULL, CONSTRAINT "PK_5b4bab633aee439e2bade42cc3c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6e45f3a6487759f7ef17294551" ON "combos" ("category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d61d898d195e52cebac20cf1dd" ON "combos" ("isActive") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e160bce8577758c165a8d9397f" ON "combos" ("name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "combo_items" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "combo_id" integer NOT NULL, "product_id" integer NOT NULL, "quantity" integer NOT NULL, CONSTRAINT "PK_f633e0564e3422d489c5cebe2e6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4256f97167da7da758920d6287" ON "combo_items" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_06e1d3d98150e65c8091cd4359" ON "combo_items" ("combo_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."products_measurementunit_enum" AS ENUM('unit', 'kg', 'gram', 'liter', 'ml', 'meter', 'cm', 'pack', 'box', 'dozen')`,
    );
    await queryRunner.query(
      `CREATE TABLE "products" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "sku" character varying(50) NOT NULL, "name" character varying(150) NOT NULL, "description" character varying(255) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "category_id" integer NOT NULL, "measurementUnit" "public"."products_measurementunit_enum" NOT NULL DEFAULT 'unit', "measurementValue" numeric(10,2), CONSTRAINT "UQ_c44ac33a05b144dd0d9ddcf9327" UNIQUE ("sku"), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9a5f6868c96e0069e699f33e12" ON "products" ("category_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c44ac33a05b144dd0d9ddcf932" ON "products" ("sku") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ff39b9ac40872b2de41751eedc" ON "products" ("isActive") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4c9fb58de893725258746385e1" ON "products" ("name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "product_taxes" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "product_id" integer NOT NULL, "tax_id" integer NOT NULL, CONSTRAINT "PK_a890c143156cb381a1177c25d28" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_eedbaf8b313da40dcd05484bb7" ON "product_taxes" ("product_id", "tax_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stock_locations_type_enum" AS ENUM('WAREHOUSE', 'STORE', 'VIRTUAL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "stock_locations" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying(120) NOT NULL, "type" "public"."stock_locations_type_enum" NOT NULL, "address" character varying(255), CONSTRAINT "PK_86370cc527e4982c542b286f11c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_94e7261ebfe6cefef89ab04906" ON "stock_locations" ("name") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stock_movements_operation_type_enum" AS ENUM('ENTRY', 'EXIT', 'ADJUSTMENT', 'DAMAGE', 'RETURN', 'INITIAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stock_movements_stock_flow_enum" AS ENUM('INBOUND', 'OUTBOUND')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stock_movements_reference_type_enum" AS ENUM('ORDER', 'PURCHASE_ORDER', 'ADJUSTMENT', 'DAMAGE_REPORT', 'MANUAL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "stock_movements" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "stock_item_id" integer NOT NULL, "operation_type" "public"."stock_movements_operation_type_enum" NOT NULL, "stock_flow" "public"."stock_movements_stock_flow_enum" NOT NULL, "quantity" integer NOT NULL, "reference_type" "public"."stock_movements_reference_type_enum" NOT NULL, "reference_id" integer, CONSTRAINT "PK_57a26b190618550d8e65fb860e7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bed9ede4e01a5a8072732a9415" ON "stock_movements" ("reference_type", "reference_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e60579f2632569d591a928d88a" ON "stock_movements" ("stock_flow") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9fc8ac2357ca77502099496e88" ON "stock_movements" ("operation_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1e003d3f4797c64c017bf576d9" ON "stock_movements" ("stock_item_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "stock_items" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "product_id" integer NOT NULL, "location_id" integer NOT NULL, "quantity_current" integer NOT NULL DEFAULT '0', "quantity_reserved" integer NOT NULL DEFAULT '0', "stock_min" integer NOT NULL DEFAULT '0', "stock_critical" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_52a266aa3e04b8ad1f01088f3f0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3289d71d88825cc164ddbc8604" ON "stock_items" ("product_id", "location_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stock_write_offs_reason_enum" AS ENUM('DAMAGED', 'EXPIRED', 'DEFECTIVE', 'CONTAMINATED', 'LOST', 'INVENTORY_ERROR', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "stock_write_offs" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "stock_item_id" integer NOT NULL, "movement_id" integer NOT NULL, "quantity" integer NOT NULL, "reason" "public"."stock_write_offs_reason_enum" NOT NULL, "description" text, "attachments" jsonb, "reported_by" integer NOT NULL, CONSTRAINT "PK_70217db09d739c8845917e570ed" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b15482afee53eda0be94cb2c78" ON "stock_write_offs" ("movement_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2af773ba0cb9476caf0c6cbf43" ON "stock_write_offs" ("stock_item_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "margins" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying(100) NOT NULL, "value" numeric(10,2) NOT NULL, CONSTRAINT "PK_c09afde434626e11e00e10b61f1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5820476f12670504014ea9166c" ON "margins" ("name") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."product_pricing_currency_enum" AS ENUM('ARS')`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_pricing" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "product_id" integer NOT NULL, "currency" "public"."product_pricing_currency_enum" NOT NULL, "unit_price" numeric(12,2) NOT NULL, "margin_id" integer, CONSTRAINT "PK_96a4a861354899893dcf7c8d313" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_bf55ac56eaa6394e8dfca101d2" ON "product_pricing" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."combo_pricing_currency_enum" AS ENUM('ARS')`,
    );
    await queryRunner.query(
      `CREATE TABLE "combo_pricing" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "combo_id" integer NOT NULL, "currency" "public"."combo_pricing_currency_enum" NOT NULL, "unit_price" numeric(12,2) NOT NULL, "margin_id" integer, CONSTRAINT "PK_6ab2fe06813671c27fd52aeed4d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_37302d6c4e2747224db4061bea" ON "combo_pricing" ("combo_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "coupons" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "code" character varying(100) NOT NULL, "value" numeric(10,2) NOT NULL, "is_global" boolean NOT NULL DEFAULT false, "usage_limit" integer, "usage_count" integer NOT NULL DEFAULT '0', "starts_at" TIMESTAMP, "ends_at" TIMESTAMP, CONSTRAINT "UQ_e025109230e82925843f2a14c48" UNIQUE ("code"), CONSTRAINT "PK_d7ea8864a0150183770f3e9a8cb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_901fa15551ddfc31b88054f678" ON "coupons" ("ends_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d387b5a78677eea50fba5e6d76" ON "coupons" ("starts_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "order_items" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "order_id" integer NOT NULL, "product_id" integer, "combo_id" integer, "quantity" integer NOT NULL, "location_id" integer, "combo_reservations" jsonb, "unit_price" numeric(12,2) NOT NULL, "final_price" numeric(12,2) NOT NULL, CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_status_enum" AS ENUM('pending', 'confirmed', 'dispatched', 'delivered', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_deliverytype_enum" AS ENUM('delivery', 'pickup')`,
    );
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "user_id" integer NOT NULL, "coupon_id" integer, "status" "public"."orders_status_enum" NOT NULL DEFAULT 'pending', "deliveryType" "public"."orders_deliverytype_enum" NOT NULL, "address" character varying(500), "notes" character varying(500), "subtotal" numeric(12,2) NOT NULL, "couponDiscount" numeric(12,2), "total" numeric(12,2) NOT NULL, CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cb77bc746d4e7b50c722fb2151" ON "orders" ("user_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_provider_enum" AS ENUM('mercadopago', 'stripe')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('pending', 'approved', 'rejected', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "order_id" integer NOT NULL, "provider" "public"."payments_provider_enum" NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'pending', "external_id" character varying(255), "checkout_url" character varying(500), "amount" numeric(12,2) NOT NULL, "metadata" jsonb, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6ae78c8295d2afe9470e9074aa" ON "payments" ("external_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b2f7b823a21562eeca20e72b00" ON "payments" ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tokens_type_enum" AS ENUM('account_activation', 'password_reset')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tokens" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "token" character varying(255) NOT NULL, "type" "public"."tokens_type_enum" NOT NULL, "user_id" integer NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_3001e89ada36263dabf1fb6210a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_306030d9411d291750fd115857" ON "tokens" ("user_id", "type") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_6a8ca5961656d13c16c04079dd" ON "tokens" ("token") `,
    );
    await queryRunner.query(
      `CREATE TABLE "discounts" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying(255) NOT NULL, "description" character varying(500), "value" numeric(10,2) NOT NULL, "starts_at" TIMESTAMP, "ends_at" TIMESTAMP, CONSTRAINT "PK_66c522004212dc814d6e2f14ecc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_972bab0bd19f31bcf428bda849" ON "discounts" ("ends_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_424b686b67889fb418549c5770" ON "discounts" ("starts_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "discount_product_targets" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "discount_id" integer NOT NULL, "product_id" integer NOT NULL, CONSTRAINT "PK_11fde1381a69fe5f31023f118df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_65a134da9e92fbb8ba8301eef5" ON "discount_product_targets" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_666a5d7b32e7c443835e808161" ON "discount_product_targets" ("discount_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "discount_combo_targets" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "discount_id" integer NOT NULL, "combo_id" integer NOT NULL, CONSTRAINT "PK_7d2c0fc2f90e4c45d6bc4ae55dd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cda373d3d30dc6430486be5ffb" ON "discount_combo_targets" ("combo_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7557bc74d70a1e3ef694030a47" ON "discount_combo_targets" ("discount_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "coupon_usages" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "coupon_id" integer NOT NULL, "user_id" integer NOT NULL, "order_id" integer NOT NULL, "applied_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_01ff9a1cac559c4ae2e4179d0a3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1fa2cbd0178e94678cd55e376b" ON "coupon_usages" ("coupon_id", "user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_579f1e1f0ccf35785bbbdebeb8" ON "coupon_usages" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f017af60a02209a6b045f673ca" ON "coupon_usages" ("order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_56491a0d0010feb079b964e23b" ON "coupon_usages" ("coupon_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "coupon_product_targets" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "coupon_id" integer NOT NULL, "product_id" integer NOT NULL, CONSTRAINT "PK_9d984f4ff6de40d73936c8f1d87" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c7fe5cdd03e89e32442b793abf" ON "coupon_product_targets" ("coupon_id", "product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a474a1c515de9c66e01b24b856" ON "coupon_product_targets" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ee0e5b2841b3638f5be5b158b3" ON "coupon_product_targets" ("coupon_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "coupon_combo_targets" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "coupon_id" integer NOT NULL, "combo_id" integer NOT NULL, CONSTRAINT "PK_c366e3f619817f9bad6bd891873" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3904cc8393b3ed4ea7b1435985" ON "coupon_combo_targets" ("coupon_id", "combo_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_13982133d202cd3edad36291f7" ON "coupon_combo_targets" ("combo_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b249f2aeb044e46a64ad229fff" ON "coupon_combo_targets" ("coupon_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "user_id" integer NOT NULL, "token_hash" character varying(255) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a7838d2ba25be1342091b6695f" ON "refresh_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_23371445bd80cb3e413089551bf" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "taxes" ADD CONSTRAINT "FK_23dcfd0ceab5fa8f46a1843514a" FOREIGN KEY ("tax_type_id") REFERENCES "tax_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_images" ADD CONSTRAINT "FK_4f166bb8c2bfcef2498d97b4068" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "combo_images" ADD CONSTRAINT "FK_00196ec352478827c88b28f6a14" FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_88cea2dc9c31951d06437879b40" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "combos" ADD CONSTRAINT "FK_6e45f3a6487759f7ef17294551f" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "combo_items" ADD CONSTRAINT "FK_06e1d3d98150e65c8091cd4359b" FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "combo_items" ADD CONSTRAINT "FK_4256f97167da7da758920d62870" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_9a5f6868c96e0069e699f33e124" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_taxes" ADD CONSTRAINT "FK_1d39e319e41b1edce44933cfe75" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_taxes" ADD CONSTRAINT "FK_db8c22b3e1e26adae58c92dc64e" FOREIGN KEY ("tax_id") REFERENCES "taxes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_1e003d3f4797c64c017bf576d99" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_items" ADD CONSTRAINT "FK_7d35d70ec8771bb8c5f262d4d7f" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_items" ADD CONSTRAINT "FK_25ae61188486b991f53d11b717d" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_write_offs" ADD CONSTRAINT "FK_2af773ba0cb9476caf0c6cbf431" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_write_offs" ADD CONSTRAINT "FK_b15482afee53eda0be94cb2c789" FOREIGN KEY ("movement_id") REFERENCES "stock_movements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_pricing" ADD CONSTRAINT "FK_bf55ac56eaa6394e8dfca101d2c" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_pricing" ADD CONSTRAINT "FK_40b1510e04fef846f8874889841" FOREIGN KEY ("margin_id") REFERENCES "margins"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "combo_pricing" ADD CONSTRAINT "FK_37302d6c4e2747224db4061bea4" FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "combo_pricing" ADD CONSTRAINT "FK_904de7191294cdcb96965ff2b32" FOREIGN KEY ("margin_id") REFERENCES "margins"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_9263386c35b6b242540f9493b00" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_6d989d78ae7e69ea28ee40525e6" FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_a922b820eeef29ac1c6800e826a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_6284f0f60e4cb96c12ff96f0f15" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_b2f7b823a21562eeca20e72b006" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD CONSTRAINT "FK_8769073e38c365f315426554ca5" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "discount_product_targets" ADD CONSTRAINT "FK_666a5d7b32e7c443835e8081617" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "discount_product_targets" ADD CONSTRAINT "FK_65a134da9e92fbb8ba8301eef54" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "discount_combo_targets" ADD CONSTRAINT "FK_7557bc74d70a1e3ef694030a471" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "discount_combo_targets" ADD CONSTRAINT "FK_cda373d3d30dc6430486be5ffb3" FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupon_usages" ADD CONSTRAINT "FK_56491a0d0010feb079b964e23b4" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupon_usages" ADD CONSTRAINT "FK_579f1e1f0ccf35785bbbdebeb85" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupon_usages" ADD CONSTRAINT "FK_f017af60a02209a6b045f673ca1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupon_product_targets" ADD CONSTRAINT "FK_ee0e5b2841b3638f5be5b158b37" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupon_combo_targets" ADD CONSTRAINT "FK_b249f2aeb044e46a64ad229fff4" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupon_combo_targets" DROP CONSTRAINT "FK_b249f2aeb044e46a64ad229fff4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupon_product_targets" DROP CONSTRAINT "FK_ee0e5b2841b3638f5be5b158b37"`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupon_usages" DROP CONSTRAINT "FK_f017af60a02209a6b045f673ca1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupon_usages" DROP CONSTRAINT "FK_579f1e1f0ccf35785bbbdebeb85"`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupon_usages" DROP CONSTRAINT "FK_56491a0d0010feb079b964e23b4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "discount_combo_targets" DROP CONSTRAINT "FK_cda373d3d30dc6430486be5ffb3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "discount_combo_targets" DROP CONSTRAINT "FK_7557bc74d70a1e3ef694030a471"`,
    );
    await queryRunner.query(
      `ALTER TABLE "discount_product_targets" DROP CONSTRAINT "FK_65a134da9e92fbb8ba8301eef54"`,
    );
    await queryRunner.query(
      `ALTER TABLE "discount_product_targets" DROP CONSTRAINT "FK_666a5d7b32e7c443835e8081617"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" DROP CONSTRAINT "FK_8769073e38c365f315426554ca5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_b2f7b823a21562eeca20e72b006"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_6284f0f60e4cb96c12ff96f0f15"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_a922b820eeef29ac1c6800e826a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_6d989d78ae7e69ea28ee40525e6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_9263386c35b6b242540f9493b00"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_145532db85752b29c57d2b7b1f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "combo_pricing" DROP CONSTRAINT "FK_904de7191294cdcb96965ff2b32"`,
    );
    await queryRunner.query(
      `ALTER TABLE "combo_pricing" DROP CONSTRAINT "FK_37302d6c4e2747224db4061bea4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_pricing" DROP CONSTRAINT "FK_40b1510e04fef846f8874889841"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_pricing" DROP CONSTRAINT "FK_bf55ac56eaa6394e8dfca101d2c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_write_offs" DROP CONSTRAINT "FK_b15482afee53eda0be94cb2c789"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_write_offs" DROP CONSTRAINT "FK_2af773ba0cb9476caf0c6cbf431"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_items" DROP CONSTRAINT "FK_25ae61188486b991f53d11b717d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_items" DROP CONSTRAINT "FK_7d35d70ec8771bb8c5f262d4d7f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_1e003d3f4797c64c017bf576d99"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_taxes" DROP CONSTRAINT "FK_db8c22b3e1e26adae58c92dc64e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_taxes" DROP CONSTRAINT "FK_1d39e319e41b1edce44933cfe75"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_9a5f6868c96e0069e699f33e124"`,
    );
    await queryRunner.query(
      `ALTER TABLE "combo_items" DROP CONSTRAINT "FK_4256f97167da7da758920d62870"`,
    );
    await queryRunner.query(
      `ALTER TABLE "combo_items" DROP CONSTRAINT "FK_06e1d3d98150e65c8091cd4359b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "combos" DROP CONSTRAINT "FK_6e45f3a6487759f7ef17294551f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_88cea2dc9c31951d06437879b40"`,
    );
    await queryRunner.query(
      `ALTER TABLE "combo_images" DROP CONSTRAINT "FK_00196ec352478827c88b28f6a14"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_images" DROP CONSTRAINT "FK_4f166bb8c2bfcef2498d97b4068"`,
    );
    await queryRunner.query(
      `ALTER TABLE "taxes" DROP CONSTRAINT "FK_23dcfd0ceab5fa8f46a1843514a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_23371445bd80cb3e413089551bf"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a7838d2ba25be1342091b6695f"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b249f2aeb044e46a64ad229fff"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_13982133d202cd3edad36291f7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3904cc8393b3ed4ea7b1435985"`,
    );
    await queryRunner.query(`DROP TABLE "coupon_combo_targets"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ee0e5b2841b3638f5be5b158b3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a474a1c515de9c66e01b24b856"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c7fe5cdd03e89e32442b793abf"`,
    );
    await queryRunner.query(`DROP TABLE "coupon_product_targets"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_56491a0d0010feb079b964e23b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f017af60a02209a6b045f673ca"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_579f1e1f0ccf35785bbbdebeb8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1fa2cbd0178e94678cd55e376b"`,
    );
    await queryRunner.query(`DROP TABLE "coupon_usages"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7557bc74d70a1e3ef694030a47"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cda373d3d30dc6430486be5ffb"`,
    );
    await queryRunner.query(`DROP TABLE "discount_combo_targets"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_666a5d7b32e7c443835e808161"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_65a134da9e92fbb8ba8301eef5"`,
    );
    await queryRunner.query(`DROP TABLE "discount_product_targets"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_424b686b67889fb418549c5770"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_972bab0bd19f31bcf428bda849"`,
    );
    await queryRunner.query(`DROP TABLE "discounts"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6a8ca5961656d13c16c04079dd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_306030d9411d291750fd115857"`,
    );
    await queryRunner.query(`DROP TABLE "tokens"`);
    await queryRunner.query(`DROP TYPE "public"."tokens_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b2f7b823a21562eeca20e72b00"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6ae78c8295d2afe9470e9074aa"`,
    );
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payments_provider_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cb77bc746d4e7b50c722fb2151"`,
    );
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TYPE "public"."orders_deliverytype_enum"`);
    await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d387b5a78677eea50fba5e6d76"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_901fa15551ddfc31b88054f678"`,
    );
    await queryRunner.query(`DROP TABLE "coupons"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_37302d6c4e2747224db4061bea"`,
    );
    await queryRunner.query(`DROP TABLE "combo_pricing"`);
    await queryRunner.query(`DROP TYPE "public"."combo_pricing_currency_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bf55ac56eaa6394e8dfca101d2"`,
    );
    await queryRunner.query(`DROP TABLE "product_pricing"`);
    await queryRunner.query(
      `DROP TYPE "public"."product_pricing_currency_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5820476f12670504014ea9166c"`,
    );
    await queryRunner.query(`DROP TABLE "margins"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2af773ba0cb9476caf0c6cbf43"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b15482afee53eda0be94cb2c78"`,
    );
    await queryRunner.query(`DROP TABLE "stock_write_offs"`);
    await queryRunner.query(
      `DROP TYPE "public"."stock_write_offs_reason_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3289d71d88825cc164ddbc8604"`,
    );
    await queryRunner.query(`DROP TABLE "stock_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1e003d3f4797c64c017bf576d9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9fc8ac2357ca77502099496e88"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e60579f2632569d591a928d88a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bed9ede4e01a5a8072732a9415"`,
    );
    await queryRunner.query(`DROP TABLE "stock_movements"`);
    await queryRunner.query(
      `DROP TYPE "public"."stock_movements_reference_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."stock_movements_stock_flow_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."stock_movements_operation_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_94e7261ebfe6cefef89ab04906"`,
    );
    await queryRunner.query(`DROP TABLE "stock_locations"`);
    await queryRunner.query(`DROP TYPE "public"."stock_locations_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_eedbaf8b313da40dcd05484bb7"`,
    );
    await queryRunner.query(`DROP TABLE "product_taxes"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4c9fb58de893725258746385e1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ff39b9ac40872b2de41751eedc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c44ac33a05b144dd0d9ddcf932"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9a5f6868c96e0069e699f33e12"`,
    );
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(
      `DROP TYPE "public"."products_measurementunit_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_06e1d3d98150e65c8091cd4359"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4256f97167da7da758920d6287"`,
    );
    await queryRunner.query(`DROP TABLE "combo_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e160bce8577758c165a8d9397f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d61d898d195e52cebac20cf1dd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6e45f3a6487759f7ef17294551"`,
    );
    await queryRunner.query(`DROP TABLE "combos"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8b0be371d28245da6e4f4b6187"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_88cea2dc9c31951d06437879b4"`,
    );
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_00196ec352478827c88b28f6a1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ef9d86a23af81870cca5eb876e"`,
    );
    await queryRunner.query(`DROP TABLE "combo_images"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4f166bb8c2bfcef2498d97b406"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1f77fd3293d18eba249603c545"`,
    );
    await queryRunner.query(`DROP TABLE "product_images"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_23dcfd0ceab5fa8f46a1843514"`,
    );
    await queryRunner.query(`DROP TABLE "taxes"`);
    await queryRunner.query(`DROP TABLE "tax_types"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TYPE "public"."roles_type_enum"`);
    await queryRunner.query(`DROP TABLE "profiles"`);
  }
}
