
import Fastify from 'fastify';
import { z } from 'zod';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
} from './repositories/task.repository.js';
import { executeAITaskCommand } from './services/ai-task.service.js';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'AI-native Task API',
        description: 'Task management API with AI-powered natural language commands',
        version: '1.0.0',
      },
    },
  });

  await app.register(swaggerUI, {
    routePrefix: '/docs',
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

  app.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Check API health',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            service: { type: 'string' },
          },
        },
      },
    },
  }, async () => ({
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


  // AI assistant endpoint

  // AI assistant endpoint
  app.post('/ai/ask', {
    schema: {
      tags: ['AI Assistant'],
      summary: 'Execute a natural-language task command',
      description: 'Use natural language to create, list, update, or request deletion of tasks.',
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: {
            type: 'string',
            description: 'Natural-language task instruction',
            default: 'Create a task to learn Docker',
          },
        },
      },
    },
  }, async (request, reply) => {
    const schema = z.object({
      prompt: z.string().trim().min(1).max(2000),
    });

    const result = schema.safeParse(request.body);

    if (!result.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A valid prompt is required',
        },
      });
    }

    const response = await executeAITaskCommand(
      result.data.prompt,
    );

    return reply.send({
      data: response,
    });
  });


  app.post('/ai/confirm-delete', {
    schema: {
      tags: ['AI Assistant'],
      summary: 'Confirm task deletion',
      description: 'Permanently delete a task after explicit confirmation.',
      body: {
        type: 'object',
        required: ['taskId', 'confirm'],
        properties: {
          taskId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the task to delete',
            default: 'bcdfed45-4ba0-4522-a522-0135ccd75be5',
          },
          confirm: {
            type: 'boolean',
            description: 'Must be true to confirm deletion',
            default: true,
          },
        },
      },
    },
  }, async (request, reply) => {
    const schema = z.object({
      taskId: z.string().uuid(),
      confirm: z.literal(true),
    });

    const result = schema.safeParse(request.body);

    if (!result.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A valid task ID and confirmation are required',
        },
      });
    }

    const task = await getTaskById(result.data.taskId);

    if (!task) {
      return reply.code(404).send({
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'The requested task was not found',
        },
      });
    }

    const deleted = await deleteTask(result.data.taskId);

    if (!deleted) {
      return reply.code(404).send({
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'The requested task was not found',
        },
      });
    }

    return reply.send({
      data: {
        message: 'Task deleted successfully.',
        task: {
          id: task.id,
          title: task.title,
        },
      },
    });
  });


  return app;
}
