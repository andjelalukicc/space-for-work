import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1739020000005 implements MigrationInterface {
  name = 'Init1739020000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug" character varying NOT NULL,
        "name" character varying NOT NULL,
        "category" character varying NOT NULL DEFAULT 'Usluga',
        "price" numeric(12,2) NOT NULL,
        "unit" character varying NOT NULL DEFAULT 'kom',
        "featured" boolean NOT NULL DEFAULT false,
        "shortDescription" text,
        "tags" json,
        "stockQuantity" integer NOT NULL DEFAULT 9999,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_products_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "totalAmount" numeric(12,2) NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'eur',
        "stripeSessionId" character varying,
        "stripePaymentIntentId" character varying,
        "cardLast4" character varying,
        "paidAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "order_lines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "productId" uuid NOT NULL,
        "productName" character varying NOT NULL,
        "quantity" integer NOT NULL,
        "unitPrice" numeric(12,2) NOT NULL,
        "lineTotal" numeric(12,2) NOT NULL,
        "orderId" uuid NOT NULL,
        CONSTRAINT "PK_order_lines" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_lines_orders" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_order_lines_products" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "order_lines"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TABLE "products"`);
  }
}
