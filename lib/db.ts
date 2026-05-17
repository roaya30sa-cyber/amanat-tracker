// D1 access helper — usable in Server Components, Route Handlers, and Server Actions on the Cloudflare Pages edge runtime.

import { getRequestContext } from '@cloudflare/next-on-pages';

export interface Env {
  DB: D1Database;
}

/**
 * Returns the bound D1 database. Throws if the binding isn't present —
 * a clear signal that wrangler.toml is missing the `[[d1_databases]]` block
 * or that the route isn't using `runtime = 'edge'`.
 */
export function getDB(): D1Database {
  const ctx = getRequestContext();
  const env = ctx.env as unknown as Env;
  if (!env?.DB) {
    throw new Error(
      'D1 database binding "DB" not found. Ensure wrangler.toml has [[d1_databases]] with binding="DB" ' +
      'and that the route exports `runtime = "edge"`.'
    );
  }
  return env.DB;
}
