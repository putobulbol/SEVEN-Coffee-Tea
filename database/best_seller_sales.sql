-- Index used by the live sales-ranked best-seller query.
-- Safe to rerun against an existing seven_coffee database.
USE seven_coffee;
SET @has_order_items_product := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_items' AND INDEX_NAME='idx_order_items_product_id'
);
SET @sql := IF(@has_order_items_product=0,
  'CREATE INDEX idx_order_items_product_id ON order_items (product_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
