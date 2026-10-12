
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

describe('AI-native Task API', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

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

    const body = response.json();

    expect(body.data.id).toBeDefined();
    expect(body.data.title).toBe('Learn AI agents');
    expect(body.data.status).toBe('pending');
  });

  it('rejects an empty title', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: {
        title: '',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('lists created tasks', async () => {
    await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: {
        title: 'Test task',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/tasks',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveLength(1);
    expect(response.json().data[0].title).toBe('Test task');
  });
});
