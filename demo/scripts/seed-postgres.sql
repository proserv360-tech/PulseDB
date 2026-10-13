-- PostgreSQL FATHOM Demo Database Seed Script
-- ================================================
-- This script creates and populates the FATHOM demo database with realistic sample data
--
-- USAGE: psql -f seed-postgres.sql
-- OR:    psql -U username -d postgres -f seed-postgres.sql
--
-- CLEANUP: To remove the demo database, run:
--   DROP DATABASE IF EXISTS fathom_demo;
-- ================================================

-- Ensure we're connected to the right database (postgres)
\c postgres

-- Drop the database if it exists (for idempotent runs)
DROP DATABASE IF EXISTS fathom_demo;

-- Create the demo database
CREATE DATABASE fathom_demo
  WITH
  ENCODING 'UTF8'
  LC_COLLATE = 'en_US.UTF-8'
  LC_CTYPE = 'en_US.UTF-8'
  TEMPLATE = template0;

-- Connect to the newly created database
\c fathom_demo

-- Create the demo schema
CREATE SCHEMA IF NOT EXISTS demo;

-- ================================================
-- TABLES
-- ================================================

-- Customers table
CREATE TABLE demo.customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  country VARCHAR(100),
  city VARCHAR(100),
  postal_code VARCHAR(20),
  tier VARCHAR(50) DEFAULT 'standard' CHECK (tier IN ('standard', 'premium', 'vip')),
  signup_source VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE demo.products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  cost NUMERIC(10, 2) CHECK (cost >= 0),
  stock INTEGER DEFAULT 0 CHECK (stock >= 0),
  reorder_level INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE demo.orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES demo.customers(id) ON DELETE CASCADE,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  tax NUMERIC(10, 2) DEFAULT 0 CHECK (tax >= 0),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  shipping_address TEXT,
  payment_method VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items table
CREATE TABLE demo.order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES demo.orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES demo.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  discount_percent NUMERIC(5, 2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory table
CREATE TABLE demo.inventory (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES demo.products(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL,
  warehouse_name VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0),
  reorder_point INTEGER DEFAULT 10,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics events table
CREATE TABLE demo.analytics_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  session_id VARCHAR(255),
  event_type VARCHAR(100) NOT NULL,
  event_source VARCHAR(50),
  payload JSONB,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE demo.sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES demo.customers(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE demo.audit_log (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id INTEGER,
  operation VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  performed_by VARCHAR(255),
  change_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- INDEXES
-- ================================================

-- Customer indexes
CREATE INDEX idx_customers_email ON demo.customers(email);
CREATE INDEX idx_customers_tier ON demo.customers(tier);
CREATE INDEX idx_customers_created_at ON demo.customers(created_at DESC);
CREATE INDEX idx_customers_country_city ON demo.customers(country, city);

-- Product indexes
CREATE INDEX idx_products_category ON demo.products(category);
CREATE INDEX idx_products_sku ON demo.products(sku);
CREATE INDEX idx_products_created_at ON demo.products(created_at DESC);
CREATE INDEX idx_products_stock ON demo.products(stock) WHERE stock < reorder_level;

-- Order indexes
CREATE INDEX idx_orders_customer_id ON demo.orders(customer_id);
CREATE INDEX idx_orders_status ON demo.orders(status);
CREATE INDEX idx_orders_created_at ON demo.orders(created_at DESC);
CREATE INDEX idx_orders_number ON demo.orders(order_number);
CREATE INDEX idx_orders_customer_created ON demo.orders(customer_id, created_at DESC);

-- Order items indexes
CREATE INDEX idx_order_items_order_id ON demo.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON demo.order_items(product_id);

-- Inventory indexes
CREATE UNIQUE INDEX idx_inventory_product_warehouse ON demo.inventory(product_id, warehouse_id);
CREATE INDEX idx_inventory_low_stock ON demo.inventory(warehouse_name) WHERE quantity < reorder_point;

-- Analytics indexes
CREATE INDEX idx_analytics_user_id ON demo.analytics_events(user_id);
CREATE INDEX idx_analytics_event_type ON demo.analytics_events(event_type);
CREATE INDEX idx_analytics_created_at ON demo.analytics_events(created_at DESC);
CREATE INDEX idx_analytics_session_id ON demo.analytics_events(session_id);
CREATE INDEX idx_analytics_payload ON demo.analytics_events USING GIN(payload);

-- Sessions indexes
CREATE INDEX idx_sessions_user_id ON demo.sessions(user_id);
CREATE INDEX idx_sessions_token ON demo.sessions(token);
CREATE INDEX idx_sessions_expires_at ON demo.sessions(expires_at);

-- Audit log indexes
CREATE INDEX idx_audit_table_name ON demo.audit_log(table_name);
CREATE INDEX idx_audit_created_at ON demo.audit_log(created_at DESC);
CREATE INDEX idx_audit_operation ON demo.audit_log(operation);

-- ================================================
-- INSERT SAMPLE DATA
-- ================================================

-- Insert customers
INSERT INTO demo.customers (name, email, phone, country, city, postal_code, tier, signup_source, created_at)
VALUES
  ('Sarah Chen', 'sarah.chen@email.com', '+1-415-555-0101', 'USA', 'San Francisco', '94103', 'premium', 'referral', CURRENT_TIMESTAMP - INTERVAL '85 days'),
  ('Marcus Johnson', 'marcus.j@email.com', '+1-212-555-0102', 'USA', 'New York', '10001', 'vip', 'direct', CURRENT_TIMESTAMP - INTERVAL '73 days'),
  ('Elena Rodriguez', 'elena.rodriguez@email.com', '+1-305-555-0103', 'USA', 'Miami', '33101', 'standard', 'organic_search', CURRENT_TIMESTAMP - INTERVAL '62 days'),
  ('James Wilson', 'james.wilson@email.com', '+1-206-555-0104', 'USA', 'Seattle', '98101', 'premium', 'ad_campaign', CURRENT_TIMESTAMP - INTERVAL '51 days'),
  ('Priya Sharma', 'priya.sharma@email.com', '+1-408-555-0105', 'USA', 'San Jose', '95110', 'standard', 'referral', CURRENT_TIMESTAMP - INTERVAL '40 days'),
  ('David Thompson', 'david.thompson@email.com', '+1-773-555-0106', 'USA', 'Chicago', '60601', 'vip', 'direct', CURRENT_TIMESTAMP - INTERVAL '35 days'),
  ('Lisa Anderson', 'lisa.anderson@email.com', '+1-512-555-0107', 'USA', 'Austin', '78701', 'premium', 'organic_search', CURRENT_TIMESTAMP - INTERVAL '28 days'),
  ('Robert Martinez', 'robert.martinez@email.com', '+1-619-555-0108', 'USA', 'San Diego', '92101', 'standard', 'ad_campaign', CURRENT_TIMESTAMP - INTERVAL '18 days'),
  ('Jennifer Lee', 'jennifer.lee@email.com', '+1-617-555-0109', 'USA', 'Boston', '02101', 'premium', 'referral', CURRENT_TIMESTAMP - INTERVAL '12 days'),
  ('Christopher Brown', 'christopher.brown@email.com', '+1-404-555-0110', 'USA', 'Atlanta', '30303', 'standard', 'organic_search', CURRENT_TIMESTAMP - INTERVAL '8 days'),
  ('Amanda White', 'amanda.white@email.com', '+44-20-7946-0958', 'UK', 'London', 'SW1A 1AA', 'premium', 'direct', CURRENT_TIMESTAMP - INTERVAL '75 days'),
  ('Michael Chen', 'michael.chen@email.com', '+61-2-8962-8111', 'Australia', 'Sydney', '2000', 'vip', 'referral', CURRENT_TIMESTAMP - INTERVAL '65 days'),
  ('Sophie Dubois', 'sophie.dubois@email.com', '+33-1-42-34-56-00', 'France', 'Paris', '75001', 'standard', 'organic_search', CURRENT_TIMESTAMP - INTERVAL '55 days'),
  ('Thomas Mueller', 'thomas.mueller@email.com', '+49-30-318-12934', 'Germany', 'Berlin', '10115', 'premium', 'ad_campaign', CURRENT_TIMESTAMP - INTERVAL '44 days'),
  ('Isabella Romano', 'isabella.romano@email.com', '+39-06-6991-7676', 'Italy', 'Rome', '00100', 'standard', 'referral', CURRENT_TIMESTAMP - INTERVAL '33 days'),
  ('Carlos Garcia', 'carlos.garcia@email.com', '+34-91-123-4567', 'Spain', 'Madrid', '28001', 'premium', 'direct', CURRENT_TIMESTAMP - INTERVAL '22 days'),
  ('Yuki Tanaka', 'yuki.tanaka@email.com', '+81-3-1234-5678', 'Japan', 'Tokyo', '100-0001', 'vip', 'organic_search', CURRENT_TIMESTAMP - INTERVAL '14 days'),
  ('Nina Patel', 'nina.patel@email.com', '+91-22-1234-5678', 'India', 'Mumbai', '400001', 'standard', 'ad_campaign', CURRENT_TIMESTAMP - INTERVAL '9 days'),
  ('Lucas Silva', 'lucas.silva@email.com', '+55-11-1234-5678', 'Brazil', 'Sao Paulo', '01310-100', 'premium', 'referral', CURRENT_TIMESTAMP - INTERVAL '5 days'),
  ('Zoe Nakamura', 'zoe.nakamura@email.com', '+1-310-555-0120', 'USA', 'Los Angeles', '90001', 'standard', 'organic_search', CURRENT_TIMESTAMP - INTERVAL '2 days'),
  ('Anton Kovalenko', 'anton.kovalenko@email.com', '+7-495-123-4567', 'Russia', 'Moscow', '101000', 'premium', 'direct', CURRENT_TIMESTAMP - INTERVAL '88 days'),
  ('Emma Johnson', 'emma.johnson@email.com', '+1-202-555-0121', 'USA', 'Washington', '20001', 'standard', 'ad_campaign', CURRENT_TIMESTAMP - INTERVAL '77 days'),
  ('Oliver Lee', 'oliver.lee@email.com', '+852-1234-5678', 'Hong Kong', 'Central', 'N/A', 'vip', 'referral', CURRENT_TIMESTAMP - INTERVAL '66 days'),
  ('Amelia Taylor', 'amelia.taylor@email.com', '+1-305-555-0122', 'USA', 'Fort Lauderdale', '33301', 'premium', 'organic_search', CURRENT_TIMESTAMP - INTERVAL '54 days'),
  ('Benjamin Scott', 'benjamin.scott@email.com', '+1-713-555-0123', 'USA', 'Houston', '77001', 'standard', 'ad_campaign', CURRENT_TIMESTAMP - INTERVAL '43 days'),
  ('Charlotte Green', 'charlotte.green@email.com', '+1-602-555-0124', 'USA', 'Phoenix', '85001', 'premium', 'referral', CURRENT_TIMESTAMP - INTERVAL '32 days'),
  ('Daniel King', 'daniel.king@email.com', '+1-215-555-0125', 'USA', 'Philadelphia', '19101', 'standard', 'direct', CURRENT_TIMESTAMP - INTERVAL '21 days'),
  ('Evelyn Brooks', 'evelyn.brooks@email.com', '+1-480-555-0126', 'USA', 'Mesa', '85201', 'premium', 'organic_search', CURRENT_TIMESTAMP - INTERVAL '11 days'),
  ('Frank Miller', 'frank.miller@email.com', '+1-214-555-0127', 'USA', 'Dallas', '75201', 'vip', 'ad_campaign', CURRENT_TIMESTAMP - INTERVAL '7 days'),
  ('Grace Hayes', 'grace.hayes@email.com', '+1-408-555-0128', 'USA', 'San Jose', '95110', 'standard', 'referral', CURRENT_TIMESTAMP - INTERVAL '3 days'),
  ('Henry Clark', 'henry.clark@email.com', '+1-303-555-0129', 'USA', 'Denver', '80202', 'premium', 'direct', CURRENT_TIMESTAMP - INTERVAL '89 days'),
  ('Iris Mitchell', 'iris.mitchell@email.com', '+1-206-555-0130', 'USA', 'Seattle', '98101', 'standard', 'organic_search', CURRENT_TIMESTAMP - INTERVAL '76 days'),
  ('Jack Robinson', 'jack.robinson@email.com', '+1-612-555-0131', 'USA', 'Minneapolis', '55401', 'premium', 'ad_campaign', CURRENT_TIMESTAMP - INTERVAL '64 days'),
  ('Katherine Bell', 'katherine.bell@email.com', '+1-702-555-0132', 'USA', 'Las Vegas', '89101', 'vip', 'referral', CURRENT_TIMESTAMP - INTERVAL '52 days'),
  ('Liam Murphy', 'liam.murphy@email.com', '+1-503-555-0133', 'USA', 'Portland', '97201', 'standard', 'organic_search', CURRENT_TIMESTAMP - INTERVAL '41 days'),
  ('Megan Davis', 'megan.davis@email.com', '+1-951-555-0134', 'USA', 'Riverside', '92501', 'premium', 'ad_campaign', CURRENT_TIMESTAMP - INTERVAL '30 days'),
  ('Nathan Wright', 'nathan.wright@email.com', '+1-215-555-0135', 'USA', 'Philadelphia', '19101', 'standard', 'referral', CURRENT_TIMESTAMP - INTERVAL '19 days'),
  ('Olivia Taylor', 'olivia.taylor@email.com', '+1-949-555-0136', 'USA', 'Irvine', '92614', 'premium', 'direct', CURRENT_TIMESTAMP - INTERVAL '10 days'),
  ('Peter Adams', 'peter.adams@email.com', '+1-407-555-0137', 'USA', 'Orlando', '32801', 'standard', 'organic_search', CURRENT_TIMESTAMP - INTERVAL '4 days'),
  ('Quinn Carter', 'quinn.carter@email.com', '+1-602-555-0138', 'USA', 'Phoenix', '85001', 'vip', 'ad_campaign', CURRENT_TIMESTAMP - INTERVAL '1 days'),
  ('Rachel Green', 'rachel.green@email.com', '+1-408-555-0139', 'USA', 'Sunnyvale', '94086', 'premium', 'referral', CURRENT_TIMESTAMP - INTERVAL '84 days'),
  ('Samuel Harris', 'samuel.harris@email.com', '+1-310-555-0140', 'USA', 'Long Beach', '90801', 'standard', 'direct', CURRENT_TIMESTAMP - INTERVAL '72 days'),
  ('Tessa Lewis', 'tessa.lewis@email.com', '+1-408-555-0141', 'USA', 'Santa Clara', '95050', 'premium', 'organic_search', CURRENT_TIMESTAMP - INTERVAL '60 days'),
  ('Ulysses Turner', 'ulysses.turner@email.com', '+1-619-555-0142', 'USA', 'San Diego', '92101', 'standard', 'ad_campaign', CURRENT_TIMESTAMP - INTERVAL '48 days'),
  ('Victoria Phillips', 'victoria.phillips@email.com', '+1-713-555-0143', 'USA', 'Houston', '77001', 'vip', 'referral', CURRENT_TIMESTAMP - INTERVAL '37 days'),
  ('William Campbell', 'william.campbell@email.com', '+1-817-555-0144', 'USA', 'Arlington', '76010', 'premium', 'organic_search', CURRENT_TIMESTAMP - INTERVAL '25 days'),
  ('Xandra Morris', 'xandra.morris@email.com', '+1-214-555-0145', 'USA', 'Dallas', '75201', 'standard', 'ad_campaign', CURRENT_TIMESTAMP - INTERVAL '15 days'),
  ('Yolanda Rogers', 'yolanda.rogers@email.com', '+1-505-555-0146', 'USA', 'Albuquerque', '87101', 'premium', 'referral', CURRENT_TIMESTAMP - INTERVAL '6 days'),
  ('Zachary Stewart', 'zachary.stewart@email.com', '+1-702-555-0147', 'USA', 'Las Vegas', '89101', 'standard', 'direct', CURRENT_TIMESTAMP - INTERVAL '0 days');

-- Insert products
INSERT INTO demo.products (name, description, category, sku, price, cost, stock, reorder_level, created_at)
VALUES
  ('Wireless Bluetooth Headphones', 'Premium noise-cancelling headphones with 30-hour battery life', 'Electronics', 'WBH-001', 129.99, 45.00, 145, 20, CURRENT_TIMESTAMP - INTERVAL '90 days'),
  ('USB-C Lightning Cable', 'High-speed charging and data transfer cable, 6ft length', 'Accessories', 'USB-C-001', 19.99, 4.50, 523, 50, CURRENT_TIMESTAMP - INTERVAL '85 days'),
  ('Mechanical Keyboard', 'RGB mechanical keyboard with hot-swappable switches', 'Electronics', 'MKB-001', 89.99, 35.00, 87, 15, CURRENT_TIMESTAMP - INTERVAL '80 days'),
  ('4K Webcam', 'Ultra HD webcam with auto-focus and built-in microphone', 'Electronics', 'WEBCAM-001', 149.99, 60.00, 52, 10, CURRENT_TIMESTAMP - INTERVAL '75 days'),
  ('Portable SSD 1TB', 'Fast external solid state drive with USB-C 3.1', 'Storage', 'SSD-1TB-001', 179.99, 80.00, 98, 15, CURRENT_TIMESTAMP - INTERVAL '70 days'),
  ('Ergonomic Mouse Pad', 'Memory foam wrist rest mouse pad with non-slip base', 'Accessories', 'MOUSEPAD-001', 24.99, 8.00, 287, 40, CURRENT_TIMESTAMP - INTERVAL '65 days'),
  ('USB Hub 7-Port', 'Multi-port USB hub with individual switches and power adapter', 'Electronics', 'USBHUB-001', 39.99, 15.00, 156, 20, CURRENT_TIMESTAMP - INTERVAL '60 days'),
  ('Laptop Stand Aluminum', 'Adjustable laptop stand with cooling ventilation', 'Accessories', 'LAPSTAND-001', 44.99, 18.00, 201, 25, CURRENT_TIMESTAMP - INTERVAL '55 days'),
  ('Wireless Mouse', 'Quiet wireless mouse with 2.4GHz receiver and 18-month battery', 'Electronics', 'WMOUSE-001', 34.99, 12.00, 334, 30, CURRENT_TIMESTAMP - INTERVAL '50 days'),
  ('Screen Protector Pack', 'Anti-glare screen protectors for 15.6-inch laptops (5-pack)', 'Accessories', 'SCRPROT-001', 14.99, 3.00, 412, 50, CURRENT_TIMESTAMP - INTERVAL '45 days'),
  ('USB-A to USB-C Adapter', 'Compact USB-A to USB-C converter with data support', 'Accessories', 'ADAPTER-001', 12.99, 2.50, 654, 75, CURRENT_TIMESTAMP - INTERVAL '40 days'),
  ('Desk Lamp LED', 'Adjustable LED desk lamp with USB charging port', 'Accessories', 'LAMP-001', 54.99, 22.00, 143, 18, CURRENT_TIMESTAMP - INTERVAL '35 days'),
  ('External Hard Drive 2TB', 'Portable 2TB external HDD with USB 3.0', 'Storage', 'HDD-2TB-001', 89.99, 40.00, 76, 12, CURRENT_TIMESTAMP - INTERVAL '30 days'),
  ('Phone Stand', 'Adjustable phone stand compatible with all devices', 'Accessories', 'PHSTAND-001', 16.99, 5.00, 445, 60, CURRENT_TIMESTAMP - INTERVAL '25 days'),
  ('HDMI Cable 2.1', 'High-speed HDMI 2.1 cable supporting 8K resolution, 6ft', 'Accessories', 'HDMI-001', 22.99, 6.00, 287, 35, CURRENT_TIMESTAMP - INTERVAL '20 days'),
  ('Wireless Charging Pad', '15W wireless charging pad with non-slip surface', 'Electronics', 'WIRELESS-001', 29.99, 10.00, 198, 25, CURRENT_TIMESTAMP - INTERVAL '15 days'),
  ('Monitor Light Bar', 'E-ink display light bar that reduces eye strain', 'Electronics', 'LIGHTBAR-001', 99.99, 45.00, 64, 10, CURRENT_TIMESTAMP - INTERVAL '10 days'),
  ('Cable Organizer Set', 'Set of 8 velcro cable organizers in various sizes', 'Accessories', 'CABLEORG-001', 11.99, 2.50, 521, 60, CURRENT_TIMESTAMP - INTERVAL '5 days'),
  ('Mechanical Numpad', 'Compact mechanical numpad with RGB lighting', 'Electronics', 'NUMPAD-001', 59.99, 25.00, 94, 12, CURRENT_TIMESTAMP - INTERVAL '2 days'),
  ('Privacy Screen Filter', '14-inch privacy screen filter for laptop displays', 'Accessories', 'PRIVACY-001', 39.99, 15.00, 87, 15, CURRENT_TIMESTAMP - INTERVAL '1 days'),
  ('Fast Charger 65W', 'GaN fast charger with USB-C and USB-A ports', 'Electronics', 'CHARGER-001', 44.99, 18.00, 267, 30, CURRENT_TIMESTAMP - INTERVAL '88 days'),
  ('Desk Organizer', 'Bamboo desk organizer with 5 compartments', 'Accessories', 'ORGDESK-001', 32.99, 12.00, 178, 22, CURRENT_TIMESTAMP - INTERVAL '83 days'),
  ('USB-C Dock', 'USB-C docking station with 11 ports and 100W power delivery', 'Electronics', 'DOCK-001', 199.99, 85.00, 43, 8, CURRENT_TIMESTAMP - INTERVAL '78 days'),
  ('Laptop Cooling Pad', 'Aluminum laptop cooler with 6 quiet fans', 'Accessories', 'COOLER-001', 49.99, 20.00, 112, 15, CURRENT_TIMESTAMP - INTERVAL '73 days'),
  ('USB Memory Drive 64GB', 'USB 3.1 memory stick, 64GB capacity', 'Storage', 'USBSTICK-001', 24.99, 8.00, 356, 45, CURRENT_TIMESTAMP - INTERVAL '68 days'),
  ('Desk Cable Sleeves', 'Neoprene cable management sleeves (10ft pack)', 'Accessories', 'SLEEVES-001', 13.99, 3.50, 498, 55, CURRENT_TIMESTAMP - INTERVAL '63 days'),
  ('RGB LED Strip', 'Adhesive RGB LED strip kit, 16.4ft with remote control', 'Accessories', 'RGBLED-001', 26.99, 9.00, 234, 30, CURRENT_TIMESTAMP - INTERVAL '58 days'),
  ('Keyboard Switch Puller', 'Mechanical keyboard switch removal tool', 'Accessories', 'SWITCHER-001', 8.99, 1.50, 687, 80, CURRENT_TIMESTAMP - INTERVAL '53 days'),
  ('Monitor Stand Riser', 'Adjustable monitor stand with storage drawer', 'Accessories', 'MONRISER-001', 59.99, 24.00, 89, 12, CURRENT_TIMESTAMP - INTERVAL '48 days'),
  ('Anti-Static Wrist Strap', 'Grounding wrist strap with 6ft cord', 'Accessories', 'ANTISTATIC-001', 9.99, 2.00, 412, 50, CURRENT_TIMESTAMP - INTERVAL '43 days');

-- Insert orders
INSERT INTO demo.orders (customer_id, order_number, total, subtotal, tax, status, shipping_address, payment_method, created_at, shipped_at, delivered_at)
VALUES
  (1, 'ORD-2026-0001', 149.98, 129.98, 20.00, 'delivered', '123 Market St, San Francisco, CA 94103', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '80 days', CURRENT_TIMESTAMP - INTERVAL '77 days', CURRENT_TIMESTAMP - INTERVAL '74 days'),
  (2, 'ORD-2026-0002', 209.98, 189.98, 20.00, 'delivered', '456 Broadway, New York, NY 10001', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '70 days', CURRENT_TIMESTAMP - INTERVAL '68 days', CURRENT_TIMESTAMP - INTERVAL '64 days'),
  (3, 'ORD-2026-0003', 89.97, 79.97, 10.00, 'delivered', '789 Ocean Dr, Miami, FL 33101', 'paypal', CURRENT_TIMESTAMP - INTERVAL '60 days', CURRENT_TIMESTAMP - INTERVAL '57 days', CURRENT_TIMESTAMP - INTERVAL '54 days'),
  (4, 'ORD-2026-0004', 299.96, 269.96, 30.00, 'shipped', '321 Pike St, Seattle, WA 98101', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '45 days', CURRENT_TIMESTAMP - INTERVAL '42 days', NULL),
  (5, 'ORD-2026-0005', 124.97, 109.97, 15.00, 'processing', '654 Park Ave, San Jose, CA 95110', 'debit_card', CURRENT_TIMESTAMP - INTERVAL '30 days', NULL, NULL),
  (6, 'ORD-2026-0006', 179.98, 159.98, 20.00, 'delivered', '987 Michigan Ave, Chicago, IL 60601', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP - INTERVAL '23 days', CURRENT_TIMESTAMP - INTERVAL '20 days'),
  (7, 'ORD-2026-0007', 89.97, 79.97, 10.00, 'delivered', '321 Congress Ave, Austin, TX 78701', 'paypal', CURRENT_TIMESTAMP - INTERVAL '18 days', CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP - INTERVAL '14 days'),
  (8, 'ORD-2026-0008', 209.97, 189.97, 20.00, 'processing', '654 Harbor St, San Diego, CA 92101', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '12 days', NULL, NULL),
  (9, 'ORD-2026-0009', 159.96, 139.96, 20.00, 'confirmed', '987 Newbury St, Boston, MA 02101', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '8 days', NULL, NULL),
  (10, 'ORD-2026-0010', 94.98, 84.98, 10.00, 'delivered', '321 West Peachtree, Atlanta, GA 30303', 'debit_card', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '1 days'),
  (11, 'ORD-2026-0011', 249.97, 219.97, 30.00, 'delivered', 'Baker St 123, London, SW1A 1AA', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '70 days', CURRENT_TIMESTAMP - INTERVAL '68 days', CURRENT_TIMESTAMP - INTERVAL '64 days'),
  (12, 'ORD-2026-0012', 134.99, 119.99, 15.00, 'cancelled', 'George St 456, Sydney, 2000', 'paypal', CURRENT_TIMESTAMP - INTERVAL '60 days', NULL, NULL),
  (13, 'ORD-2026-0013', 169.98, 149.98, 20.00, 'delivered', 'Rue de Rivoli 789, Paris, 75001', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '50 days', CURRENT_TIMESTAMP - INTERVAL '48 days', CURRENT_TIMESTAMP - INTERVAL '45 days'),
  (14, 'ORD-2026-0014', 99.98, 89.98, 10.00, 'shipped', 'Unter den Linden 321, Berlin, 10115', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '40 days', CURRENT_TIMESTAMP - INTERVAL '38 days', NULL),
  (15, 'ORD-2026-0015', 209.97, 189.97, 20.00, 'delivered', 'Via dei Fori Imperiali 654, Rome, 00100', 'debit_card', CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '28 days', CURRENT_TIMESTAMP - INTERVAL '25 days'),
  (16, 'ORD-2026-0016', 129.98, 119.98, 10.00, 'processing', 'Gran Via 987, Madrid, 28001', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '20 days', NULL, NULL),
  (17, 'ORD-2026-0017', 299.97, 269.97, 30.00, 'confirmed', 'Chiyoda Ward 321, Tokyo, 100-0001', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '12 days', NULL, NULL),
  (18, 'ORD-2026-0018', 89.99, 79.99, 10.00, 'delivered', 'Colaba Causeway 654, Mumbai, 400001', 'paypal', CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '4 days'),
  (19, 'ORD-2026-0019', 159.98, 139.98, 20.00, 'shipped', 'Av Paulista 987, Sao Paulo, 01310-100', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '2 days', NULL),
  (20, 'ORD-2026-0020', 129.97, 109.97, 20.00, 'pending', 'Sunset Blvd 321, Los Angeles, CA 90001', 'debit_card', CURRENT_TIMESTAMP - INTERVAL '1 days', NULL, NULL),
  (21, 'ORD-2026-0021', 249.96, 219.96, 30.00, 'delivered', 'Tverskaya 654, Moscow, 101000', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '85 days', CURRENT_TIMESTAMP - INTERVAL '82 days', CURRENT_TIMESTAMP - INTERVAL '79 days'),
  (22, 'ORD-2026-0022', 99.97, 89.97, 10.00, 'delivered', 'Pennsylvania Ave 987, Washington, DC 20001', 'paypal', CURRENT_TIMESTAMP - INTERVAL '75 days', CURRENT_TIMESTAMP - INTERVAL '73 days', CURRENT_TIMESTAMP - INTERVAL '70 days'),
  (23, 'ORD-2026-0023', 189.98, 169.98, 20.00, 'cancelled', 'Des Voeux Rd 321, Central, Hong Kong', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '60 days', NULL, NULL),
  (24, 'ORD-2026-0024', 119.99, 109.99, 10.00, 'delivered', 'Federal Hwy 654, Fort Lauderdale, FL 33301', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '50 days', CURRENT_TIMESTAMP - INTERVAL '48 days', CURRENT_TIMESTAMP - INTERVAL '45 days'),
  (25, 'ORD-2026-0025', 134.98, 119.98, 15.00, 'processing', 'Dallas St 987, Houston, TX 77001', 'debit_card', CURRENT_TIMESTAMP - INTERVAL '40 days', NULL, NULL),
  (26, 'ORD-2026-0026', 209.97, 189.97, 20.00, 'shipped', 'Central Ave 321, Phoenix, AZ 85001', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '28 days', NULL),
  (27, 'ORD-2026-0027', 169.98, 149.98, 20.00, 'delivered', 'Market St 654, Philadelphia, PA 19101', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '18 days', CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP - INTERVAL '14 days'),
  (28, 'ORD-2026-0028', 89.99, 79.99, 10.00, 'confirmed', 'Camelback Rd 987, Mesa, AZ 85201', 'paypal', CURRENT_TIMESTAMP - INTERVAL '8 days', NULL, NULL),
  (29, 'ORD-2026-0029', 299.96, 269.96, 30.00, 'delivered', 'Elm St 321, Dallas, TX 75201', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '0 days'),
  (30, 'ORD-2026-0030', 124.99, 109.99, 15.00, 'pending', 'De Anza Blvd 654, San Jose, CA 95110', 'debit_card', CURRENT_TIMESTAMP - INTERVAL '0 days', NULL, NULL);

-- Insert more orders to reach ~100 rows total
INSERT INTO demo.orders (customer_id, order_number, total, subtotal, tax, status, shipping_address, payment_method, created_at, shipped_at, delivered_at)
VALUES
  (1, 'ORD-2026-0031', 199.97, 179.97, 20.00, 'processing', '123 Market St, San Francisco, CA 94103', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '72 days', NULL, NULL),
  (3, 'ORD-2026-0032', 129.98, 119.98, 10.00, 'delivered', '789 Ocean Dr, Miami, FL 33101', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '58 days', CURRENT_TIMESTAMP - INTERVAL '56 days', CURRENT_TIMESTAMP - INTERVAL '53 days'),
  (5, 'ORD-2026-0033', 169.99, 149.99, 20.00, 'shipped', '654 Park Ave, San Jose, CA 95110', 'paypal', CURRENT_TIMESTAMP - INTERVAL '48 days', CURRENT_TIMESTAMP - INTERVAL '45 days', NULL),
  (7, 'ORD-2026-0034', 249.98, 219.98, 30.00, 'delivered', '321 Congress Ave, Austin, TX 78701', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '38 days', CURRENT_TIMESTAMP - INTERVAL '36 days', CURRENT_TIMESTAMP - INTERVAL '33 days'),
  (9, 'ORD-2026-0035', 99.97, 89.97, 10.00, 'delivered', '987 Newbury St, Boston, MA 02101', 'debit_card', CURRENT_TIMESTAMP - INTERVAL '28 days', CURRENT_TIMESTAMP - INTERVAL '26 days', CURRENT_TIMESTAMP - INTERVAL '24 days'),
  (11, 'ORD-2026-0036', 189.96, 169.96, 20.00, 'cancelled', 'Baker St 123, London, SW1A 1AA', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '65 days', NULL, NULL),
  (13, 'ORD-2026-0037', 119.98, 109.98, 10.00, 'processing', 'Rue de Rivoli 789, Paris, 75001', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '55 days', NULL, NULL),
  (15, 'ORD-2026-0038', 299.97, 269.97, 30.00, 'confirmed', 'Via dei Fori Imperiali 654, Rome, 00100', 'paypal', CURRENT_TIMESTAMP - INTERVAL '35 days', NULL, NULL),
  (17, 'ORD-2026-0039', 134.99, 119.99, 15.00, 'shipped', 'Chiyoda Ward 321, Tokyo, 100-0001', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '22 days', CURRENT_TIMESTAMP - INTERVAL '20 days', NULL),
  (19, 'ORD-2026-0040', 169.98, 149.98, 20.00, 'delivered', 'Av Paulista 987, Sao Paulo, 01310-100', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '6 days'),
  (2, 'ORD-2026-0041', 89.99, 79.99, 10.00, 'delivered', '456 Broadway, New York, NY 10001', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '68 days', CURRENT_TIMESTAMP - INTERVAL '66 days', CURRENT_TIMESTAMP - INTERVAL '62 days'),
  (4, 'ORD-2026-0042', 249.97, 219.97, 30.00, 'processing', '321 Pike St, Seattle, WA 98101', 'debit_card', CURRENT_TIMESTAMP - INTERVAL '58 days', NULL, NULL),
  (6, 'ORD-2026-0043', 129.98, 119.98, 10.00, 'shipped', '987 Michigan Ave, Chicago, IL 60601', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '48 days', CURRENT_TIMESTAMP - INTERVAL '46 days', NULL),
  (8, 'ORD-2026-0044', 199.97, 179.97, 20.00, 'delivered', '654 Harbor St, San Diego, CA 92101', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '38 days', CURRENT_TIMESTAMP - INTERVAL '36 days', CURRENT_TIMESTAMP - INTERVAL '34 days'),
  (10, 'ORD-2026-0045', 109.98, 99.98, 10.00, 'cancelled', '321 West Peachtree, Atlanta, GA 30303', 'paypal', CURRENT_TIMESTAMP - INTERVAL '28 days', NULL, NULL),
  (12, 'ORD-2026-0046', 159.99, 139.99, 20.00, 'delivered', 'George St 456, Sydney, 2000', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '58 days', CURRENT_TIMESTAMP - INTERVAL '56 days', CURRENT_TIMESTAMP - INTERVAL '53 days'),
  (14, 'ORD-2026-0047', 119.97, 109.97, 10.00, 'processing', 'Unter den Linden 321, Berlin, 10115', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '48 days', NULL, NULL),
  (16, 'ORD-2026-0048', 189.98, 169.98, 20.00, 'shipped', 'Gran Via 987, Madrid, 28001', 'debit_card', CURRENT_TIMESTAMP - INTERVAL '38 days', CURRENT_TIMESTAMP - INTERVAL '36 days', NULL),
  (18, 'ORD-2026-0049', 249.96, 219.96, 30.00, 'delivered', 'Colaba Causeway 654, Mumbai, 400001', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP - INTERVAL '23 days', CURRENT_TIMESTAMP - INTERVAL '20 days'),
  (20, 'ORD-2026-0050', 99.99, 89.99, 10.00, 'confirmed', 'Sunset Blvd 321, Los Angeles, CA 90001', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '18 days', NULL, NULL),
  (21, 'ORD-2026-0051', 179.97, 159.97, 20.00, 'delivered', 'Tverskaya 654, Moscow, 101000', 'paypal', CURRENT_TIMESTAMP - INTERVAL '82 days', CURRENT_TIMESTAMP - INTERVAL '80 days', CURRENT_TIMESTAMP - INTERVAL '77 days'),
  (22, 'ORD-2026-0052', 134.98, 119.98, 15.00, 'processing', 'Pennsylvania Ave 987, Washington, DC 20001', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '72 days', NULL, NULL),
  (23, 'ORD-2026-0053', 209.99, 189.99, 20.00, 'shipped', 'Des Voeux Rd 321, Central, Hong Kong', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '62 days', CURRENT_TIMESTAMP - INTERVAL '60 days', NULL),
  (24, 'ORD-2026-0054', 149.98, 139.98, 10.00, 'delivered', 'Federal Hwy 654, Fort Lauderdale, FL 33301', 'debit_card', CURRENT_TIMESTAMP - INTERVAL '52 days', CURRENT_TIMESTAMP - INTERVAL '50 days', CURRENT_TIMESTAMP - INTERVAL '47 days'),
  (25, 'ORD-2026-0055', 199.97, 179.97, 20.00, 'pending', 'Dallas St 987, Houston, TX 77001', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '42 days', NULL, NULL),
  (26, 'ORD-2026-0056', 119.99, 109.99, 10.00, 'delivered', 'Central Ave 321, Phoenix, AZ 85001', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '32 days', CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '27 days'),
  (27, 'ORD-2026-0057', 249.98, 219.98, 30.00, 'shipped', 'Market St 654, Philadelphia, PA 19101', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '22 days', CURRENT_TIMESTAMP - INTERVAL '20 days', NULL),
  (28, 'ORD-2026-0058', 169.99, 149.99, 20.00, 'delivered', 'Camelback Rd 987, Mesa, AZ 85201', 'paypal', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '8 days'),
  (29, 'ORD-2026-0059', 129.98, 119.98, 10.00, 'processing', 'Elm St 321, Dallas, TX 75201', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '6 days', NULL, NULL),
  (30, 'ORD-2026-0060', 189.97, 169.97, 20.00, 'confirmed', 'De Anza Blvd 654, San Jose, CA 95110', 'debit_card', CURRENT_TIMESTAMP - INTERVAL '2 days', NULL, NULL);

-- Insert order items
INSERT INTO demo.order_items (order_id, product_id, quantity, unit_price, discount_percent)
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
  (13, 10, 4, 14.99, 0),
  (14, 9, 2, 34.99, 10),
  (15, 12, 1, 54.99, 0),
  (15, 11, 5, 12.99, 0),
  (16, 4, 1, 149.99, 0),
  (17, 6, 2, 24.99, 5),
  (17, 23, 1, 199.99, 0),
  (18, 2, 4, 19.99, 0),
  (19, 7, 2, 39.99, 0),
  (19, 8, 1, 44.99, 10),
  (20, 14, 5, 16.99, 10);

-- Insert inventory
INSERT INTO demo.inventory (product_id, warehouse_id, warehouse_name, quantity, reserved_quantity, reorder_point, updated_at)
VALUES
  (1, 1, 'San Francisco', 45, 8, 20, CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (1, 2, 'Chicago', 52, 12, 20, CURRENT_TIMESTAMP - INTERVAL '3 days'),
  (1, 3, 'New York', 48, 10, 20, CURRENT_TIMESTAMP - INTERVAL '1 days'),
  (2, 1, 'San Francisco', 187, 25, 50, CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  (2, 2, 'Chicago', 193, 30, 50, CURRENT_TIMESTAMP - INTERVAL '4 hours'),
  (2, 3, 'New York', 143, 20, 50, CURRENT_TIMESTAMP - INTERVAL '1 hours'),
  (3, 1, 'San Francisco', 28, 5, 15, CURRENT_TIMESTAMP - INTERVAL '5 days'),
  (3, 2, 'Chicago', 31, 8, 15, CURRENT_TIMESTAMP - INTERVAL '6 days'),
  (3, 3, 'New York', 28, 6, 15, CURRENT_TIMESTAMP - INTERVAL '4 days'),
  (4, 1, 'San Francisco', 18, 3, 10, CURRENT_TIMESTAMP - INTERVAL '1 days'),
  (4, 2, 'Chicago', 21, 4, 10, CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (4, 3, 'New York', 13, 2, 10, CURRENT_TIMESTAMP - INTERVAL '0 days'),
  (5, 1, 'San Francisco', 34, 8, 15, CURRENT_TIMESTAMP - INTERVAL '3 days'),
  (5, 2, 'Chicago', 38, 10, 15, CURRENT_TIMESTAMP - INTERVAL '4 days'),
  (5, 3, 'New York', 26, 5, 15, CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (6, 1, 'San Francisco', 95, 15, 40, CURRENT_TIMESTAMP - INTERVAL '1 days'),
  (6, 2, 'Chicago', 102, 18, 40, CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (6, 3, 'New York', 90, 12, 40, CURRENT_TIMESTAMP - INTERVAL '0 days'),
  (7, 1, 'San Francisco', 52, 8, 20, CURRENT_TIMESTAMP - INTERVAL '4 days'),
  (7, 2, 'Chicago', 58, 12, 20, CURRENT_TIMESTAMP - INTERVAL '5 days'),
  (7, 3, 'New York', 46, 10, 20, CURRENT_TIMESTAMP - INTERVAL '3 days'),
  (8, 1, 'San Francisco', 68, 12, 25, CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (8, 2, 'Chicago', 73, 15, 25, CURRENT_TIMESTAMP - INTERVAL '3 days'),
  (8, 3, 'New York', 60, 10, 25, CURRENT_TIMESTAMP - INTERVAL '1 days'),
  (9, 1, 'San Francisco', 112, 20, 30, CURRENT_TIMESTAMP - INTERVAL '0 days'),
  (9, 2, 'Chicago', 118, 25, 30, CURRENT_TIMESTAMP - INTERVAL '1 days'),
  (9, 3, 'New York', 104, 18, 30, CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (10, 1, 'San Francisco', 138, 25, 50, CURRENT_TIMESTAMP - INTERVAL '3 days'),
  (10, 2, 'Chicago', 145, 30, 50, CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (10, 3, 'New York', 129, 20, 50, CURRENT_TIMESTAMP - INTERVAL '1 days');

-- Insert analytics events
INSERT INTO demo.analytics_events (user_id, session_id, event_type, event_source, payload, user_agent, created_at)
VALUES
  (1, 'sess_001_sf', 'page_view', 'web', '{"page": "/products", "referrer": "/home"}', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', CURRENT_TIMESTAMP - INTERVAL '89 days'),
  (2, 'sess_002_ny', 'add_to_cart', 'web', '{"product_id": 1, "quantity": 1, "price": 129.99}', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', CURRENT_TIMESTAMP - INTERVAL '88 days'),
  (3, 'sess_003_mi', 'checkout_start', 'web', '{"cart_value": 89.97, "items": 4}', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)', CURRENT_TIMESTAMP - INTERVAL '87 days'),
  (4, 'sess_004_se', 'purchase', 'web', '{"order_id": "ORD-2026-0001", "total": 149.98, "currency": "USD"}', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36', CURRENT_TIMESTAMP - INTERVAL '86 days'),
  (5, 'sess_005_sj', 'page_view', 'mobile_app', '{"page": "/my_orders", "platform": "ios"}', 'Mobile Safari 14.1', CURRENT_TIMESTAMP - INTERVAL '85 days'),
  (1, 'sess_006_sf', 'search', 'web', '{"query": "wireless headphones", "results": 12}', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', CURRENT_TIMESTAMP - INTERVAL '84 days'),
  (2, 'sess_007_ny', 'product_view', 'web', '{"product_id": 3, "category": "Electronics"}', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', CURRENT_TIMESTAMP - INTERVAL '83 days'),
  (6, 'sess_008_ch', 'add_to_wishlist', 'web', '{"product_id": 5, "product_name": "Portable SSD 1TB"}', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', CURRENT_TIMESTAMP - INTERVAL '82 days'),
  (7, 'sess_009_au', 'page_view', 'web', '{"page": "/categories/electronics"}', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X)', CURRENT_TIMESTAMP - INTERVAL '81 days'),
  (8, 'sess_010_sd', 'cart_view', 'web', '{"items": 3, "total_value": 209.97}', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', CURRENT_TIMESTAMP - INTERVAL '80 days'),
  (9, 'sess_011_bo', 'checkout_complete', 'web', '{"order_id": "ORD-2026-0002", "payment": "credit_card", "shipping": "standard"}', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', CURRENT_TIMESTAMP - INTERVAL '79 days'),
  (10, 'sess_012_at', 'page_view', 'mobile_app', '{"page": "/home", "platform": "android"}', 'Mobile Safari Android', CURRENT_TIMESTAMP - INTERVAL '78 days'),
  (11, 'sess_013_lo', 'search', 'web', '{"query": "keyboard", "results": 5}', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', CURRENT_TIMESTAMP - INTERVAL '77 days'),
  (12, 'sess_014_sy', 'product_view', 'web', '{"product_id": 7, "category": "Electronics"}', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_4)', CURRENT_TIMESTAMP - INTERVAL '76 days'),
  (13, 'sess_015_pa', 'add_to_cart', 'web', '{"product_id": 2, "quantity": 2, "price": 19.99}', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', CURRENT_TIMESTAMP - INTERVAL '75 days'),
  (14, 'sess_016_be', 'page_view', 'web', '{"page": "/promotions"}', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_2 like Mac OS X)', CURRENT_TIMESTAMP - INTERVAL '74 days'),
  (15, 'sess_017_ro', 'checkout_start', 'web', '{"cart_value": 209.97, "items": 3}', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', CURRENT_TIMESTAMP - INTERVAL '73 days'),
  (16, 'sess_018_ma', 'purchase', 'web', '{"order_id": "ORD-2026-0003", "total": 89.97, "currency": "USD"}', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', CURRENT_TIMESTAMP - INTERVAL '72 days'),
  (17, 'sess_019_to', 'page_view', 'mobile_app', '{"page": "/my_orders", "platform": "ios"}', 'Mobile Safari 15.2', CURRENT_TIMESTAMP - INTERVAL '71 days'),
  (18, 'sess_020_mu', 'search', 'web', '{"query": "usb cables", "results": 8}', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', CURRENT_TIMESTAMP - INTERVAL '70 days');

-- Insert sessions
INSERT INTO demo.sessions (user_id, token, ip_address, user_agent, last_activity, expires_at, created_at)
VALUES
  (1, 'token_sf_001_abc123def456', '192.168.1.101'::inet, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  (2, 'token_ny_002_ghi789jkl012', '203.0.113.45'::inet, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP - INTERVAL '45 minutes'),
  (3, 'token_mi_003_mno345pqr678', '198.51.100.89'::inet, 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6)', CURRENT_TIMESTAMP - INTERVAL '10 minutes', CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP - INTERVAL '15 minutes'),
  (4, 'token_se_004_stu901vwx234', '192.0.2.123'::inet, 'Mozilla/5.0 (X11; Linux x86_64)', CURRENT_TIMESTAMP - INTERVAL '5 minutes', CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP - INTERVAL '6 minutes'),
  (5, 'token_sj_005_yza567bcd890', '203.0.113.200'::inet, 'Mobile Safari 14.1', CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP - INTERVAL '3 hours'),
  (6, 'token_ch_006_efg234hij567', '198.51.100.44'::inet, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', CURRENT_TIMESTAMP - INTERVAL '4 hours', CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP - INTERVAL '5 hours'),
  (7, 'token_au_007_klm890nop123', '192.0.2.67'::inet, 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_1)', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP - INTERVAL '1 days'),
  (8, 'token_sd_008_qrs456tuv789', '203.0.113.78'::inet, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (9, 'token_bo_009_wxy012zab345', '198.51.100.12'::inet, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 hours', CURRENT_TIMESTAMP - INTERVAL '3 days'),
  (10, 'token_at_010_cde678fgh901', '192.0.2.155'::inet, 'Mobile Safari Android', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 hours', CURRENT_TIMESTAMP - INTERVAL '4 days');

-- Insert audit log entries
INSERT INTO demo.audit_log (table_name, record_id, operation, old_data, new_data, performed_by, change_reason, created_at)
VALUES
  ('orders', 1, 'INSERT', NULL, '{"id": 1, "customer_id": 1, "status": "pending", "total": 149.98}', 'system', 'Order creation', CURRENT_TIMESTAMP - INTERVAL '80 days'),
  ('orders', 1, 'UPDATE', '{"status": "pending"}', '{"status": "confirmed"}', 'admin_user', 'Order confirmation', CURRENT_TIMESTAMP - INTERVAL '79 days'),
  ('orders', 1, 'UPDATE', '{"status": "confirmed"}', '{"status": "shipped", "shipped_at": "2026-03-02"}', 'system', 'Order shipped', CURRENT_TIMESTAMP - INTERVAL '77 days'),
  ('customers', 1, 'UPDATE', '{"tier": "standard"}', '{"tier": "premium"}', 'system', 'Tier upgrade based on purchase history', CURRENT_TIMESTAMP - INTERVAL '75 days'),
  ('products', 1, 'UPDATE', '{"stock": 150}', '{"stock": 145}', 'system', 'Inventory adjustment - sales', CURRENT_TIMESTAMP - INTERVAL '74 days'),
  ('orders', 2, 'INSERT', NULL, '{"id": 2, "customer_id": 2, "status": "pending", "total": 209.98}', 'system', 'Order creation', CURRENT_TIMESTAMP - INTERVAL '70 days'),
  ('orders', 2, 'UPDATE', '{"status": "pending"}', '{"status": "processing"}', 'system', 'Order processing started', CURRENT_TIMESTAMP - INTERVAL '68 days'),
  ('sessions', 1, 'INSERT', NULL, '{"user_id": 1, "token": "token_sf_001...", "expires_at": "2026-03-27"}', 'system', 'Session creation', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  ('inventory', 1, 'UPDATE', '{"quantity": 50}', '{"quantity": 45}', 'system', 'Inventory deduction - fulfillment', CURRENT_TIMESTAMP - INTERVAL '1 day'),
  ('customers', 5, 'INSERT', NULL, '{"id": 5, "name": "Priya Sharma", "tier": "standard"}', 'system', 'New customer signup', CURRENT_TIMESTAMP - INTERVAL '40 days');

-- ================================================
-- MATERIALIZED VIEWS
-- ================================================

-- Monthly sales summary
CREATE MATERIALIZED VIEW demo.mv_monthly_sales AS
SELECT
  DATE_TRUNC('month', o.created_at) AS month,
  COUNT(DISTINCT o.id) AS total_orders,
  COUNT(DISTINCT o.customer_id) AS unique_customers,
  SUM(o.total) AS total_revenue,
  AVG(o.total) AS avg_order_value,
  SUM(oi.quantity) AS total_items_sold
FROM demo.orders o
LEFT JOIN demo.order_items oi ON o.id = oi.order_id
WHERE o.status IN ('delivered', 'shipped')
GROUP BY DATE_TRUNC('month', o.created_at)
ORDER BY month DESC;

-- Customer lifetime value
CREATE MATERIALIZED VIEW demo.mv_customer_lifetime_value AS
SELECT
  c.id,
  c.name,
  c.email,
  c.tier,
  COUNT(o.id) AS total_orders,
  SUM(o.total) AS lifetime_value,
  AVG(o.total) AS avg_order_value,
  MAX(o.created_at) AS last_order_date,
  MIN(o.created_at) AS first_order_date,
  EXTRACT(DAY FROM MAX(o.created_at) - MIN(o.created_at)) AS days_as_customer
FROM demo.customers c
LEFT JOIN demo.orders o ON c.id = o.customer_id AND o.status NOT IN ('cancelled', 'refunded')
GROUP BY c.id, c.name, c.email, c.tier
ORDER BY lifetime_value DESC;

-- Product performance
CREATE MATERIALIZED VIEW demo.mv_product_performance AS
SELECT
  p.id,
  p.name,
  p.category,
  p.price,
  SUM(oi.quantity) AS units_sold,
  SUM(oi.quantity * oi.unit_price) AS total_revenue,
  AVG(CASE WHEN oi.discount_percent > 0 THEN oi.discount_percent ELSE NULL END) AS avg_discount,
  COUNT(DISTINCT oi.order_id) AS order_count
FROM demo.products p
LEFT JOIN demo.order_items oi ON p.id = oi.product_id
GROUP BY p.id, p.name, p.category, p.price
ORDER BY total_revenue DESC;

-- ================================================
-- FUNCTIONS AND PROCEDURES
-- ================================================

-- Function to get customer summary
CREATE OR REPLACE FUNCTION demo.get_customer_summary(customer_id INT)
RETURNS TABLE(
  customer_name VARCHAR,
  total_orders INTEGER,
  lifetime_value NUMERIC,
  current_tier VARCHAR,
  last_order_date TIMESTAMP
) AS $$
SELECT
  c.name,
  COUNT(o.id)::INTEGER,
  COALESCE(SUM(o.total), 0),
  c.tier,
  MAX(o.created_at)
FROM demo.customers c
LEFT JOIN demo.orders o ON c.id = o.customer_id AND o.status NOT IN ('cancelled', 'refunded')
WHERE c.id = customer_id
GROUP BY c.id, c.name, c.tier;
$$ LANGUAGE SQL STABLE;

-- Function to check low inventory
CREATE OR REPLACE FUNCTION demo.check_low_inventory()
RETURNS TABLE(
  product_name VARCHAR,
  warehouse VARCHAR,
  current_quantity INTEGER,
  reorder_point INTEGER
) AS $$
SELECT
  p.name,
  i.warehouse_name,
  i.quantity,
  i.reorder_point
FROM demo.inventory i
JOIN demo.products p ON i.product_id = p.id
WHERE i.quantity < i.reorder_point
ORDER BY i.quantity;
$$ LANGUAGE SQL STABLE;

-- ================================================
-- COMMENTED UNOPTIMIZED QUERIES FOR DEMO
-- ================================================

-- WARNING: These queries are intentionally unoptimized for demonstration purposes
-- In production, these patterns should be avoided

-- UNOPTIMIZED QUERY 1: Using SELECT * instead of specific columns
-- SELECT * FROM demo.orders o
-- JOIN demo.customers c ON o.customer_id = c.id
-- JOIN demo.order_items oi ON o.id = oi.order_id
-- JOIN demo.products p ON oi.product_id = p.id
-- WHERE o.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
-- ORDER BY o.created_at;

-- UNOPTIMIZED QUERY 2: Missing index on join column
-- SELECT c.name, COUNT(o.id) FROM demo.customers c
-- JOIN demo.orders o ON c.id = o.customer_id
-- WHERE c.created_at > CURRENT_TIMESTAMP - INTERVAL '90 days'
-- GROUP BY c.id, c.name;
-- (Note: index exists, but demonstrates the anti-pattern)

-- UNOPTIMIZED QUERY 3: Using LIKE with leading wildcard
-- SELECT * FROM demo.products
-- WHERE name LIKE '%Wireless%'
-- AND created_at > CURRENT_TIMESTAMP - INTERVAL '60 days';

-- UNOPTIMIZED QUERY 4: Correlated subquery instead of JOIN
-- SELECT o.id, o.total,
--   (SELECT SUM(oi.quantity) FROM demo.order_items oi WHERE oi.order_id = o.id)
-- FROM demo.orders o;

-- UNOPTIMIZED QUERY 5: N+1 query pattern (should use JOIN instead)
-- SELECT c.id, c.name FROM demo.customers c;
-- For each customer: SELECT COUNT(*) FROM demo.orders WHERE customer_id = c.id;

-- ================================================
-- SCRIPT COMPLETION
-- ================================================

-- Refresh materialized views
REFRESH MATERIALIZED VIEW demo.mv_monthly_sales;
REFRESH MATERIALIZED VIEW demo.mv_customer_lifetime_value;
REFRESH MATERIALIZED VIEW demo.mv_product_performance;

-- Display summary statistics
\echo ''
\echo '========================================='
\echo 'FATHOM Demo Database Created Successfully'
\echo '========================================='
\echo ''
SELECT 'Customers' as entity, COUNT(*) as count FROM demo.customers
UNION ALL
SELECT 'Products' as entity, COUNT(*) as count FROM demo.products
UNION ALL
SELECT 'Orders' as entity, COUNT(*) as count FROM demo.orders
UNION ALL
SELECT 'Order Items' as entity, COUNT(*) as count FROM demo.order_items
UNION ALL
SELECT 'Inventory Records' as entity, COUNT(*) as count FROM demo.inventory
UNION ALL
SELECT 'Analytics Events' as entity, COUNT(*) as count FROM demo.analytics_events
UNION ALL
SELECT 'Sessions' as entity, COUNT(*) as count FROM demo.sessions
UNION ALL
SELECT 'Audit Log Entries' as entity, COUNT(*) as count FROM demo.audit_log;

\echo ''
\echo 'Database fathom_demo in schema demo is ready for testing!'
\echo 'Connect: psql -d fathom_demo'
\echo '';
