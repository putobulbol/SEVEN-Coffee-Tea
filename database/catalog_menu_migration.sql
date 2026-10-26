-- SEVEN Coffee & Tea catalog migration
-- Run once on the existing seven_coffee database. This archives rather than deletes the prior catalog.
-- Historical orders and order_items remain intact; the new menu gets fresh product IDs.
USE seven_coffee;
START TRANSACTION;

SET @has_large_price = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'large_price');
SET @sql_large_price = IF(@has_large_price = 0, 'ALTER TABLE products ADD COLUMN large_price DECIMAL(10,2) NULL AFTER price', 'SELECT 1');
PREPARE stmt_large_price FROM @sql_large_price;
EXECUTE stmt_large_price;
DEALLOCATE PREPARE stmt_large_price;

SET @has_catalog_version = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'catalog_version');
SET @sql_catalog_version = IF(@has_catalog_version = 0, 'ALTER TABLE products ADD COLUMN catalog_version TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER large_price', 'SELECT 1');
PREPARE stmt_catalog_version FROM @sql_catalog_version;
EXECUTE stmt_catalog_version;
DEALLOCATE PREPARE stmt_catalog_version;

UPDATE products
SET status='hidden', available=0, is_bestseller=0, is_signature=0
WHERE catalog_version=0;

INSERT INTO products
  (name, description, category, price, large_price, available, status, is_bestseller, is_signature, catalog_version)
SELECT seed.name, NULL, seed.category, seed.medium_price, seed.large_price, 1, 'active', 0, 0, 1
FROM (
SELECT 'Americano' AS name, 'Iced Coffee' AS category, 38.00 AS medium_price, 48.00 AS large_price
UNION ALL
SELECT 'Cafe Latte' AS name, 'Iced Coffee' AS category, 38.00 AS medium_price, 48.00 AS large_price
UNION ALL
SELECT 'Cafe Mocha' AS name, 'Iced Coffee' AS category, 38.00 AS medium_price, 48.00 AS large_price
UNION ALL
SELECT 'Mocha Almond' AS name, 'Iced Coffee' AS category, 38.00 AS medium_price, 48.00 AS large_price
UNION ALL
SELECT 'Caramel Macchiato' AS name, 'Iced Coffee' AS category, 38.00 AS medium_price, 48.00 AS large_price
UNION ALL
SELECT 'Hazelnut Macchiato' AS name, 'Iced Coffee' AS category, 38.00 AS medium_price, 48.00 AS large_price
UNION ALL
SELECT 'Salted Caramel' AS name, 'Iced Coffee' AS category, 38.00 AS medium_price, 48.00 AS large_price
UNION ALL
SELECT 'Spanish Latte' AS name, 'Iced Coffee' AS category, 38.00 AS medium_price, 48.00 AS large_price
UNION ALL
SELECT 'Vanilla Macchiato' AS name, 'Iced Coffee' AS category, 38.00 AS medium_price, 48.00 AS large_price
UNION ALL
SELECT 'Salty Cream Coffee' AS name, 'Special Coffee' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Vietnamese Coffee' AS name, 'Special Coffee' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'White Mocha' AS name, 'Special Coffee' AS category, 55.00 AS medium_price, 65.00 AS large_price
UNION ALL
SELECT 'Seven Coffee with Pearl' AS name, 'Special Coffee' AS category, 55.00 AS medium_price, 65.00 AS large_price
UNION ALL
SELECT 'Dirty Matcha' AS name, 'Special Coffee' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Ube Espresso' AS name, 'Special Coffee' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Avo Espresso' AS name, 'Special Coffee' AS category, 55.00 AS medium_price, 65.00 AS large_price
UNION ALL
SELECT 'Sea Salt Latte' AS name, 'Special Coffee' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Velvet Cream Latte' AS name, 'Special Coffee' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Cloud Caramel' AS name, 'Special Coffee' AS category, 55.00 AS medium_price, 65.00 AS large_price
UNION ALL
SELECT 'Strawberry Espresso' AS name, 'Special Coffee' AS category, 55.00 AS medium_price, 65.00 AS large_price
UNION ALL
SELECT 'Choc-Nut Latte' AS name, 'Special Coffee' AS category, 55.00 AS medium_price, 65.00 AS large_price
UNION ALL
SELECT 'Cookie Butter Latte' AS name, 'Special Coffee' AS category, 65.00 AS medium_price, 75.00 AS large_price
UNION ALL
SELECT 'Iced Choco' AS name, 'Iced Non-Coffee' AS category, 38.00 AS medium_price, 48.00 AS large_price
UNION ALL
SELECT 'Chocolate Almond' AS name, 'Iced Non-Coffee' AS category, 38.00 AS medium_price, 48.00 AS large_price
UNION ALL
SELECT 'Strawberry Pink' AS name, 'Iced Non-Coffee' AS category, 38.00 AS medium_price, 48.00 AS large_price
UNION ALL
SELECT 'Matcha Latte' AS name, 'Iced Non-Coffee' AS category, 38.00 AS medium_price, 48.00 AS large_price
UNION ALL
SELECT 'Ube Latte' AS name, 'Iced Non-Coffee' AS category, 38.00 AS medium_price, 48.00 AS large_price
UNION ALL
SELECT 'Avo Latte (Avocado)' AS name, 'Iced Non-Coffee' AS category, 38.00 AS medium_price, 48.00 AS large_price
UNION ALL
SELECT 'Blueberry Milk' AS name, 'Special Non-Coffee' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Choco Berry' AS name, 'Special Non-Coffee' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Oreo Luxe' AS name, 'Special Non-Coffee' AS category, 55.00 AS medium_price, 65.00 AS large_price
UNION ALL
SELECT 'Oreo Milo Lava' AS name, 'Special Non-Coffee' AS category, 55.00 AS medium_price, 65.00 AS large_price
UNION ALL
SELECT 'Velvet Biscoff' AS name, 'Special Non-Coffee' AS category, 65.00 AS medium_price, 75.00 AS large_price
UNION ALL
SELECT 'Matcha Berry' AS name, 'Special Non-Coffee' AS category, 55.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Velvet Matcha' AS name, 'Special Non-Coffee' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Birthday Matcha' AS name, 'Special Non-Coffee' AS category, 55.00 AS medium_price, 65.00 AS large_price
UNION ALL
SELECT 'Mango Matcha' AS name, 'Special Non-Coffee' AS category, 60.00 AS medium_price, 70.00 AS large_price
UNION ALL
SELECT 'Biscoff Matcha' AS name, 'Special Non-Coffee' AS category, 65.00 AS medium_price, 75.00 AS large_price
UNION ALL
SELECT 'Americano' AS name, 'Hot Beverages' AS category, 45.00 AS medium_price, NULL AS large_price
UNION ALL
SELECT 'Cafe Latte' AS name, 'Hot Beverages' AS category, 45.00 AS medium_price, NULL AS large_price
UNION ALL
SELECT 'Cafe Mocha' AS name, 'Hot Beverages' AS category, 45.00 AS medium_price, NULL AS large_price
UNION ALL
SELECT 'Caramel Macchiato' AS name, 'Hot Beverages' AS category, 45.00 AS medium_price, NULL AS large_price
UNION ALL
SELECT 'Chocolate' AS name, 'Hot Beverages' AS category, 45.00 AS medium_price, NULL AS large_price
UNION ALL
SELECT 'Hazelnut Macchiato' AS name, 'Hot Beverages' AS category, 45.00 AS medium_price, NULL AS large_price
UNION ALL
SELECT 'Matcha Latte' AS name, 'Hot Beverages' AS category, 45.00 AS medium_price, NULL AS large_price
UNION ALL
SELECT 'Salty Cream Coffee' AS name, 'Hot Beverages' AS category, 45.00 AS medium_price, NULL AS large_price
UNION ALL
SELECT 'Spanish Latte' AS name, 'Hot Beverages' AS category, 45.00 AS medium_price, NULL AS large_price
UNION ALL
SELECT 'Salted Caramel' AS name, 'Hot Beverages' AS category, 45.00 AS medium_price, NULL AS large_price
UNION ALL
SELECT 'Vanilla Macchiato' AS name, 'Hot Beverages' AS category, 45.00 AS medium_price, NULL AS large_price
UNION ALL
SELECT 'Vietnamese Coffee' AS name, 'Hot Beverages' AS category, 45.00 AS medium_price, NULL AS large_price
UNION ALL
SELECT 'Salty Cream Coffee' AS name, 'Salty Cream Series' AS category, 45.00 AS medium_price, 55.00 AS large_price
UNION ALL
SELECT 'Salty Cream Matcha' AS name, 'Salty Cream Series' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Salty Cream Ube' AS name, 'Salty Cream Series' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Salty Cream Taro' AS name, 'Salty Cream Series' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Salty Cream Chocolate' AS name, 'Salty Cream Series' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Dirty Avalanche' AS name, 'Iced Blended' AS category, 80.00 AS medium_price, 90.00 AS large_price
UNION ALL
SELECT 'Java Frappe (Coffee Based)' AS name, 'Iced Blended' AS category, 65.00 AS medium_price, 75.00 AS large_price
UNION ALL
SELECT 'Midnight Frappe (Coffee Based)' AS name, 'Iced Blended' AS category, 65.00 AS medium_price, 75.00 AS large_price
UNION ALL
SELECT 'Caramel Frappe (Coffee Based)' AS name, 'Iced Blended' AS category, 65.00 AS medium_price, 75.00 AS large_price
UNION ALL
SELECT 'Avalanche Biscoff' AS name, 'Iced Blended' AS category, 70.00 AS medium_price, 80.00 AS large_price
UNION ALL
SELECT 'Matcha Green Tea' AS name, 'Iced Blended' AS category, 60.00 AS medium_price, 70.00 AS large_price
UNION ALL
SELECT 'Oreo Upside Down Choco' AS name, 'Iced Blended' AS category, 60.00 AS medium_price, 70.00 AS large_price
UNION ALL
SELECT 'Strawberry ANG Cream' AS name, 'Iced Blended' AS category, 60.00 AS medium_price, 70.00 AS large_price
UNION ALL
SELECT 'Ma-Ube Frappe' AS name, 'Iced Blended' AS category, 60.00 AS medium_price, 70.00 AS large_price
UNION ALL
SELECT 'Blueberry and Cream' AS name, 'Iced Blended' AS category, 60.00 AS medium_price, 70.00 AS large_price
UNION ALL
SELECT 'Green Apple' AS name, 'Refresher · Fruit Tea' AS category, 40.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Strawberry' AS name, 'Refresher · Fruit Tea' AS category, 40.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Mixed Berries' AS name, 'Refresher · Fruit Tea' AS category, 40.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Lychee' AS name, 'Refresher · Yakult' AS category, 55.00 AS medium_price, 65.00 AS large_price
UNION ALL
SELECT 'Passion Fruit' AS name, 'Refresher · Yakult' AS category, 55.00 AS medium_price, 65.00 AS large_price
UNION ALL
SELECT 'Orange' AS name, 'Refresher · Yakult' AS category, 55.00 AS medium_price, 65.00 AS large_price
UNION ALL
SELECT 'Lychee' AS name, 'Refresher · Soda' AS category, 60.00 AS medium_price, 70.00 AS large_price
UNION ALL
SELECT 'Passion Fruit' AS name, 'Refresher · Soda' AS category, 60.00 AS medium_price, 70.00 AS large_price
UNION ALL
SELECT 'Orange' AS name, 'Refresher · Soda' AS category, 60.00 AS medium_price, 70.00 AS large_price
UNION ALL
SELECT 'Black Forest' AS name, 'Milktea' AS category, 40.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Red Velvet' AS name, 'Milktea' AS category, 40.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Matcha' AS name, 'Milktea' AS category, 40.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Taro' AS name, 'Milktea' AS category, 40.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Dark Chocolate' AS name, 'Milktea' AS category, 40.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Cookies & Cream' AS name, 'Milktea' AS category, 40.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Caramel Sugar' AS name, 'Milktea' AS category, 40.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Brown Sugar' AS name, 'Milktea' AS category, 40.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Wintermelon' AS name, 'Milktea' AS category, 40.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Chocolate' AS name, 'Milktea' AS category, 40.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Okinawa' AS name, 'Milktea' AS category, 40.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Mango' AS name, 'Milktea' AS category, 40.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Ube' AS name, 'Milktea' AS category, 40.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Red Velvet Cream Cheese' AS name, 'Cream Cheese' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Black Forest Cream Cheese' AS name, 'Cream Cheese' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Cookies & Cream Cream Cheese' AS name, 'Cream Cheese' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Taro Cream Cheese' AS name, 'Cream Cheese' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Matcha CK' AS name, 'Cheesecake Milktea' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Dark Chocolate CK' AS name, 'Cheesecake Milktea' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Chocolate CK' AS name, 'Cheesecake Milktea' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Okinawa CK' AS name, 'Cheesecake Milktea' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Mango CK' AS name, 'Cheesecake Milktea' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Wintermelon CK' AS name, 'Cheesecake Milktea' AS category, 50.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Lemonade' AS name, 'Fresh Lemonade' AS category, 45.00 AS medium_price, 45.00 AS large_price
UNION ALL
SELECT 'Tea Lemonade' AS name, 'Fresh Lemonade' AS category, 45.00 AS medium_price, 45.00 AS large_price
UNION ALL
SELECT 'Strawberry Lemonade' AS name, 'Fresh Lemonade' AS category, 50.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Green Apple Lemonade' AS name, 'Fresh Lemonade' AS category, 50.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Kalamansi Lemonade' AS name, 'Fresh Lemonade' AS category, 50.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Yakult Lemonade' AS name, 'Fresh Lemonade' AS category, 60.00 AS medium_price, 60.00 AS large_price
UNION ALL
SELECT 'Orange Lemonade' AS name, 'Fresh Lemonade' AS category, 50.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Cucumber Lemonade' AS name, 'Fresh Lemonade' AS category, 50.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Watermelon Lemonade' AS name, 'Fresh Lemonade' AS category, 50.00 AS medium_price, 50.00 AS large_price
UNION ALL
SELECT 'Honey Lemonade' AS name, 'Fresh Lemonade' AS category, 50.00 AS medium_price, 50.00 AS large_price
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM products p
  WHERE p.catalog_version=1 AND p.name=seed.name AND p.category=seed.category
);

COMMIT;

-- Verify: should return 107 active menu listings after a clean first import.
SELECT catalog_version, status, COUNT(*) AS products
FROM products
GROUP BY catalog_version, status
ORDER BY catalog_version, status;
