/**
 * Example: Express server with PulseDB integration
 * Demonstrates auto-tracking of HTTP requests and error handling
 */
import express from 'express';
import PulseDBSDK from '../src/index.js';

// Initialize PulseDB SDK
const pulsedb = new PulseDBSDK({
  apiKey: process.env.PULSEDB_API_KEY || 'sk_live_demo_key',
  endpoint: process.env.PULSEDB_ENDPOINT || 'https://pulsedb.example.com',
  appName: 'express-example',
  environment: process.env.NODE_ENV || 'development',
  batchSize: 10,
  flushInterval: 5000,
  debug: true,
});

// Create Express app
const app = express();

// Add PulseDB middleware (must be early in the chain)
app.use(pulsedb.expressMiddleware());

// Capture uncaught exceptions
pulsedb.captureUncaughtExceptions();

// Routes
app.get('/api/users', (req, res) => {
  res.json({ users: [{ id: 1, name: 'Alice' }] });
});

app.post('/api/users', (req, res) => {
  pulsedb.trackAudit({
    title: 'User Created',
    message: 'New user account created',
    metadata: { ip: req.ip },
  });
  res.status(201).json({ id: 2, name: 'Bob' });
});

app.get('/api/error', (req, res) => {
  const error = new Error('Simulated error');
  pulsedb.trackError({
    error,
    severity: 'error',
    metadata: { endpoint: req.path },
  });
  res.status(500).json({ error: error.message });
});

app.get('/api/metric', (req, res) => {
  pulsedb.trackMetric({
    title: 'API Response Time',
    value: Math.random() * 500,
    unit: 'ms',
  });
  res.json({ metric: 'recorded' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM: Shutting down...');
  await pulsedb.shutdown();
  process.exit(0);
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  pulsedb.start();
});
