-- Creates the MySQL database and application user for the BnB management system.
-- Run once as an admin user:  mysql -u root -p < database/create_database.sql
-- Then change the password below and put the same value in backend/.env (DB_PASSWORD).

CREATE DATABASE IF NOT EXISTS bnb_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'bnb_user'@'localhost' IDENTIFIED BY 'change-me';
CREATE USER IF NOT EXISTS 'bnb_user'@'127.0.0.1' IDENTIFIED BY 'change-me';

GRANT ALL PRIVILEGES ON bnb_management.* TO 'bnb_user'@'localhost';
GRANT ALL PRIVILEGES ON bnb_management.* TO 'bnb_user'@'127.0.0.1';
-- Lets Django create its throwaway test database when running `python manage.py test`.
GRANT ALL PRIVILEGES ON test_bnb_management.* TO 'bnb_user'@'localhost';
GRANT ALL PRIVILEGES ON test_bnb_management.* TO 'bnb_user'@'127.0.0.1';

FLUSH PRIVILEGES;
