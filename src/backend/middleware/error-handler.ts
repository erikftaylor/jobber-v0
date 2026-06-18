import type { Request, Response, NextFunction } from 'express';

/**
 * Express error-handling middleware.
 *
 * Express only recognizes a middleware as an error handler when it declares
 * four parameters (err, req, res, next). The previous inline handler in
 * index.ts omitted `next`, so Express registered it as ordinary middleware and
 * it never caught forwarded errors — requests fell through to Express's default
 * HTML error page instead of the JSON shape the API promises elsewhere.
 *
 * Behavior is otherwise unchanged: log the error and return a 500 with a JSON
 * `{ error }` body, falling back to a generic message.
 */
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction // unused, but required so Express treats this as an error handler
): void {
  console.error('Server error:', err);
  res.status(500).json({
    error: err?.message || 'Internal server error',
  });
}
