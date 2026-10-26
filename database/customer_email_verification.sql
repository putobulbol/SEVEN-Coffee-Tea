-- Customer email verification. Safe to rerun.
USE seven_coffee;
SET @has_email_verified_at := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='email_verified_at');
SET @sql := IF(@has_email_verified_at=0,'ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL AFTER email','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF(@has_email_verified_at=0,'UPDATE users SET email_verified_at=COALESCE(created_at,NOW()) WHERE role=''customer'' AND email_verified_at IS NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
CREATE TABLE IF NOT EXISTS email_verifications (
  user_id INT UNSIGNED PRIMARY KEY,
  code_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_sent_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_email_verifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
