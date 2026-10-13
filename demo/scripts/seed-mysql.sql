-- MySQL FATHOM Demo Database Seed Script
-- ================================================
-- This script creates and populates the FATHOM demo database with realistic sample data
--
-- USAGE: mysql -u root < seed-mysql.sql
-- OR:    mysql -u username -p < seed-mysql.sql
-- OR:    source seed-mysql.sql  (from mysql client prompt)
--
-- CLEANUP: To remove the demo database, run:
--   DROP DATABASE IF EXISTS fathom_demo;
-- ================================================

-- Set session variables for error handling
SET SESSION sql_mode='STRICT_TRANS_TABLES';
SET foreign_key_checks = 0;

-- Drop the database if it exists (for idempotent runs)
DROP DATABASE IF EXISTS fathom_demo;

-- Create the demo database
CREATE DATABASE fathom_demo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Use the newly created database
USE fathom_demo;

-- ================================================
-- TABLES
-- ================================================

-- Customers table
CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  country VARCHAR(100),
  city VARCHAR(100),
  postal_code VARCHAR(20),
  tier ENUM('standard', 'premium', 'vip') DEFAULT 'standard',
  signup_source VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ENGINE=InnoDB
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Products table
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description LONGTEXT,
  category VARCHAR(100) NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  cost DECIMAL(10, 2) CHECK (cost >= 0),
  stock INT DEFAULT 0 CHECK (stock >= 0),
  reorder_level INT DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ENGINE=InnoDB
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orders table
CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
  subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  tax DECIMAL(10, 2) DEFAULT 0 CHECK (tax >= 0),
  status ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') DEFAULT 'pending',
  shipping_address TEXT,
  payment_method VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  shipped_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  ENGINE=InnoDB
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order items table
CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  discount_percent DECIMAL(5, 2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  ENGINE=InnoDB
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inventory table
CREATE TABLE inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  warehouse_name VARCHAR(100),
  quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity INT DEFAULT 0 CHECK (reserved_quantity >= 0),
  reorder_point INT DEFAULT 10,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_product_warehouse (product_id, warehouse_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  ENGINE=InnoDB
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Analytics events table
CREATE TABLE analytics_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  session_id VARCHAR(255),
  event_type VARCHAR(100) NOT NULL,
  event_source VARCHAR(50),
  payload JSON,
  user_agent TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ENGINE=InnoDB
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sessions table
CREATE TABLE sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES customers(id) ON DELETE CASCADE,
  ENGINE=InnoDB
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit log table
CREATE TABLE audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id INT,
  operation ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  old_data JSON,
  new_data JSON,
  performed_by VARCHAR(255),
  change_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ENGINE=InnoDB
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- INDEXES
-- ================================================

-- Customer indexes
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_tier ON customers(tier);
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);
CREATE INDEX idx_customers_country_city ON customers(country, city);

-- Product indexes
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_stock ON products(stock) WHERE stock < reorder_level;

-- Order indexes
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_customer_created ON orders(customer_id, created_at DESC);

-- Order items indexes
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Inventory indexes
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_name);

-- Analytics indexes
CREATE INDEX idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_session_id ON analytics_events(session_id);

-- Sessions indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Audit log indexes
CREATE INDEX idx_audit_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_operation ON audit_log(operation);

-- ================================================
-- INSERT SAMPLE DATA
-- ================================================

-- Insert customers
INSERT INTO customers (name, email, phone, country, city, postal_code, tier, signup_source, created_at)
VALUES
  ('Sarah Chen', 'sarah.chen@email.com', '+1-415-555-0101', 'USA', 'San Francisco', '94103', 'premium', 'referral', DATE_SUB(NOW(), INTERVAL 85 DAY)),
  ('Marcus Johnson', 'marcus.j@email.com', '+1-212-555-0102', 'USA', 'New York', '10001', 'vip', 'direct', DATE_SUB(NOW(), INTERVAL 73 DAY)),
  ('Elena Rodriguez', 'elena.rodriguez@email.com', '+1-305-555-0103', 'USA', 'Miami', '33101', 'standard', 'organic_search', DATE_SUB(NOW(), INTERVAL 62 DAY)),
  ('James Wilson', 'james.wilson@email.com', '+1-206-555-0104', 'USA', 'Seattle', '98101', 'premium', 'ad_campaign', DATE_SUB(NOW(), INTERVAL 51 DAY)),
  ('Priya Sharma', 'priya.sharma@email.com', '+1-408-555-0105', 'USA', 'San Jose', '95110', 'standard', 'referral', DATE_SUB(NOW(), INTERVAL 40 DAY)),
  ('David Thompson', 'david.thompson@email.com', '+1-773-555-0106', 'USA', 'Chicago', '60601', 'vip', 'direct', DATE_SUB(NOW(), INTERVAL 35 DAY)),
  ('Lisa Anderson', 'lisa.anderson@email.com', '+1-512-555-0107', 'USA', 'Austin', '78701', 'premium', 'organic_search', DATE_SUB(NOW(), INTERVAL 28 DAY)),
  ('Robert Martinez', 'robert.martinez@email.com', '+1-619-555-0108', 'USA', 'San Diego', '92101', 'standard', 'ad_campaign', DATE_SUB(NOW(), INTERVAL 18 DAY)),
  ('Jennifer Lee', 'jennifer.lee@email.com', '+1-617-555-0109', 'USA', 'Boston', '02101', 'premium', 'referral', DATE_SUB(NOW(), INTERVAL 12 DAY)),
  ('Christopher Brown', 'christopher.brown@email.com', '+1-404-555-0110', 'USA', 'Atlanta', '30303', 'standard', 'organic_search', DATE_SUB(NOW(), INTERVAL 8 DAY)),
  ('Amanda White', 'amanda.white@email.com', '+44-20-7946-0958', 'UK', 'London', 'SW1A 1AA', 'premium', 'direct', DATE_SUB(NOW(), INTERVAL 75 DAY)),
  ('Michael Chen', 'michael.chen@email.com', '+61-2-8962-8111', 'Australia', 'Sydney', '2000', 'vip', 'referral', DATE_SUB(NOW(), INTERVAL 65 DAY)),
  ('Sophie Dubois', 'sophie.dubois@email.com', '+33-1-42-34-56-00', 'France', 'Paris', '75001', 'standard', 'organic_search', DATE_SUB(NOW(), INTERVAL 55 DAY)),
  ('Thomas Mueller', 'thomas.mueller@email.com', '+49-30-318-12934', 'Germany', 'Berlin', '10115', 'premium', 'ad_campaign', DATE_SUB(NOW(), INTERVAL 44 DAY)),
  ('Isabella Romano', 'isabella.romano@email.com', '+39-06-6991-7676', 'Italy', 'Rome', '00100', 'standard', 'referral', DATE_SUB(NOW(), INTERVAL 33 DAY)),
  ('Carlos Garcia', 'carlos.garcia@email.com', '+34-91-123-4567', 'Spain', 'Madrid', '28001', 'premium', 'direct', DATE_SUB(NOW(), INTERVAL 22 DAY)),
  ('Yuki Tanaka', 'yuki.tanaka@email.com', '+81-3-1234-5678', 'Japan', 'Tokyo', '100-0001', 'vip', 'organic_search', DATE_SUB(NOW(), INTERVAL 14 DAY)),
  ('Nina Patel', 'nina.patel@email.com', '+91-22-1234-5678', 'India', 'Mumbai', '400001', 'standard', 'ad_campaign', DATE_SUB(NOW(), INTERVAL 9 DAY)),
  ('Lucas Silva', 'lucas.silva@email.com', '+55-11-1234-5678', 'Brazil', 'Sao Paulo', '01310-100', 'premium', 'referral', DATE_SUB(NOW(), INTERVAL 5 DAY)),
  ('Zoe Nakamura', 'zoe.nakamura@email.com', '+1-310-555-0120', 'USA', 'Los Angeles', '90001', 'standard', 'organic_search', DATE_SUB(NOW(), INTERVAL 2 DAY));

-- Insert products
INSERT INTO products (name, description, category, sku, price, cost, stock, reorder_level, created_at)
VALUES
  ('Wireless Bluetooth Headphones', 'Premium noise-cancelling headphones with 30-hour battery life', 'Electronics', 'WBH-001', 129.99, 45.00, 145, 20, DATE_SUB(NOW(), INTERVAL 90 DAY)),
  ('USB-C Lightning Cable', 'High-speed charging and data transfer cable, 6ft length', 'Accessories', 'USB-C-001', 19.99, 4.50, 523, 50, DATE_SUB(NOW(), INTERVAL 85 DAY)),
  ('Mechanical Keyboard', 'RGB mechanical keyboard with hot-swappable switches', 'Electronics', 'MKB-001', 89.99, 35.00, 87, 15, DATE_SUB(NOW(), INTERVAL 80 DAY)),
  ('4K Webcam', 'Ultra HD webcam with auto-focus and built-in microphone', 'Electronics', 'WEBCAM-001', 149.99, 60.00, 52, 10, DATE_SUB(NOW(), INTERVAL 75 DAY)),
  ('Portable SSD 1TB', 'Fast external solid state drive with USB-C 3.1', 'Storage', 'SSD-1TB-001', 179.99, 80.00, 98, 15, DATE_SUB(NOW(), INTERVAL 70 DAY)),
  ('Ergonomic Mouse Pad', 'Memory foam wrist rest mouse pad with non-slip base', 'Accessories', 'MOUSEPAD-001', 24.99, 8.00, 287, 40, DATE_SUB(NOW(), INTERVAL 65 DAY)),
  ('USB Hub 7-Port', 'Multi-port USB hub with individual switches and power adapter', 'Electronics', 'USBHUB-001', 39.99, 15.00, 156, 20, DATE_SUB(NOW(), INTERVAL 60 DAY)),
  ('Laptop Stand Aluminum', 'Adjustable laptop stand with cooling ventilation', 'Accessories', 'LAPSTAND-001', 44.99, 18.00, 201, 25, DATE_SUB(NOW(), INTERVAL 55 DAY)),
  ('Wireless Mouse', 'Quiet wireless mouse with 2.4GHz receiver and 18-month battery', 'Electronics', 'WMOUSE-001', 34.99, 12.00, 334, 30, DATE_SUB(NOW(), INTERVAL 50 DAY)),
  ('Screen Protector Pack', 'Anti-glare screen protectors for 15.6-inch laptops (5-pack)', 'Accessories', 'SCRPROT-001', 14.99, 3.00, 412, 50, DATE_SUB(NOW(), INTERVAL 45 DAY)),
  ('USB-A to USB-C Adapter', 'Compact USB-A to USB-C converter with data support', 'Accessories', 'ADAPTER-001', 12.99, 2.50, 654, 75, DATE_SUB(NOW(), INTERVAL 40 DAY)),
  ('Desk Lamp LED', 'Adjustable LED desk lamp with USB charging port', 'Accessories', 'LAMP-001', 54.99, 22.00, 143, 18, DATE_SUB(NOW(), INTERVAL 35 DAY)),
  ('External Hard Drive 2TB', 'Portable 2TB external HDD with USB 3.0', 'Storage', 'HDD-2TB-001', 89.99, 40.00, 76, 12, DATE_SUB(NOW(), INTERVAL 30 DAY)),
  ('Phone Stand', 'Adjustable phone stand compatible with all devices', 'Accessories', 'PHSTAND-001', 16.99, 5.00, 445, 60, DATE_SUB(NOW(), INTERVAL 25 DAY)),
  ('HDMI Cable 2.1', 'High-speed HDMI 2.1 cable supporting 8K resolution, 6ft', 'Accessories', 'HDMI-001', 22.99, 6.00, 287, 35, DATE_SUB(NOW(), INTERVAL 20 DAY)),
  ('Wireless Charging Pad', '15W wireless charging pad with non-slip surface', 'Electronics', 'WIRELESS-001', 29.99, 10.00, 198, 25, DATE_SUB(NOW(), INTERVAL 15 DAY)),
  ('Monitor Light Bar', 'E-ink display light bar that reduces eye strain', 'Electronics', 'LIGHTBAR-001', 99.99, 45.00, 64, 10, DATE_SUB(NOW(), INTERVAL 10 DAY)),
  ('Cable Organizer Set', 'Set of 8 velcro cable organizers in various sizes', 'Accessories', 'CABLEORG-001', 11.99, 2.50, 521, 60, DATE_SUB(NOW(), INTERVAL 5 DAY)),
  ('Mechanical Numpad', 'Compact mechanical numpad with RGB lighting', 'Electronics', 'NUMPAD-001', 59.99, 25.00, 94, 12, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  ('Privacy Screen Filter', '14-inch privacy screen filter for laptop displays', 'Accessories', 'PRIVACY-001', 39.99, 15.00, 87, 15, DATE_SUB(NOW(), INTERVAL 1 DAY));

-- Insert orders
INSERT INTO orders (customer_id, order_number, total, subtotal, tax, status, shipping_address, payment_method, created_at, shipped_at, delivered_at)
VALUES
  (1, 'ORD-2026-0001', 149.98, 129.98, 20.00, 'delivered', '123 Market St, San Francisco, CA 94103', 'credit_card', DATE_SUB(NOW(), INTERVAL 80 DAY), DATE_SUB(NOW(), INTERVAL 77 DAY), DATE_SUB(NOW(), INTERVAL 74 DAY)),
  (2, 'ORD-2026-0002', 209.98, 189.98, 20.00, 'delivered', '456 Broadway, New York, NY 10001', 'credit_card', DATE_SUB(NOW(), INTERVAL 70 DAY), DATE_SUB(NOW(), INTERVAL 68 DAY), DATE_SUB(NOW(), INTERVAL 64 DAY)),
  (3, 'ORD-2026-0003', 89.97, 79.97, 10.00, 'delivered', '789 Ocean Dr, Miami, FL 33101', 'paypal', DATE_SUB(NOW(), INTERVAL 60 DAY), DATE_SUB(NOW(), INTERVAL 57 DAY), DATE_SUB(NOW(), INTERVAL 54 DAY)),
  (4, 'ORD-2026-0004', 299.96, 269.96, 30.00, 'shipped', '321 Pike St, Seattle, WA 98101', 'credit_card', DATE_SUB(NOW(), INTERVAL 45 DAY), DATE_SUB(NOW(), INTERVAL 42 DAY), NULL),
  (5, 'ORD-2026-0005', 124.97, 109.97, 15.00, 'processing', '654 Park Ave, San Jose, CA 95110', 'debit_card', DATE_SUB(NOW(), INTERVAL 30 DAY), NULL, NULL),
  (6, 'ORD-2026-0006', 179.98, 159.98, 20.00, 'delivered', '987 Michigan Ave, Chicago, IL 60601', 'credit_card', DATE_SUB(NOW(), INTERVAL 25 DAY), DATE_SUB(NOW(), INTERVAL 23 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY)),
  (7, 'ORD-2026-0007', 89.97, 79.97, 10.00, 'delivered', '321 Congress Ave, Austin, TX 78701', 'paypal', DATE_SUB(NOW(), INTERVAL 18 DAY), DATE_SUB(NOW(), INTERVAL 16 DAY), DATE_SUB(NOW(), INTERVAL 14 DAY)),
  (8, 'ORD-2026-0008', 209.97, 189.97, 20.00, 'processing', '654 Harbor St, San Diego, CA 92101', 'credit_card', DATE_SUB(NOW(), INTERVAL 12 DAY), NULL, NULL),
  (9, 'ORD-2026-0009', 159.96, 139.96, 20.00, 'confirmed', '987 Newbury St, Boston, MA 02101', 'credit_card', DATE_SUB(NOW(), INTERVAL 8 DAY), NULL, NULL),
  (10, 'ORD-2026-0010', 94.98, 84.98, 10.00, 'delivered', '321 West Peachtree, Atlanta, GA 30303', 'debit_card', DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (11, 'ORD-2026-0011', 249.97, 219.97, 30.00, 'delivered', 'Baker St 123, London, SW1A 1AA', 'credit_card', DATE_SUB(NOW(), INTERVAL 70 DAY), DATE_SUB(NOW(), INTERVAL 68 DAY), DATE_SUB(NOW(), INTERVAL 64 DAY)),
  (12, 'ORD-2026-0012', 134.99, 119.99, 15.00, 'cancelled', 'George St 456, Sydney, 2000', 'paypal', DATE_SUB(NOW(), INTERVAL 60 DAY), NULL, NULL),
  (13, 'ORD-2026-0013', 169.98, 149.98, 20.00, 'delivered', 'Rue de Rivoli 789, Paris, 75001', 'credit_card', DATE_SUB(NOW(), INTERVAL 50 DAY), DATE_SUB(NOW(), INTERVAL 48 DAY), DATE_SUB(NOW(), INTERVAL 45 DAY)),
  (14, 'ORD-2026-0014', 99.98, 89.98, 10.00, 'shipped', 'Unter den Linden 321, Berlin, 10115', 'credit_card', DATE_SUB(NOW(), INTERVAL 40 DAY), DATE_SUB(NOW(), INTERVAL 38 DAY), NULL),
  (15, 'ORD-2026-0015', 209.97, 189.97, 20.00, 'delivered', 'Via dei Fori Imperiali 654, Rome, 00100', 'debit_card', DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 28 DAY), DATE_SUB(NOW(), INTERVAL 25 DAY)),
  (16, 'ORD-2026-0016', 129.98, 119.98, 10.00, 'processing', 'Gran Via 987, Madrid, 28001', 'credit_card', DATE_SUB(NOW(), INTERVAL 20 DAY), NULL, NULL),
  (17, 'ORD-2026-0017', 299.97, 269.97, 30.00, 'confirmed', 'Chiyoda Ward 321, Tokyo, 100-0001', 'credit_card', DATE_SUB(NOW(), INTERVAL 12 DAY), NULL, NULL),
  (18, 'ORD-2026-0018', 89.99, 79.99, 10.00, 'delivered', 'Colaba Causeway 654, Mumbai, 400001', 'paypal', DATE_SUB(NOW(), INTERVAL 8 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY)),
  (19, 'ORD-2026-0019', 159.98, 139.98, 20.00, 'shipped', 'Av Paulista 987, Sao Paulo, 01310-100', 'credit_card', DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), NULL),
  (20, 'ORD-2026-0020', 129.97, 109.97, 20.00, 'pending', 'Sunset Blvd 321, Los Angeles, CA 90001', 'debit_card', DATE_SUB(NOW(), INTERVAL 1 DAY), NULL, NULL);

-- Insert order items
INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_percent)
VALUES
  (1, 1, 1, 129.99, 0),
  (2, 3, 1, 89.99, 10),
  (2, 6, 2, 24.99, 0),
  (3, 2, 4, 19.99, 0),
  (4, 5, 1, 179.99, 5),
  (4, 4, 1, 149.99, 0),
  (5, 11, 5, 12.99, 15),
  (6, 9, 2, 34.99, 0),
  (6, 10, 3, 14.99, 0),
  (7, 2, 4, 19.99, 0),
  (8, 7, 2, 39.99, 10),
  (8, 8, 1, 44.99, 0),
  (9, 13, 1, 89.99, 0),
  (9, 6, 2, 24.99, 10),
  (10, 14, 3, 16.99, 0),
  (11, 5, 1, 179.99, 0),
  (11, 2, 2, 19.99, 5),
  (12, 3, 1, 89.99, 0),
  (13, 1, 1, 129.99, 0),
  (13, 10, 4, 14.99, 0);

-- Insert inventory
INSERT INTO inventory (product_id, warehouse_id, warehouse_name, quantity, reserved_quantity, reorder_point, updated_at)
VALUES
  (1, 1, 'San Francisco', 45, 8, 20, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (1, 2, 'Chicago', 52, 12, 20, DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (1, 3, 'New York', 48, 10, 20, DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (2, 1, 'San Francisco', 187, 25, 50, DATE_SUB(NOW(), INTERVAL '2:00' HOUR_MINUTE)),
  (2, 2, 'Chicago', 193, 30, 50, DATE_SUB(NOW(), INTERVAL '4:00' HOUR_MINUTE)),
  (2, 3, 'New York', 143, 20, 50, DATE_SUB(NOW(), INTERVAL '1:00' HOUR_MINUTE)),
  (3, 1, 'San Francisco', 28, 5, 15, DATE_SUB(NOW(), INTERVAL 5 DAY)),
  (3, 2, 'Chicago', 31, 8, 15, DATE_SUB(NOW(), INTERVAL 6 DAY)),
  (3, 3, 'New York', 28, 6, 15, DATE_SUB(NOW(), INTERVAL 4 DAY)),
  (4, 1, 'San Francisco', 18, 3, 10, DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (4, 2, 'Chicago', 21, 4, 10, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (4, 3, 'New York', 13, 2, 10, NOW()),
  (5, 1, 'San Francisco', 34, 8, 15, DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (5, 2, 'Chicago', 38, 10, 15, DATE_SUB(NOW(), INTERVAL 4 DAY)),
  (5, 3, 'New York', 26, 5, 15, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (6, 1, 'San Francisco', 95, 15, 40, DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (6, 2, 'Chicago', 102, 18, 40, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (6, 3, 'New York', 90, 12, 40, NOW()),
  (7, 1, 'San Francisco', 52, 8, 20, DATE_SUB(NOW(), INTERVAL 4 DAY)),
  (7, 2, 'Chicago', 58, 12, 20, DATE_SUB(NOW(), INTERVAL 5 DAY));

-- Insert analytics events
INSERT INTO analytics_events (user_id, session_id, event_type, event_source, payload, user_agent, created_at)
VALUES
  (1, 'sess_001_sf', 'page_view', 'web', JSON_OBJECT('page', '/products', 'referrer', '/home'), 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', DATE_SUB(NOW(), INTERVAL 89 DAY)),
  (2, 'sess_002_ny', 'add_to_cart', 'web', JSON_OBJECT('product_id', 1, 'quantity', 1, 'price', 129.99), 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', DATE_SUB(NOW(), INTERVAL 88 DAY)),
  (3, 'sess_003_mi', 'checkout_start', 'web', JSON_OBJECT('cart_value', 89.97, 'items', 4), 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)', DATE_SUB(NOW(), INTERVAL 87 DAY)),
  (4, 'sess_004_se', 'purchase', 'web', JSON_OBJECT('order_id', 'ORD-2026-0001', 'total', 149.98, 'currency', 'USD'), 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36', DATE_SUB(NOW(), INTERVAL 86 DAY)),
  (5, 'sess_005_sj', 'page_view', 'mobile_app', JSON_OBJECT('page', '/my_orders', 'platform', 'ios'), 'Mobile Safari 14.1', DATE_SUB(NOW(), INTERVAL 85 DAY)),
  (1, 'sess_006_sf', 'search', 'web', JSON_OBJECT('query', 'wireless headphones', 'results', 12), 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', DATE_SUB(NOW(), INTERVAL 84 DAY)),
  (2, 'sess_007_ny', 'product_view', 'web', JSON_OBJECT('product_id', 3, 'category', 'Electronics'), 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', DATE_SUB(NOW(), INTERVAL 83 DAY)),
  (6, 'sess_008_ch', 'add_to_wishlist', 'web', JSON_OBJECT('product_id', 5, 'product_name', 'Portable SSD 1TB'), 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', DATE_SUB(NOW(), INTERVAL 82 DAY)),
  (7, 'sess_009_au', 'page_view', 'web', JSON_OBJECT('page', '/categories/electronics'), 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X)', DATE_SUB(NOW(), INTERVAL 81 DAY)),
  (8, 'sess_010_sd', 'cart_view', 'web', JSON_OBJECT('items', 3, 'total_value', 209.97), 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', DATE_SUB(NOW(), INTERVAL 80 DAY));

-- Insert sessions
INSERT INTO sessions (user_id, token, ip_address, user_agent, last_activity, expires_at, created_at)
VALUES
  (1, 'token_sf_001_abc123def456', '192.168.1.101', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 24 HOUR), DATE_SUB(NOW(), INTERVAL 2 HOUR)),
  (2, 'token_ny_002_ghi789jkl012', '203.0.113.45', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', DATE_SUB(NOW(), INTERVAL 30 MINUTE), DATE_ADD(NOW(), INTERVAL 24 HOUR), DATE_SUB(NOW(), INTERVAL 45 MINUTE)),
  (3, 'token_mi_003_mno345pqr678', '198.51.100.89', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6)', DATE_SUB(NOW(), INTERVAL 10 MINUTE), DATE_ADD(NOW(), INTERVAL 24 HOUR), DATE_SUB(NOW(), INTERVAL 15 MINUTE)),
  (4, 'token_se_004_stu901vwx234', '192.0.2.123', 'Mozilla/5.0 (X11; Linux x86_64)', DATE_SUB(NOW(), INTERVAL 5 MINUTE), DATE_ADD(NOW(), INTERVAL 24 HOUR), DATE_SUB(NOW(), INTERVAL 6 MINUTE)),
  (5, 'token_sj_005_yza567bcd890', '203.0.113.200', 'Mobile Safari 14.1', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_ADD(NOW(), INTERVAL 24 HOUR), DATE_SUB(NOW(), INTERVAL 3 HOUR)),
  (6, 'token_ch_006_efg234hij567', '198.51.100.44', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', DATE_SUB(NOW(), INTERVAL 4 HOUR), DATE_ADD(NOW(), INTERVAL 24 HOUR), DATE_SUB(NOW(), INTERVAL 5 HOUR)),
  (7, 'token_au_007_klm890nop123', '192.0.2.67', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_1)', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 24 HOUR), DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (8, 'token_sd_008_qrs456tuv789', '203.0.113.78', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (9, 'token_bo_009_wxy012zab345', '198.51.100.12', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (10, 'token_at_010_cde678fgh901', '192.0.2.155', 'Mobile Safari Android', DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 4 HOUR), DATE_SUB(NOW(), INTERVAL 4 DAY));

-- Insert audit log entries
INSERT INTO audit_log (table_name, record_id, operation, old_data, new_data, performed_by, change_reason, created_at)
VALUES
  ('orders', 1, 'INSERT', NULL, JSON_OBJECT('id', 1, 'customer_id', 1, 'status', 'pending', 'total', 149.98), 'system', 'Order creation', DATE_SUB(NOW(), INTERVAL 80 DAY)),
  ('orders', 1, 'UPDATE', JSON_OBJECT('status', 'pending'), JSON_OBJECT('status', 'confirmed'), 'admin_user', 'Order confirmation', DATE_SUB(NOW(), INTERVAL 79 DAY)),
  ('customers', 1, 'UPDATE', JSON_OBJECT('tier', 'standard'), JSON_OBJECT('tier', 'premium'), 'system', 'Tier upgrade based on purchase history', DATE_SUB(NOW(), INTERVAL 75 DAY)),
  ('products', 1, 'UPDATE', JSON_OBJECT('stock', 150), JSON_OBJECT('stock', 145), 'system', 'Inventory adjustment - sales', DATE_SUB(NOW(), INTERVAL 74 DAY)),
  ('orders', 2, 'INSERT', NULL, JSON_OBJECT('id', 2, 'customer_id', 2, 'status', 'pending', 'total', 209.98), 'system', 'Order creation', DATE_SUB(NOW(), INTERVAL 70 DAY));

-- ================================================
-- VIEWS
-- ================================================

-- Customer Orders View
CREATE VIEW vw_customer_orders AS
SELECT
  c.id AS customer_id,
  c.name AS customer_name,
  c.email,
  c.tier,
  o.id AS order_id,
  o.order_number,
  o.total,
  o.status,
  o.created_at
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
ORDER BY o.created_at DESC;

-- Product Performance View
CREATE VIEW vw_product_performance AS
SELECT
  p.id,
  p.name,
  p.category,
  p.price,
  SUM(oi.quantity) AS units_sold,
  SUM(oi.quantity * oi.unit_price) AS total_revenue,
  AVG(CASE WHEN oi.discount_percent > 0 THEN oi.discount_percent ELSE NULL END) AS avg_discount,
  COUNT(DISTINCT oi.order_id) AS order_count
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
GROUP BY p.id, p.name, p.category, p.price
ORDER BY total_revenue DESC;

-- ================================================
-- STORED PROCEDURES
-- ================================================

DELIMITER $$

-- Stored procedure: Daily summary
CREATE PROCEDURE sp_daily_summary(IN summary_date DATE)
BEGIN
  SELECT
    COUNT(DISTINCT customer_id) AS new_customers,
    COUNT(DISTINCT CASE WHEN status IN ('delivered', 'shipped') THEN id END) AS orders_processed,
    SUM(CASE WHEN status IN ('delivered', 'shipped') THEN total ELSE 0 END) AS revenue,
    DATE(created_at) AS summary_date
  FROM orders
  WHERE DATE(created_at) = summary_date;
END$$

-- Stored procedure: Clean expired sessions
CREATE PROCEDURE sp_cleanup_sessions()
BEGIN
  DELETE FROM sessions
  WHERE expires_at < NOW();

  SELECT ROW_COUNT() AS deleted_sessions;
END$$

-- Stored procedure: Customer order summary
CREATE PROCEDURE sp_customer_order_summary(IN customer_id INT)
BEGIN
  SELECT
    c.name,
    COUNT(o.id) AS total_orders,
    SUM(CASE WHEN o.status NOT IN ('cancelled', 'refunded') THEN o.total ELSE 0 END) AS lifetime_value,
    MAX(o.created_at) AS last_order_date
  FROM customers c
  LEFT JOIN orders o ON c.id = o.customer_id
  WHERE c.id = customer_id
  GROUP BY c.id, c.name;
END$$

DELIMITER ;

-- ================================================
-- TRIGGERS
-- ================================================

DELIMITER $$

-- Trigger: Update order timestamp on audit
CREATE TRIGGER trg_audit_orders_insert AFTER INSERT ON orders
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (table_name, record_id, operation, new_data, performed_by, created_at)
  VALUES ('orders', NEW.id, 'INSERT', JSON_OBJECT('order_number', NEW.order_number, 'customer_id', NEW.customer_id, 'status', NEW.status), 'system', NOW());
END$$

CREATE TRIGGER trg_audit_orders_update AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
  IF OLD.status != NEW.status OR OLD.total != NEW.total THEN
    INSERT INTO audit_log (table_name, record_id, operation, old_data, new_data, performed_by, created_at)
    VALUES ('orders', NEW.id, 'UPDATE', JSON_OBJECT('status', OLD.status), JSON_OBJECT('status', NEW.status), 'system', NOW());
  END IF;
END$$

-- Trigger: Update product stock on order item insert
CREATE TRIGGER trg_update_stock_on_order AFTER INSERT ON order_items
FOR EACH ROW
BEGIN
  UPDATE products
  SET stock = stock - NEW.quantity
  WHERE id = NEW.product_id;
END$$

DELIMITER ;

-- ================================================
-- EVENTS (Scheduled Tasks)
-- ================================================

-- Create event for daily cleanup
CREATE EVENT evt_daily_cleanup
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
  CALL sp_cleanup_sessions();

-- ================================================
-- CREATE APPLICATION USER
-- ================================================

-- Create application user with limited privileges
CREATE USER IF NOT EXISTS 'fathom_user'@'localhost' IDENTIFIED BY 'fathom_demo_password_123';
GRANT SELECT, INSERT, UPDATE ON fathom_demo.* TO 'fathom_user'@'localhost';
GRANT EXECUTE ON PROCEDURE fathom_demo.sp_daily_summary TO 'fathom_user'@'localhost';
GRANT EXECUTE ON PROCEDURE fathom_demo.sp_cleanup_sessions TO 'fathom_user'@'localhost';
GRANT EXECUTE ON PROCEDURE fathom_user@'localhost' IDENTIFIED BY 'fathom_demo_password_123';

-- Create read-only user for analytics
CREATE USER IF NOT EXISTS 'fathom_readonly'@'localhost' IDENTIFIED BY 'fathom_readonly_password_123';
GRANT SELECT ON fathom_demo.* TO 'fathom_readonly'@'localhost';

-- Flush privileges
FLUSH PRIVILEGES;

-- ================================================
-- SCRIPT COMPLETION
-- ================================================

-- Display summary statistics
SELECT '=========================================' AS status;
SELECT 'FATHOM Demo Database Created Successfully' AS status;
SELECT '=========================================' AS status;
SELECT '' AS blank;

SELECT 'Customers' AS entity, COUNT(*) AS count FROM customers
UNION ALL
SELECT 'Products' AS entity, COUNT(*) AS count FROM products
UNION ALL
SELECT 'Orders' AS entity, COUNT(*) AS count FROM orders
UNION ALL
SELECT 'Order Items' AS entity, COUNT(*) AS count FROM order_items
UNION ALL
SELECT 'Inventory Records' AS entity, COUNT(*) AS count FROM inventory
UNION ALL
SELECT 'Analytics Events' AS entity, COUNT(*) AS count FROM analytics_events
UNION ALL
SELECT 'Sessions' AS entity, COUNT(*) AS count FROM sessions
UNION ALL
SELECT 'Audit Log Entries' AS entity, COUNT(*) AS count FROM audit_log;

SELECT '' AS blank;
SELECT 'Database fathom_demo is ready for testing!' AS status;
SELECT 'Connect as fathom_user with: mysql -u fathom_user -p fathom_demo' AS connection_info;
SELECT '' AS blank;
