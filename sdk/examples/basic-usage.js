/**
 * Example: Basic usage of PulseDB SDK
 * Demonstrates core tracking methods
 */
import PulseDBSDK from '../src/index.js';

// Initialize
const pulsedb = new PulseDBSDK({
  apiKey: 'sk_live_your_api_key',
  endpoint: 'https://pulsedb.example.com',
  appName: 'my-service',
  environment: 'production',
  debug: true,
});

// Start auto-flush
pulsedb.start();

// Track an API call
pulsedb.trackAPI({
  method: 'GET',
  endpoint: '/api/products',
  statusCode: 200,
  durationMs: 123,
  metadata: { cached: true },
});

// Track an error
try {
  throw new Error('Database connection failed');
} catch (error) {
  pulsedb.trackError({
    error,
    severity: 'critical',
    metadata: { database: 'postgres', host: 'db.example.com' },
  });
}

// Track an audit event
pulsedb.trackAudit({
  title: 'Admin Login',
  message: 'Administrator logged in from new IP',
  metadata: { adminId: 'admin_123', ip: '203.0.113.42' },
});

// Track a metric
pulsedb.trackMetric({
  title: 'Database Connection Pool',
  value: 45,
  unit: '%',
  metadata: { maxConnections: 100 },
});

// Track a custom event
pulsedb.track('payment.processed', {
  title: 'Payment Processed',
  severity: 'info',
  message: 'Payment of $99.99 was successful',
  metadata: {
    orderId: 'order_789',
    amount: 99.99,
    currency: 'USD',
  },
  tags: ['payment', 'revenue'],
});

// Graceful shutdown
setTimeout(async () => {
  console.log('Shutting down...');
  await pulsedb.shutdown();
}, 5000);
