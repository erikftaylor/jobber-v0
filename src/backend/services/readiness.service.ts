/**
 * Readiness reporting.
 *
 * Computes a cheap, side-effect-free operational snapshot used by the
 * health/readiness endpoint to answer "can résumé generation actually run?".
 *
 * Generation is available only when the database is reachable, Claude is
 * configured (an API key is present), and at least one source document has been
 * uploaded. This never calls Claude.
 */

export interface ReadinessDeps {
  /** Anything exposing the persisted documents; only getAllDocuments is used. */
  db: { getAllDocuments(): unknown[] };
  /** Cheap predicate for whether a Claude API key is configured. */
  isClaudeConfigured: () => boolean;
}

export interface Readiness {
  status: 'ok' | 'degraded';
  server: { ok: true };
  database: { ok: boolean; documentCount?: number };
  claude: { configured: boolean };
  generation: { available: boolean; reason?: string };
}

export function buildReadiness(deps: ReadinessDeps): Readiness {
  let databaseOk = true;
  let documentCount: number | undefined;
  try {
    documentCount = deps.db.getAllDocuments().length;
  } catch {
    databaseOk = false;
  }

  const claudeConfigured = deps.isClaudeConfigured();

  let available = true;
  let reason: string | undefined;
  if (!databaseOk) {
    available = false;
    reason = 'Database unavailable';
  } else if (!claudeConfigured) {
    available = false;
    reason = 'No Claude API key configured';
  } else if ((documentCount ?? 0) === 0) {
    available = false;
    reason = 'No uploaded source documents';
  }

  return {
    status: available ? 'ok' : 'degraded',
    server: { ok: true },
    database: databaseOk ? { ok: true, documentCount } : { ok: false },
    claude: { configured: claudeConfigured },
    generation: available ? { available: true } : { available: false, reason },
  };
}
