
import { config } from 'dotenv';

// Load test environment before importing the database pool.
config({
  path: '.env.test',
  override: true,
});

// Safety guard: never run automated tests against development DB.
if (process.env.DB_NAME !== 'ai_task_api_test') {
  throw new Error(
    `Unsafe test database: expected ai_task_api_test, received ${process.env.DB_NAME}`,
  );
}

// Import the pool only after loading test environment variables.
const { pool } = await import('../config/database.js');

// Ensure the test database has the tasks table.
await pool.query(`
  CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tasks_status_check
      CHECK (status IN ('pending', 'in_progress', 'completed'))
  )
`);
