// MongoDB FATHOM Demo Database Seed Script
// ================================================
// This script creates and populates the FATHOM demo database with realistic sample data
//
// USAGE: mongosh < seed-mongodb.js
// OR:    mongosh --file seed-mongodb.js
// OR:    mongosh fathom_demo < seed-mongodb.js (if database already exists)
//
// CLEANUP: To remove the demo database, run in mongosh:
//   use fathom_demo
//   db.dropDatabase()
// ================================================

// Switch to the fathom_demo database (creates if doesn't exist)
use fathom_demo;

// Clear existing collections if this is a re-run
console.log("Clearing existing collections...");
db.getCollectionNames().forEach(collName => {
  db[collName].deleteMany({});
});

// ================================================
// CREATE COLLECTIONS
// ================================================

console.log("Creating collections...");

// Drop existing indexes to avoid conflicts
db.customers.dropIndexes();
db.products.dropIndexes();
db.orders.dropIndexes();
db.inventory.dropIndexes();
db.analytics_events.dropIndexes();
db.sessions.dropIndexes();
db.audit_log.dropIndexes();

// ================================================
// CREATE INDEXES
// ================================================

console.log("Creating indexes...");

// Customer indexes
db.customers.createIndex({ email: 1 }, { unique: true });
db.customers.createIndex({ tier: 1 });
db.customers.createIndex({ created_at: -1 });
db.customers.createIndex({ country: 1, city: 1 });
db.customers.createIndex({ name: "text", email: "text" }); // Text index for search

// Product indexes
db.products.createIndex({ category: 1 });
db.products.createIndex({ sku: 1 }, { unique: true });
db.products.createIndex({ created_at: -1 });
db.products.createIndex({ name: "text", description: "text" }); // Text index for search
db.products.createIndex({ price: 1 }); // For price range queries

// Order indexes
db.orders.createIndex({ customer_id: 1 });
db.orders.createIndex({ status: 1 });
db.orders.createIndex({ created_at: -1 });
db.orders.createIndex({ order_number: 1 }, { unique: true });
db.orders.createIndex({ customer_id: 1, created_at: -1 }); // Compound index for customer history

// Inventory indexes
db.inventory.createIndex({ product_id: 1, warehouse_id: 1 }, { unique: true });
db.inventory.createIndex({ warehouse_name: 1 });
db.inventory.createIndex({ quantity: 1 }); // For low stock queries

// Analytics events indexes
db.analytics_events.createIndex({ user_id: 1 });
db.analytics_events.createIndex({ event_type: 1 });
db.analytics_events.createIndex({ created_at: -1 });
db.analytics_events.createIndex({ session_id: 1 });
db.analytics_events.createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000 }); // TTL index: 90 days

// Sessions indexes
db.sessions.createIndex({ user_id: 1 });
db.sessions.createIndex({ token: 1 }, { unique: true });
db.sessions.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Audit log indexes
db.audit_log.createIndex({ table_name: 1 });
db.audit_log.createIndex({ created_at: -1 });
db.audit_log.createIndex({ operation: 1 });
db.audit_log.createIndex({ record_id: 1 });

// ================================================
// INSERT SAMPLE DATA
// ================================================

console.log("Inserting customer data...");
db.customers.insertMany([
  {
    _id: 1,
    name: "Sarah Chen",
    email: "sarah.chen@email.com",
    phone: "+1-415-555-0101",
    country: "USA",
    city: "San Francisco",
    postal_code: "94103",
    tier: "premium",
    signup_source: "referral",
    tags: ["premium", "active", "west-coast"],
    preferences: {
      email_notifications: true,
      sms_notifications: false,
      language: "en"
    },
    created_at: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 2,
    name: "Marcus Johnson",
    email: "marcus.j@email.com",
    phone: "+1-212-555-0102",
    country: "USA",
    city: "New York",
    postal_code: "10001",
    tier: "vip",
    signup_source: "direct",
    tags: ["vip", "high-value", "east-coast"],
    preferences: {
      email_notifications: true,
      sms_notifications: true,
      language: "en"
    },
    created_at: new Date(Date.now() - 73 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 3,
    name: "Elena Rodriguez",
    email: "elena.rodriguez@email.com",
    phone: "+1-305-555-0103",
    country: "USA",
    city: "Miami",
    postal_code: "33101",
    tier: "standard",
    signup_source: "organic_search",
    tags: ["standard", "new-customer"],
    preferences: {
      email_notifications: true,
      sms_notifications: false,
      language: "es"
    },
    created_at: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 4,
    name: "James Wilson",
    email: "james.wilson@email.com",
    phone: "+1-206-555-0104",
    country: "USA",
    city: "Seattle",
    postal_code: "98101",
    tier: "premium",
    signup_source: "ad_campaign",
    tags: ["premium", "active", "west-coast"],
    preferences: {
      email_notifications: true,
      sms_notifications: true,
      language: "en"
    },
    created_at: new Date(Date.now() - 51 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 5,
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    phone: "+1-408-555-0105",
    country: "USA",
    city: "San Jose",
    postal_code: "95110",
    tier: "standard",
    signup_source: "referral",
    tags: ["standard", "active"],
    preferences: {
      email_notifications: true,
      sms_notifications: false,
      language: "en"
    },
    created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 6,
    name: "David Thompson",
    email: "david.thompson@email.com",
    phone: "+1-773-555-0106",
    country: "USA",
    city: "Chicago",
    postal_code: "60601",
    tier: "vip",
    signup_source: "direct",
    tags: ["vip", "high-value"],
    preferences: {
      email_notifications: true,
      sms_notifications: true,
      language: "en"
    },
    created_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 7,
    name: "Lisa Anderson",
    email: "lisa.anderson@email.com",
    phone: "+1-512-555-0107",
    country: "USA",
    city: "Austin",
    postal_code: "78701",
    tier: "premium",
    signup_source: "organic_search",
    tags: ["premium", "tech-savvy"],
    preferences: {
      email_notifications: true,
      sms_notifications: false,
      language: "en"
    },
    created_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 8,
    name: "Robert Martinez",
    email: "robert.martinez@email.com",
    phone: "+1-619-555-0108",
    country: "USA",
    city: "San Diego",
    postal_code: "92101",
    tier: "standard",
    signup_source: "ad_campaign",
    tags: ["standard"],
    preferences: {
      email_notifications: false,
      sms_notifications: false,
      language: "es"
    },
    created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 9,
    name: "Jennifer Lee",
    email: "jennifer.lee@email.com",
    phone: "+1-617-555-0109",
    country: "USA",
    city: "Boston",
    postal_code: "02101",
    tier: "premium",
    signup_source: "referral",
    tags: ["premium", "active"],
    preferences: {
      email_notifications: true,
      sms_notifications: true,
      language: "en"
    },
    created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 10,
    name: "Christopher Brown",
    email: "christopher.brown@email.com",
    phone: "+1-404-555-0110",
    country: "USA",
    city: "Atlanta",
    postal_code: "30303",
    tier: "standard",
    signup_source: "organic_search",
    tags: ["standard", "new-customer"],
    preferences: {
      email_notifications: true,
      sms_notifications: false,
      language: "en"
    },
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 11,
    name: "Amanda White",
    email: "amanda.white@email.com",
    phone: "+44-20-7946-0958",
    country: "UK",
    city: "London",
    postal_code: "SW1A 1AA",
    tier: "premium",
    signup_source: "direct",
    tags: ["premium", "international"],
    preferences: {
      email_notifications: true,
      sms_notifications: false,
      language: "en"
    },
    created_at: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 12,
    name: "Michael Chen",
    email: "michael.chen@email.com",
    phone: "+61-2-8962-8111",
    country: "Australia",
    city: "Sydney",
    postal_code: "2000",
    tier: "vip",
    signup_source: "referral",
    tags: ["vip", "international", "high-value"],
    preferences: {
      email_notifications: true,
      sms_notifications: true,
      language: "en"
    },
    created_at: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 13,
    name: "Sophie Dubois",
    email: "sophie.dubois@email.com",
    phone: "+33-1-42-34-56-00",
    country: "France",
    city: "Paris",
    postal_code: "75001",
    tier: "standard",
    signup_source: "organic_search",
    tags: ["standard", "international"],
    preferences: {
      email_notifications: true,
      sms_notifications: false,
      language: "fr"
    },
    created_at: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 14,
    name: "Thomas Mueller",
    email: "thomas.mueller@email.com",
    phone: "+49-30-318-12934",
    country: "Germany",
    city: "Berlin",
    postal_code: "10115",
    tier: "premium",
    signup_source: "ad_campaign",
    tags: ["premium", "international"],
    preferences: {
      email_notifications: true,
      sms_notifications: false,
      language: "de"
    },
    created_at: new Date(Date.now() - 44 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 15,
    name: "Isabella Romano",
    email: "isabella.romano@email.com",
    phone: "+39-06-6991-7676",
    country: "Italy",
    city: "Rome",
    postal_code: "00100",
    tier: "standard",
    signup_source: "referral",
    tags: ["standard", "international"],
    preferences: {
      email_notifications: false,
      sms_notifications: false,
      language: "it"
    },
    created_at: new Date(Date.now() - 33 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  }
]);

console.log("Inserting product data...");
db.products.insertMany([
  {
    _id: 1,
    name: "Wireless Bluetooth Headphones",
    description: "Premium noise-cancelling headphones with 30-hour battery life. Active noise cancellation technology blocks ambient sound up to 30dB.",
    category: "Electronics",
    sku: "WBH-001",
    price: 129.99,
    cost: 45.00,
    stock: 145,
    reorder_level: 20,
    rating: 4.7,
    reviews: 234,
    tags: ["audio", "wireless", "noise-cancelling", "premium"],
    specifications: {
      battery_life: "30 hours",
      connectivity: "Bluetooth 5.0",
      weight: "250g",
      warranty: "2 years"
    },
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 2,
    name: "USB-C Lightning Cable",
    description: "High-speed charging and data transfer cable, 6ft length. Supports fast charging up to 65W and data transfer at 480 Mbps.",
    category: "Accessories",
    sku: "USB-C-001",
    price: 19.99,
    cost: 4.50,
    stock: 523,
    reorder_level: 50,
    rating: 4.5,
    reviews: 567,
    tags: ["cable", "usb-c", "charging"],
    specifications: {
      length: "6 feet (1.8m)",
      material: "Nylon braided",
      color: "Black"
    },
    created_at: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 3,
    name: "Mechanical Keyboard",
    description: "RGB mechanical keyboard with hot-swappable switches. Customizable RGB lighting with 16.8 million colors.",
    category: "Electronics",
    sku: "MKB-001",
    price: 89.99,
    cost: 35.00,
    stock: 87,
    reorder_level: 15,
    rating: 4.8,
    reviews: 345,
    tags: ["keyboard", "mechanical", "rgb", "gaming"],
    specifications: {
      switch_type: "Hot-swappable",
      layout: "Full-size",
      backlight: "RGB"
    },
    created_at: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 4,
    name: "4K Webcam",
    description: "Ultra HD webcam with auto-focus and built-in microphone. Supports up to 4K resolution at 30fps.",
    category: "Electronics",
    sku: "WEBCAM-001",
    price: 149.99,
    cost: 60.00,
    stock: 52,
    reorder_level: 10,
    rating: 4.6,
    reviews: 189,
    tags: ["webcam", "4k", "streaming"],
    specifications: {
      resolution: "4K (3840x2160)",
      fps: "30fps",
      focus: "Auto"
    },
    created_at: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 5,
    name: "Portable SSD 1TB",
    description: "Fast external solid state drive with USB-C 3.1. Read speeds up to 1050 MB/s.",
    category: "Storage",
    sku: "SSD-1TB-001",
    price: 179.99,
    cost: 80.00,
    stock: 98,
    reorder_level: 15,
    rating: 4.8,
    reviews: 412,
    tags: ["storage", "ssd", "portable"],
    specifications: {
      capacity: "1TB",
      speed: "up to 1050 MB/s",
      interface: "USB 3.1"
    },
    created_at: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 6,
    name: "Ergonomic Mouse Pad",
    description: "Memory foam wrist rest mouse pad with non-slip base. Reduces strain during extended work sessions.",
    category: "Accessories",
    sku: "MOUSEPAD-001",
    price: 24.99,
    cost: 8.00,
    stock: 287,
    reorder_level: 40,
    rating: 4.4,
    reviews: 156,
    tags: ["mouse-pad", "ergonomic", "wrist-rest"],
    specifications: {
      material: "Memory foam",
      size: "270 x 350mm",
      base: "Non-slip rubber"
    },
    created_at: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 7,
    name: "USB Hub 7-Port",
    description: "Multi-port USB hub with individual switches and power adapter. Supports high-speed charging.",
    category: "Electronics",
    sku: "USBHUB-001",
    price: 39.99,
    cost: 15.00,
    stock: 156,
    reorder_level: 20,
    rating: 4.5,
    reviews: 203,
    tags: ["usb-hub", "multi-port", "expansion"],
    specifications: {
      ports: 7,
      power: "Powered with adapter",
      current: "2.4A per port"
    },
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 8,
    name: "Laptop Stand Aluminum",
    description: "Adjustable laptop stand with cooling ventilation. Supports laptops up to 15 inches.",
    category: "Accessories",
    sku: "LAPSTAND-001",
    price: 44.99,
    cost: 18.00,
    stock: 201,
    reorder_level: 25,
    rating: 4.7,
    reviews: 289,
    tags: ["stand", "laptop", "cooling"],
    specifications: {
      material: "Aluminum alloy",
      max_weight: "10kg",
      adjustable: true
    },
    created_at: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 9,
    name: "Wireless Mouse",
    description: "Quiet wireless mouse with 2.4GHz receiver and 18-month battery. Ultra-precise optical tracking.",
    category: "Electronics",
    sku: "WMOUSE-001",
    price: 34.99,
    cost: 12.00,
    stock: 334,
    reorder_level: 30,
    rating: 4.6,
    reviews: 267,
    tags: ["mouse", "wireless", "quiet"],
    specifications: {
      dpi: "1600 DPI",
      battery: "18 months",
      buttons: 3
    },
    created_at: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 10,
    name: "Screen Protector Pack",
    description: "Anti-glare screen protectors for 15.6-inch laptops (5-pack). Reduces reflection and eye strain.",
    category: "Accessories",
    sku: "SCRPROT-001",
    price: 14.99,
    cost: 3.00,
    stock: 412,
    reorder_level: 50,
    rating: 4.3,
    reviews: 134,
    tags: ["screen-protector", "anti-glare"],
    specifications: {
      size: "15.6 inches",
      quantity: 5,
      material: "Tempered glass"
    },
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  }
]);

console.log("Inserting order data...");
db.orders.insertMany([
  {
    _id: 1,
    customer_id: 1,
    order_number: "ORD-2026-0001",
    items: [
      {
        product_id: 1,
        product_name: "Wireless Bluetooth Headphones",
        quantity: 1,
        unit_price: 129.99,
        discount_percent: 0
      }
    ],
    subtotal: 129.98,
    tax: 20.00,
    total: 149.98,
    status: "delivered",
    shipping_address: {
      street: "123 Market St",
      city: "San Francisco",
      state: "CA",
      postal_code: "94103",
      country: "USA"
    },
    payment_method: "credit_card",
    payment_status: "completed",
    created_at: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000),
    shipped_at: new Date(Date.now() - 77 * 24 * 60 * 60 * 1000),
    delivered_at: new Date(Date.now() - 74 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 2,
    customer_id: 2,
    order_number: "ORD-2026-0002",
    items: [
      {
        product_id: 3,
        product_name: "Mechanical Keyboard",
        quantity: 1,
        unit_price: 89.99,
        discount_percent: 10
      },
      {
        product_id: 6,
        product_name: "Ergonomic Mouse Pad",
        quantity: 2,
        unit_price: 24.99,
        discount_percent: 0
      }
    ],
    subtotal: 189.98,
    tax: 20.00,
    total: 209.98,
    status: "delivered",
    shipping_address: {
      street: "456 Broadway",
      city: "New York",
      state: "NY",
      postal_code: "10001",
      country: "USA"
    },
    payment_method: "credit_card",
    payment_status: "completed",
    created_at: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
    shipped_at: new Date(Date.now() - 68 * 24 * 60 * 60 * 1000),
    delivered_at: new Date(Date.now() - 64 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 3,
    customer_id: 3,
    order_number: "ORD-2026-0003",
    items: [
      {
        product_id: 2,
        product_name: "USB-C Lightning Cable",
        quantity: 4,
        unit_price: 19.99,
        discount_percent: 0
      }
    ],
    subtotal: 79.97,
    tax: 10.00,
    total: 89.97,
    status: "delivered",
    shipping_address: {
      street: "789 Ocean Dr",
      city: "Miami",
      state: "FL",
      postal_code: "33101",
      country: "USA"
    },
    payment_method: "paypal",
    payment_status: "completed",
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    shipped_at: new Date(Date.now() - 57 * 24 * 60 * 60 * 1000),
    delivered_at: new Date(Date.now() - 54 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 4,
    customer_id: 4,
    order_number: "ORD-2026-0004",
    items: [
      {
        product_id: 5,
        product_name: "Portable SSD 1TB",
        quantity: 1,
        unit_price: 179.99,
        discount_percent: 5
      },
      {
        product_id: 4,
        product_name: "4K Webcam",
        quantity: 1,
        unit_price: 149.99,
        discount_percent: 0
      }
    ],
    subtotal: 269.96,
    tax: 30.00,
    total: 299.96,
    status: "shipped",
    shipping_address: {
      street: "321 Pike St",
      city: "Seattle",
      state: "WA",
      postal_code: "98101",
      country: "USA"
    },
    payment_method: "credit_card",
    payment_status: "completed",
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    shipped_at: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000),
    delivered_at: null,
    updated_at: new Date()
  },
  {
    _id: 5,
    customer_id: 5,
    order_number: "ORD-2026-0005",
    items: [
      {
        product_id: 11,
        product_name: "USB-A to USB-C Adapter",
        quantity: 5,
        unit_price: 12.99,
        discount_percent: 15
      }
    ],
    subtotal: 109.97,
    tax: 15.00,
    total: 124.97,
    status: "processing",
    shipping_address: {
      street: "654 Park Ave",
      city: "San Jose",
      state: "CA",
      postal_code: "95110",
      country: "USA"
    },
    payment_method: "debit_card",
    payment_status: "completed",
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    shipped_at: null,
    delivered_at: null,
    updated_at: new Date()
  },
  {
    _id: 6,
    customer_id: 6,
    order_number: "ORD-2026-0006",
    items: [
      {
        product_id: 9,
        product_name: "Wireless Mouse",
        quantity: 2,
        unit_price: 34.99,
        discount_percent: 0
      },
      {
        product_id: 10,
        product_name: "Screen Protector Pack",
        quantity: 3,
        unit_price: 14.99,
        discount_percent: 0
      }
    ],
    subtotal: 159.98,
    tax: 20.00,
    total: 179.98,
    status: "delivered",
    shipping_address: {
      street: "987 Michigan Ave",
      city: "Chicago",
      state: "IL",
      postal_code: "60601",
      country: "USA"
    },
    payment_method: "credit_card",
    payment_status: "completed",
    created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    shipped_at: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000),
    delivered_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 7,
    customer_id: 7,
    order_number: "ORD-2026-0007",
    items: [
      {
        product_id: 2,
        product_name: "USB-C Lightning Cable",
        quantity: 4,
        unit_price: 19.99,
        discount_percent: 0
      }
    ],
    subtotal: 79.97,
    tax: 10.00,
    total: 89.97,
    status: "delivered",
    shipping_address: {
      street: "321 Congress Ave",
      city: "Austin",
      state: "TX",
      postal_code: "78701",
      country: "USA"
    },
    payment_method: "paypal",
    payment_status: "completed",
    created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
    shipped_at: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000),
    delivered_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  },
  {
    _id: 8,
    customer_id: 8,
    order_number: "ORD-2026-0008",
    items: [
      {
        product_id: 7,
        product_name: "USB Hub 7-Port",
        quantity: 2,
        unit_price: 39.99,
        discount_percent: 10
      },
      {
        product_id: 8,
        product_name: "Laptop Stand Aluminum",
        quantity: 1,
        unit_price: 44.99,
        discount_percent: 0
      }
    ],
    subtotal: 189.97,
    tax: 20.00,
    total: 209.97,
    status: "processing",
    shipping_address: {
      street: "654 Harbor St",
      city: "San Diego",
      state: "CA",
      postal_code: "92101",
      country: "USA"
    },
    payment_method: "credit_card",
    payment_status: "completed",
    created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    shipped_at: null,
    delivered_at: null,
    updated_at: new Date()
  },
  {
    _id: 9,
    customer_id: 9,
    order_number: "ORD-2026-0009",
    items: [
      {
        product_id: 13,
        product_name: "External Hard Drive 2TB",
        quantity: 1,
        unit_price: 89.99,
        discount_percent: 0
      },
      {
        product_id: 6,
        product_name: "Ergonomic Mouse Pad",
        quantity: 2,
        unit_price: 24.99,
        discount_percent: 10
      }
    ],
    subtotal: 139.96,
    tax: 20.00,
    total: 159.96,
    status: "confirmed",
    shipping_address: {
      street: "987 Newbury St",
      city: "Boston",
      state: "MA",
      postal_code: "02101",
      country: "USA"
    },
    payment_method: "credit_card",
    payment_status: "completed",
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    shipped_at: null,
    delivered_at: null,
    updated_at: new Date()
  },
  {
    _id: 10,
    customer_id: 10,
    order_number: "ORD-2026-0010",
    items: [
      {
        product_id: 14,
        product_name: "Phone Stand",
        quantity: 3,
        unit_price: 16.99,
        discount_percent: 0
      }
    ],
    subtotal: 84.98,
    tax: 10.00,
    total: 94.98,
    status: "delivered",
    shipping_address: {
      street: "321 West Peachtree",
      city: "Atlanta",
      state: "GA",
      postal_code: "30303",
      country: "USA"
    },
    payment_method: "debit_card",
    payment_status: "completed",
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    shipped_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    delivered_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    updated_at: new Date()
  }
]);

console.log("Inserting inventory data...");
db.inventory.insertMany([
  {
    product_id: 1,
    warehouse_id: 1,
    warehouse_name: "San Francisco",
    quantity: 45,
    reserved_quantity: 8,
    reorder_point: 20,
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  },
  {
    product_id: 1,
    warehouse_id: 2,
    warehouse_name: "Chicago",
    quantity: 52,
    reserved_quantity: 12,
    reorder_point: 20,
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  },
  {
    product_id: 1,
    warehouse_id: 3,
    warehouse_name: "New York",
    quantity: 48,
    reserved_quantity: 10,
    reorder_point: 20,
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  },
  {
    product_id: 2,
    warehouse_id: 1,
    warehouse_name: "San Francisco",
    quantity: 187,
    reserved_quantity: 25,
    reorder_point: 50,
    updated_at: new Date(Date.now() - 0.083 * 24 * 60 * 60 * 1000) // 2 hours
  },
  {
    product_id: 2,
    warehouse_id: 2,
    warehouse_name: "Chicago",
    quantity: 193,
    reserved_quantity: 30,
    reorder_point: 50,
    updated_at: new Date(Date.now() - 0.167 * 24 * 60 * 60 * 1000) // 4 hours
  },
  {
    product_id: 2,
    warehouse_id: 3,
    warehouse_name: "New York",
    quantity: 143,
    reserved_quantity: 20,
    reorder_point: 50,
    updated_at: new Date(Date.now() - 0.042 * 24 * 60 * 60 * 1000) // 1 hour
  },
  {
    product_id: 3,
    warehouse_id: 1,
    warehouse_name: "San Francisco",
    quantity: 28,
    reserved_quantity: 5,
    reorder_point: 15,
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  },
  {
    product_id: 3,
    warehouse_id: 2,
    warehouse_name: "Chicago",
    quantity: 31,
    reserved_quantity: 8,
    reorder_point: 15,
    updated_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
  },
  {
    product_id: 3,
    warehouse_id: 3,
    warehouse_name: "New York",
    quantity: 28,
    reserved_quantity: 6,
    reorder_point: 15,
    updated_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
  },
  {
    product_id: 4,
    warehouse_id: 1,
    warehouse_name: "San Francisco",
    quantity: 18,
    reserved_quantity: 3,
    reorder_point: 10,
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  }
]);

console.log("Inserting analytics events data...");
db.analytics_events.insertMany([
  {
    user_id: 1,
    session_id: "sess_001_sf",
    event_type: "page_view",
    event_source: "web",
    payload: {
      page: "/products",
      referrer: "/home",
      load_time_ms: 345
    },
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    ip_address: "192.168.1.101",
    created_at: new Date(Date.now() - 89 * 24 * 60 * 60 * 1000)
  },
  {
    user_id: 2,
    session_id: "sess_002_ny",
    event_type: "add_to_cart",
    event_source: "web",
    payload: {
      product_id: 1,
      product_name: "Wireless Bluetooth Headphones",
      quantity: 1,
      price: 129.99,
      cart_value: 129.99
    },
    user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    ip_address: "203.0.113.45",
    created_at: new Date(Date.now() - 88 * 24 * 60 * 60 * 1000)
  },
  {
    user_id: 3,
    session_id: "sess_003_mi",
    event_type: "checkout_start",
    event_source: "web",
    payload: {
      cart_value: 89.97,
      items: 4,
      funnel_step: "checkout_initiation"
    },
    user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)",
    ip_address: "198.51.100.89",
    created_at: new Date(Date.now() - 87 * 24 * 60 * 60 * 1000)
  },
  {
    user_id: 4,
    session_id: "sess_004_se",
    event_type: "purchase",
    event_source: "web",
    payload: {
      order_id: "ORD-2026-0001",
      total: 149.98,
      currency: "USD",
      payment_method: "credit_card",
      items: 1
    },
    user_agent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    ip_address: "192.0.2.123",
    created_at: new Date(Date.now() - 86 * 24 * 60 * 60 * 1000)
  },
  {
    user_id: 5,
    session_id: "sess_005_sj",
    event_type: "page_view",
    event_source: "mobile_app",
    payload: {
      page: "/my_orders",
      platform: "ios",
      app_version: "2.1.0"
    },
    user_agent: "Mobile Safari 14.1",
    ip_address: "203.0.113.200",
    created_at: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000)
  },
  {
    user_id: 1,
    session_id: "sess_006_sf",
    event_type: "search",
    event_source: "web",
    payload: {
      query: "wireless headphones",
      results: 12,
      category: "Electronics",
      filters_applied: ["price_range"]
    },
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    ip_address: "192.168.1.101",
    created_at: new Date(Date.now() - 84 * 24 * 60 * 60 * 1000)
  },
  {
    user_id: 2,
    session_id: "sess_007_ny",
    event_type: "product_view",
    event_source: "web",
    payload: {
      product_id: 3,
      product_name: "Mechanical Keyboard",
      category: "Electronics",
      price: 89.99,
      in_stock: true
    },
    user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    ip_address: "203.0.113.45",
    created_at: new Date(Date.now() - 83 * 24 * 60 * 60 * 1000)
  },
  {
    user_id: 6,
    session_id: "sess_008_ch",
    event_type: "add_to_wishlist",
    event_source: "web",
    payload: {
      product_id: 5,
      product_name: "Portable SSD 1TB",
      price: 179.99,
      wishlist_size: 3
    },
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    ip_address: "198.51.100.44",
    created_at: new Date(Date.now() - 82 * 24 * 60 * 60 * 1000)
  },
  {
    user_id: 7,
    session_id: "sess_009_au",
    event_type: "category_view",
    event_source: "web",
    payload: {
      category: "Electronics",
      product_count: 45,
      sort_by: "popularity"
    },
    user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X)",
    ip_address: "192.0.2.67",
    created_at: new Date(Date.now() - 81 * 24 * 60 * 60 * 1000)
  },
  {
    user_id: 8,
    session_id: "sess_010_sd",
    event_type: "cart_view",
    event_source: "web",
    payload: {
      items: 3,
      total_value: 209.97,
      abandoned_cart_warning: false
    },
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    ip_address: "203.0.113.78",
    created_at: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000)
  }
]);

console.log("Inserting sessions data...");
db.sessions.insertMany([
  {
    user_id: 1,
    token: "token_sf_001_abc123def456",
    ip_address: "192.168.1.101",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    last_activity: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
  },
  {
    user_id: 2,
    token: "token_ny_002_ghi789jkl012",
    ip_address: "203.0.113.45",
    user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    last_activity: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    created_at: new Date(Date.now() - 45 * 60 * 1000) // 45 minutes ago
  },
  {
    user_id: 3,
    token: "token_mi_003_mno345pqr678",
    ip_address: "198.51.100.89",
    user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6)",
    last_activity: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    created_at: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
  },
  {
    user_id: 4,
    token: "token_se_004_stu901vwx234",
    ip_address: "192.0.2.123",
    user_agent: "Mozilla/5.0 (X11; Linux x86_64)",
    last_activity: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    created_at: new Date(Date.now() - 6 * 60 * 1000) // 6 minutes ago
  },
  {
    user_id: 5,
    token: "token_sj_005_yza567bcd890",
    ip_address: "203.0.113.200",
    user_agent: "Mobile Safari 14.1",
    last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago
  }
]);

console.log("Inserting audit log data...");
db.audit_log.insertMany([
  {
    table_name: "orders",
    record_id: 1,
    operation: "INSERT",
    old_data: null,
    new_data: {
      order_number: "ORD-2026-0001",
      customer_id: 1,
      status: "pending",
      total: 149.98
    },
    performed_by: "system",
    change_reason: "Order creation",
    created_at: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000)
  },
  {
    table_name: "orders",
    record_id: 1,
    operation: "UPDATE",
    old_data: {
      status: "pending"
    },
    new_data: {
      status: "confirmed"
    },
    performed_by: "admin_user",
    change_reason: "Order confirmation",
    created_at: new Date(Date.now() - 79 * 24 * 60 * 60 * 1000)
  },
  {
    table_name: "orders",
    record_id: 1,
    operation: "UPDATE",
    old_data: {
      status: "confirmed"
    },
    new_data: {
      status: "shipped",
      shipped_at: new Date(Date.now() - 77 * 24 * 60 * 60 * 1000)
    },
    performed_by: "system",
    change_reason: "Order shipped",
    created_at: new Date(Date.now() - 77 * 24 * 60 * 60 * 1000)
  },
  {
    table_name: "customers",
    record_id: 1,
    operation: "UPDATE",
    old_data: {
      tier: "standard"
    },
    new_data: {
      tier: "premium"
    },
    performed_by: "system",
    change_reason: "Tier upgrade based on purchase history",
    created_at: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000)
  },
  {
    table_name: "products",
    record_id: 1,
    operation: "UPDATE",
    old_data: {
      stock: 150
    },
    new_data: {
      stock: 145
    },
    performed_by: "system",
    change_reason: "Inventory adjustment - sales",
    created_at: new Date(Date.now() - 74 * 24 * 60 * 60 * 1000)
  }
]);

// ================================================
// AGGREGATION PIPELINE EXAMPLES (as comments)
// ================================================

console.log("\n=== Aggregation Pipeline Examples ===\n");

// Example 1: Monthly sales summary
console.log("Example 1: Monthly Sales Summary");
console.log("db.orders.aggregate([");
console.log("  {$match: {status: {$in: ['delivered', 'shipped']}}},");
console.log("  {$group: {");
console.log("    _id: {$dateToString: {format: '%Y-%m', date: '$created_at'}},");
console.log("    total_orders: {$sum: 1},");
console.log("    total_revenue: {$sum: '$total'},");
console.log("    avg_order_value: {$avg: '$total'}");
console.log("  }},");
console.log("  {$sort: {_id: -1}}");
console.log("])\n");

// Example 2: Customer lifetime value
console.log("Example 2: Customer Lifetime Value");
console.log("db.orders.aggregate([");
console.log("  {$match: {status: {$nin: ['cancelled', 'refunded']}}},");
console.log("  {$group: {");
console.log("    _id: '$customer_id',");
console.log("    total_spent: {$sum: '$total'},");
console.log("    order_count: {$sum: 1},");
console.log("    avg_order: {$avg: '$total'},");
console.log("    last_order: {$max: '$created_at'}");
console.log("  }},");
console.log("  {$lookup: {");
console.log("    from: 'customers',");
console.log("    localField: '_id',");
console.log("    foreignField: '_id',");
console.log("    as: 'customer_info'");
console.log("  }},");
console.log("  {$sort: {total_spent: -1}}");
console.log("])\n");

// Example 3: Product performance analysis
console.log("Example 3: Product Performance");
console.log("db.orders.aggregate([");
console.log("  {$unwind: '$items'},");
console.log("  {$group: {");
console.log("    _id: '$items.product_id',");
console.log("    units_sold: {$sum: '$items.quantity'},");
console.log("    revenue: {$sum: {$multiply: ['$items.quantity', '$items.unit_price']}},");
console.log("    order_count: {$sum: 1}");
console.log("  }},");
console.log("  {$lookup: {");
console.log("    from: 'products',");
console.log("    localField: '_id',");
console.log("    foreignField: '_id',");
console.log("    as: 'product'");
console.log("  }},");
console.log("  {$sort: {revenue: -1}}");
console.log("])\n");

// Example 4: Low inventory alert
console.log("Example 4: Low Inventory Alert");
console.log("db.inventory.aggregate([");
console.log("  {$match: {$expr: {$lt: ['$quantity', '$reorder_point']}}},");
console.log("  {$lookup: {");
console.log("    from: 'products',");
console.log("    localField: 'product_id',");
console.log("    foreignField: '_id',");
console.log("    as: 'product'");
console.log("  }},");
console.log("  {$project: {");
console.log("    warehouse: '$warehouse_name',");
console.log("    product_name: '$product.name',");
console.log("    current_qty: '$quantity',");
console.log("    reorder_point: '$reorder_point'");
console.log("  }}");
console.log("])\n");

// ================================================
// SHARDING RECOMMENDATIONS (as comments)
// ================================================

console.log("=== Sharding Recommendations ===\n");

console.log("For production scalability, consider these shard keys:\n");

console.log("1. Orders Collection:");
console.log("   sh.shardCollection('fathom_demo.orders', {customer_id: 'hashed'})");
console.log("   - Distributes orders evenly across shards");
console.log("   - Enables range queries by customer\n");

console.log("2. Analytics Events Collection:");
console.log("   sh.shardCollection('fathom_demo.analytics_events', {created_at: 1})");
console.log("   - Good for time-series data");
console.log("   - Enables efficient TTL index pruning per shard\n");

console.log("3. Customers Collection:");
console.log("   sh.shardCollection('fathom_demo.customers', {country: 1, _id: 'hashed'})");
console.log("   - Distributes by geography");
console.log("   - Maintains locality of customer data\n");

// ================================================
// SCRIPT COMPLETION
// ================================================

console.log("=========================================");
console.log("FATHOM Demo Database Created Successfully");
console.log("=========================================\n");

// Display collection statistics
const collections = ['customers', 'products', 'orders', 'inventory', 'analytics_events', 'sessions', 'audit_log'];
collections.forEach(collName => {
  const count = db[collName].countDocuments();
  console.log(`${collName.padEnd(25)}: ${count} documents`);
});

console.log("\nDatabase fathom_demo is ready for testing!");
console.log("Connect: mongosh fathom_demo\n");
