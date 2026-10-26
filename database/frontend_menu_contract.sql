-- SEVEN Coffee & Tea frontend/MySQL contract migration
-- Run after database/seven.sql.
USE seven_coffee;

-- Product catalog is managed exclusively from the Admin Product Management page.
-- Do not delete or seed product rows here.

SET @has_bestseller := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'is_bestseller'
);
SET @sql := IF(
  @has_bestseller = 0,
  "ALTER TABLE products ADD COLUMN is_bestseller TINYINT(1) NOT NULL DEFAULT 0",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_signature := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'is_signature'
);
SET @sql := IF(
  @has_signature = 0,
  "ALTER TABLE products ADD COLUMN is_signature TINYINT(1) NOT NULL DEFAULT 0",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Keep existing product status unchanged when this migration is re-run.
