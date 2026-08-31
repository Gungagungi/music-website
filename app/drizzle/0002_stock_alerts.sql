CREATE TABLE "stock_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_alerts_user_idx" ON "stock_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stock_alerts_pending_idx" ON "stock_alerts" USING btree ("product_id") WHERE "stock_alerts"."notified_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_alerts_unique" ON "stock_alerts" USING btree ("product_id","user_id");