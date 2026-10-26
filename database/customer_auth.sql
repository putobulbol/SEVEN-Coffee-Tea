-- SEVEN Coffee & Tea: customer authentication migration
-- Adds a database-backed username for customer login/registration.
USE seven_coffee;

SET @has_username := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'username'
);

SET @sql := IF(
  @has_username = 0,
  "ALTER TABLE users ADD COLUMN username VARCHAR(30) NULL UNIQUE AFTER name",
  "SELECT 1"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
