
import { Pool } from 'pg';
import { env } from './env.js';

// Create a reusable PostgreSQL connection pool.
export const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  max: env.DB_MAX_CONNECTIONS,
});

// Log unexpected errors on idle connections.
pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

// Verify that PostgreSQL is reachable.
export async function checkDatabaseConnection(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('SELECT 1');
    console.log('PostgreSQL database connected successfully.');
  } finally {
    client.release();
  }
}
