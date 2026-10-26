USE seven_coffee;

-- LOCAL XAMPP TEST ACCOUNT ONLY.
-- Username: admin123
-- Password: 123456
-- Re-running this script resets the password and role for the row with this username.
-- Do not use this known test credential on a public or production deployment.

UPDATE users
SET
  name = 'Admin Test',
  password_hash = '$2y$12$BZ9VgmhMDCIIeAl.6ct2Uem8lOedzIu022CnlKSSS86PXdhFemZoS',
  role = 'owner'
WHERE username = 'admin123';

INSERT INTO users (name, username, email, password_hash, role)
SELECT
  'Admin Test',
  'admin123',
  'admin123@seven.local',
  '$2y$12$BZ9VgmhMDCIIeAl.6ct2Uem8lOedzIu022CnlKSSS86PXdhFemZoS',
  'owner'
WHERE NOT EXISTS (
  SELECT 1 FROM users
  WHERE username = 'admin123' OR email = 'admin123@seven.local'
);

SELECT id, name, username, email, role
FROM users
WHERE username = 'admin123' OR email = 'admin123@seven.local';
