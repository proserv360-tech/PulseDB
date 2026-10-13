/**
 * types/express.d.ts
 * ────────────────────
 * Centralized Express Request type extensions to prevent duplicate interface declarations.
 */

import type { AuthenticatedUser } from '../middleware/authenticate.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      orgId?: number | undefined;
      orgRole?: string;
      licenseTier?: string;
    }
  }
}
