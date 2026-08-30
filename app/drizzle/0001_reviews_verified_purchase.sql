ALTER TABLE "reviews" ADD COLUMN "verified_purchase" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "reviews_product_created_idx" ON "reviews" USING btree ("product_id","created_at","id");--> statement-breakpoint
CREATE INDEX "reviews_product_rating_idx" ON "reviews" USING btree ("product_id","rating","id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_product_user_key" ON "reviews" USING btree ("product_id","user_id");