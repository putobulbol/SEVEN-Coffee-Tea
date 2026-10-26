-- Customer order-history pagination support.
-- Safe to run more than once against the existing seven_coffee database.
USE seven_coffee;

SET @has_orders_user_created_at := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND INDEX_NAME = 'idx_orders_user_created_at'
);
SET @sql := IF(
  @has_orders_user_created_at = 0,
  'CREATE INDEX idx_orders_user_created_at ON orders (user_id, created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
