/**
 * FATHOM SDK TypeScript definitions
 *
 * NOTE: There are two distinct JS clients in this package — see ENTRYPOINTS.md.
 *   - `FathomSDK` (this file / src/index.js): the ingest/telemetry client.
 *     Auth header `X-SDK-Key`, endpoints `/api/sdk/ingest`, `/api/sdk/heartbeat`,
 *     `/api/otlp/v1/traces`. This is the canonical client for app instrumentation.
 *   - `FathomClient` (src/core/client.js): the management/control-plane client.
 *     Auth header `X-API-Key` (+ optional JWT refresh), endpoints `/api/v1/*`.
 * They are NOT interchangeable. Import the one matching your use case.
 */

export const SDK_VERSION: string;

declare class FathomSDK {
  apiKey: string;
  endpoint: string;
  environment: string;
  appName: string;
  batchSize: number;
  flushInterval: number;
  debug: boolean;
  queue: Event[];
  sessionId: string;

  constructor(options: FathomOptions);

  trackAPI(options: TrackAPIOptions): void;
  trackError(options: TrackErrorOptions): void;
  trackAudit(options: TrackAuditOptions): void;
  trackMetric(options: TrackMetricOptions): void;
  track(eventType: string, options: TrackCustomOptions): void;

  expressMiddleware(): (req: any, res: any, next: any) => void;
  captureUncaughtExceptions(): void;

  start(): void;
  flush(): Promise<void>;
  heartbeat(status?: string, metadata?: Record<string, any>): Promise<void>;
  shutdown(): Promise<void>;

  on(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;
  removeAllListeners(event?: string): this;
}

interface FathomOptions {
  apiKey: string;
  endpoint: string;
  appName?: string;
  environment?: string;
  batchSize?: number;
  flushInterval?: number;
  debug?: boolean;
  /** Max events buffered before oldest-drop. Default 10000. */
  maxQueueSize?: number;
  /** Max retry attempts per flush (exp. backoff + jitter). Default 3. */
  maxRetries?: number;
}

interface TrackAPIOptions {
  method: string;
  endpoint: string;
  statusCode: number;
  durationMs: number;
  metadata?: Record<string, any>;
}

interface TrackErrorOptions {
  error: Error | string | Record<string, any>;
  title?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, any>;
}

interface TrackAuditOptions {
  title: string;
  message?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, any>;
}

interface TrackMetricOptions {
  title: string;
  value: number;
  unit?: string;
  metadata?: Record<string, any>;
}

interface TrackCustomOptions {
  title?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  message?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

interface Event {
  type: string;
  title: string;
  severity: string;
  metadata: Record<string, any>;
  timestamp: string;
  sessionId: string;
  appName: string;
  environment: string;
}

export default FathomSDK;
export { FathomSDK };
