-- SEVEN Coffee & Tea: admin bell notifications (new orders, payment proof submitted/resubmitted)
-- Run in phpMyAdmin against the seven_coffee database. Safe to re-run.
USE seven_coffee;

-- One row per event, shared by all owner/staff accounts.
CREATE TABLE IF NOT EXISTS admin_notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NULL,
  type VARCHAR(40) NOT NULL,          -- new_order | payment_resubmitted
  title VARCHAR(160) NOT NULL,
  message VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_admin_notifications_created (created_at, id),
  KEY idx_admin_notifications_order (order_id),
  CONSTRAINT fk_admin_notifications_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Read state is per admin account: marking something read only affects the person who did it.
CREATE TABLE IF NOT EXISTS admin_notification_reads (
  notification_id BIGINT UNSIGNED NOT NULL,
  admin_user_id INT UNSIGNED NOT NULL,
  read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, admin_user_id),
  KEY idx_admin_notification_reads_user (admin_user_id),
  CONSTRAINT fk_admin_notification_reads_notification FOREIGN KEY (notification_id) REFERENCES admin_notifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_admin_notification_reads_user FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
