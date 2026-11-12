
import Fastify from 'fastify';
import { z } from 'zod';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
} from './repositories/task.repository.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  const taskIdSchema = z.string().uuid();

  const createTaskSchema = z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional(),
  });

  const updateTaskSchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(1000).optional(),
    status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided' },
  );

  // Centralized error handler
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    const statusCode =
      typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        typeof error.statusCode === 'number' &&
        Number.isInteger(error.statusCode) &&
        error.statusCode >= 400 &&
        error.statusCode <= 599
        ? error.statusCode
        : 500;

    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred';

    return reply.code(statusCode).send({
      error: {
        code:
          statusCode >= 500
            ? 'INTERNAL_SERVER_ERROR'
            : 'REQUEST_ERROR',
        message:
          statusCode >= 500
            ? 'An unexpected error occurred'
            : message,
      },
    });
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'ai-native-task-api',
  }));

  app.post('/tasks', async (request, reply) => {
    const result = createTaskSchema.safeParse(request.body);

    if (!result.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body is invalid',
          details: result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }

    const task = await createTask(result.data);

    return reply.code(201).send({ data: task });
  });

  app.get('/tasks', async () => {
    const tasks = await getTasks();

    return { data: tasks };
  });

  app.get('/tasks/:id', async (request, reply) => {
    const params = z.object({
      id: taskIdSchema,
    }).safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Task ID must be a valid UUID',
        },
      });
    }

    const task = await getTaskById(params.data.id);

    if (!task) {
      return reply.code(404).send({
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
        },
      });
    }

    return { data: task };
  });

  app.patch('/tasks/:id', async (request, reply) => {
    const params = z.object({
      id: taskIdSchema,
    }).safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Task ID must be a valid UUID',
        },
      });
    }

    const body = updateTaskSchema.safeParse(request.body);

    if (!body.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body is invalid',
          details: body.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }

    const task = await updateTask(params.data.id, body.data);

    if (!task) {
      return reply.code(404).send({
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
        },
      });
    }

    return { data: task };
  });

  app.delete('/tasks/:id', async (request, reply) => {
    const params = z.object({
      id: taskIdSchema,
    }).safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Task ID must be a valid UUID',
        },
      });
    }

    const deleted = await deleteTask(params.data.id);

    if (!deleted) {
      return reply.code(404).send({
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
        },
      });
    }

    return reply.code(204).send();
  });

  return app;
}
