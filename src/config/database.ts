
import 'dotenv/config';
import { Pool } from 'pg';

// Read database configuration from environment variables.
const requiredEnv = [
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// Create a reusable PostgreSQL connection pool.
export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: Number(process.env.DB_MAX_CONNECTIONS ?? 10),
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
