
import { randomUUID } from 'node:crypto';
import { pool } from '../config/database.js';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  createdAt: string;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  created_at: Date;
};

// Convert PostgreSQL column names into API response fields.
function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    ...(row.description !== null && {
      description: row.description,
    }),
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

// Create a task in PostgreSQL.
export async function createTask(
  input: { title: string; description?: string },
): Promise<Task> {
  const id = randomUUID();

  const result = await pool.query<TaskRow>(
    `INSERT INTO tasks (id, title, description)
     VALUES ($1, $2, $3)
     RETURNING id, title, description, status, created_at`,
    [id, input.title, input.description ?? null],
  );

  return mapTask(result.rows[0]!);
}

// Retrieve all tasks from PostgreSQL.
export async function getTasks(): Promise<Task[]> {
  const result = await pool.query<TaskRow>(
    `SELECT id, title, description, status, created_at
     FROM tasks
     ORDER BY created_at DESC, id DESC`,
  );

  return result.rows.map(mapTask);
}



// Retrieve one task by ID.
export async function getTaskById(id: string): Promise<Task | null> {
  const result = await pool.query<TaskRow>(
    `SELECT id, title, description, status, created_at
     FROM tasks
     WHERE id = $1`,
    [id],
  );

  return result.rows[0] ? mapTask(result.rows[0]) : null;
}

// Update an existing task.
export async function updateTask(
  id: string,
  input: {
    title?: string;
    description?: string;
    status?: TaskStatus;
  },
): Promise<Task | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) {
    values.push(input.title);
    fields.push(`title = $${values.length}`);
  }

  if (input.description !== undefined) {
    values.push(input.description);
    fields.push(`description = $${values.length}`);
  }

  if (input.status !== undefined) {
    values.push(input.status);
    fields.push(`status = $${values.length}`);
  }

  if (fields.length === 0) {
    return getTaskById(id);
  }

  values.push(id);

  const result = await pool.query<TaskRow>(
    `UPDATE tasks
     SET ${fields.join(', ')}
     WHERE id = $${values.length}
     RETURNING id, title, description, status, created_at`,
    values,
  );

  return result.rows[0] ? mapTask(result.rows[0]) : null;
}

// Delete a task by ID.
export async function deleteTask(id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM tasks WHERE id = $1`,
    [id],
  );

  return result.rowCount === 1;
}

