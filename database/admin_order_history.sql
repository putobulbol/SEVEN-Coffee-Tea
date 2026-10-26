-- Idempotent indexes for admin order-history queries.
USE seven_coffee;
SET @has_status_created := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND INDEX_NAME='idx_orders_status_created_at');
SET @sql := IF(@has_status_created=0,'CREATE INDEX idx_orders_status_created_at ON orders (order_status, created_at)','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has_created := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND INDEX_NAME='idx_orders_created_at');
SET @sql := IF(@has_created=0,'CREATE INDEX idx_orders_created_at ON orders (created_at)','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
