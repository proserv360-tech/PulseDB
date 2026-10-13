import { useEffect, useRef, useState } from 'react';

export interface MetricUpdate {
  type: 'cpu' | 'memory' | 'connections' | 'tps' | 'replication_lag' | 'cache_hit' | 'disk_io' | 'custom';
  value: number;
  timestamp: number;
  unit?: string;
  metadata?: Record<string, any>;
}

export interface UseRealtimeMetricsOptions {
  url?: string;
  enabled?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (update: MetricUpdate) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface UseRealtimeMetricsReturn {
  isConnected: boolean;
  lastUpdate: MetricUpdate | null;
  metrics: Record<string, MetricUpdate[]>;
  latency: number;
  reconnectCount: number;
  send: (data: any) => void;
  disconnect: () => void;
  reconnect: () => void;
}

export function useRealtimeMetrics(options?: UseRealtimeMetricsOptions): UseRealtimeMetricsReturn {
  const {
    url = typeof window !== 'undefined' ? `ws://${window.location.host}/ws/metrics` : '',
    enabled = true,
    reconnectInterval = 1000,
    maxReconnectAttempts = 10,
    onMessage,
    onError,
    onConnect,
    onDisconnect,
  } = options || {};

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimeRef = useRef<number>(0);

  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<MetricUpdate | null>(null);
  const [metrics, setMetrics] = useState<Record<string, MetricUpdate[]>>({});
  const [latency, setLatency] = useState(0);
  const [reconnectCount, setReconnectCount] = useState(0);

  const connect = () => {
    if (!enabled || !url || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        setReconnectCount(0);
        onConnect?.();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const update: MetricUpdate = JSON.parse(event.data);
          const receivedTime = Date.now();
          const calculatedLatency = receivedTime - update.timestamp;

          setLatency(calculatedLatency);
          setLastUpdate(update);
          onMessage?.(update);

          setMetrics((prev) => {
            const key = update.type;
            const existing = prev[key] || [];
            const updated = [...existing, update].slice(-60);
            return { ...prev, [key]: updated };
          });
        } catch (error) {
          console.error('Failed to parse metric update:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        onDisconnect?.();

        if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const backoffDelay = Math.min(reconnectInterval * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current += 1;
          setReconnectCount(reconnectAttemptsRef.current);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, backoffDelay);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      onError?.(error as Event);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  };

  const reconnect = () => {
    reconnectAttemptsRef.current = 0;
    disconnect();
    setTimeout(() => connect(), 100);
  };

  const send = (data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  };

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, url]);

  return {
    isConnected,
    lastUpdate,
    metrics,
    latency,
    reconnectCount,
    send,
    disconnect,
    reconnect,
  };
}