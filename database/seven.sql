CREATE DATABASE IF NOT EXISTS seven_coffee CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE seven_coffee;

SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS customer_notifications;
DROP TABLE IF EXISTS email_verifications;
DROP TABLE IF EXISTS carousel_banners;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS payment_logs;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS=1;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(30) NULL UNIQUE,
  email VARCHAR(190) NOT NULL UNIQUE,
  email_verified_at DATETIME NULL,
  contact_number VARCHAR(40) NULL,
  password_hash VARCHAR(255) NOT NULL,
  terms_accepted_at DATETIME NULL,
  role ENUM('customer','owner','staff') NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE email_verifications (
  user_id INT UNSIGNED PRIMARY KEY,
  code_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_sent_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_email_verifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  available TINYINT(1) NOT NULL DEFAULT 1,
  status ENUM('active','out_of_stock','hidden') NOT NULL DEFAULT 'active',
  is_bestseller TINYINT(1) NOT NULL DEFAULT 0,
  is_signature TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE product_images (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  image_path VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_images_product_order (product_id, sort_order, id)
);

CREATE TABLE carousel_banners (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  image_path VARCHAR(255) NOT NULL,
  title VARCHAR(180) NULL,
  description TEXT NULL,
  cta_label VARCHAR(80) NULL,
  cta_url VARCHAR(255) NULL,
  display_order INT NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_carousel_banners_active_order (active, display_order, id)
);

CREATE TABLE orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(30) NOT NULL UNIQUE,
  user_id INT UNSIGNED NULL,
  customer_name VARCHAR(120) NOT NULL,
  contact_number VARCHAR(40) NOT NULL,
  pickup_time VARCHAR(80) NOT NULL,
  notes TEXT NULL,
  payment_method ENUM('gcash','cash_on_pickup') NOT NULL,
  payment_status ENUM('pending','submitted','verified','paid','rejected') NOT NULL DEFAULT 'pending',
  order_status ENUM('pending','confirmed','in_preparation','ready','completed','cancelled') NOT NULL DEFAULT 'pending',
  payment_reference VARCHAR(100) NULL,
  payment_screenshot VARCHAR(255) NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_user_created_at (user_id, created_at),
  INDEX idx_orders_status_created_at (order_status, created_at),
  INDEX idx_orders_created_at (created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NULL,
  product_name VARCHAR(120) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  customizations TEXT NULL,
  INDEX idx_order_items_product_id (product_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE payment_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(60) NOT NULL,
  remarks VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_logs_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE customer_notifications (
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

-- Products are intentionally empty on a fresh install. Add them through Admin Product Management.
