/**
 * API request/response wrapper types
 */

// ── Generic API Response ────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ── API Error ───────────────────────────────────────────────────────────────
export interface ApiError {
  error: string;
  message?: string;
  stack?: string;        // only in development
  path?: string;
  status?: number;
}

// ── WebSocket Messages ──────────────────────────────────────────────────────
export type WsMessageType = 'snapshot' | 'alert' | 'metric' | 'connection_status';

export interface WsMessage<T = unknown> {
  type: WsMessageType;
  payload?: T;
}

// ── Request Options (frontend fetch wrapper) ────────────────────────────────
// Note: Defined inline in frontend/src/utils/api.ts to avoid DOM dependency in shared types

// ── Feedback ────────────────────────────────────────────────────────────────
export interface FeedbackInput {
  rating: number;
  category: string;
  message: string;
  page?: string;
}
