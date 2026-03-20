import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/db/schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const client = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
