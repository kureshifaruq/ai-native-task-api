
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { pool } from './config/database.js';

describe('AI-native Task API', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // Ensure each test starts with an empty tasks table.
    await pool.query('TRUNCATE TABLE tasks');
    app = buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    // Close the shared database connection pool.
    await pool.end();
  });

  // Helper to create a task and return its ID.
  async function createTestTask(title = 'Test task') {
    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: { title },
    });

    return response.json().data.id as string;
  }

  it('returns a healthy status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'ai-native-task-api',
    });
  });

  it('creates a task with valid input', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: {
        title: 'Learn AI agents',
        description: 'Build an AI-native API',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.id).toBeDefined();
    expect(response.json().data.title).toBe('Learn AI agents');
    expect(response.json().data.status).toBe('pending');
  });

  it('rejects an empty title', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: { title: '' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('lists created tasks', async () => {
    await createTestTask('Test task');

    const response = await app.inject({
      method: 'GET',
      url: '/tasks',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveLength(1);
    expect(response.json().data[0].title).toBe('Test task');
  });

  it('gets a task by ID', async () => {
    const taskId = await createTestTask('Find this task');

    const response = await app.inject({
      method: 'GET',
      url: `/tasks/${taskId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.id).toBe(taskId);
    expect(response.json().data.title).toBe('Find this task');
  });

  it('returns 404 when a task does not exist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/tasks/00000000-0000-4000-8000-000000000001',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('TASK_NOT_FOUND');
  });

  it('rejects an invalid task ID', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/tasks/invalid-id',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('updates a task title', async () => {
    const taskId = await createTestTask();

    const response = await app.inject({
      method: 'PATCH',
      url: `/tasks/${taskId}`,
      payload: { title: 'Updated task title' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.title).toBe('Updated task title');
  });

  it('updates a task status', async () => {
    const taskId = await createTestTask();

    const response = await app.inject({
      method: 'PATCH',
      url: `/tasks/${taskId}`,
      payload: { status: 'completed' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('completed');
  });

  it('rejects an empty update request', async () => {
    const taskId = await createTestTask();

    const response = await app.inject({
      method: 'PATCH',
      url: `/tasks/${taskId}`,
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid task status', async () => {
    const taskId = await createTestTask();

    const response = await app.inject({
      method: 'PATCH',
      url: `/tasks/${taskId}`,
      payload: { status: 'invalid' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when updating a nonexistent task', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/tasks/00000000-0000-4000-8000-000000000001',
      payload: { title: 'Updated title' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('TASK_NOT_FOUND');
  });

  it('deletes an existing task', async () => {
    const taskId = await createTestTask();

    const response = await app.inject({
      method: 'DELETE',
      url: `/tasks/${taskId}`,
    });

    expect(response.statusCode).toBe(204);

    const getResponse = await app.inject({
      method: 'GET',
      url: `/tasks/${taskId}`,
    });

    expect(getResponse.statusCode).toBe(404);
  });

  it('returns 404 when deleting a nonexistent task', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/tasks/00000000-0000-4000-8000-000000000001',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('TASK_NOT_FOUND');
  });
});
