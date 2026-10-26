-- SEVEN Coffee & Tea: customer account details and in-site notifications
-- Run this once in phpMyAdmin against the seven_coffee database.
USE seven_coffee;

SET @has_contact_number := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'contact_number'
);
SET @sql := IF(@has_contact_number = 0,
  'ALTER TABLE users ADD COLUMN contact_number VARCHAR(40) NULL AFTER email',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_terms_accepted_at := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'terms_accepted_at'
);
SET @sql := IF(@has_terms_accepted_at = 0,
  'ALTER TABLE users ADD COLUMN terms_accepted_at DATETIME NULL AFTER password_hash',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS customer_notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(160) NOT NULL,
  message VARCHAR(500) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customer_notifications_user_created (user_id, created_at, id),
  INDEX idx_customer_notifications_user_unread (user_id, is_read),
  CONSTRAINT fk_customer_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_notifications_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);
