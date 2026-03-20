import { createClient } from '@libsql/client';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/db/schema';

type Db = LibSQLDatabase<typeof schema>;

let cached: Db | null = null;

function getDb(): Db {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required');
    cached = drizzle(
      createClient({
        url,
        authToken: process.env.DATABASE_AUTH_TOKEN,
      }),
      { schema },
    );
  }
  return cached;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const d = getDb();
    const v = Reflect.get(d, prop, d);
    return typeof v === 'function' ? v.bind(d) : v;
  },
});
