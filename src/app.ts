
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export function buildApp() {
  const app = Fastify({
    logger: false,
  });

  const createTaskSchema = z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional(),
  });

  type Task = {
    id: string;
    title: string;
    description?: string;
    status: 'pending' | 'completed';
    createdAt: string;
  };

  const tasks: Task[] = [];

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

    const task: Task = {
      id: randomUUID(),
      title: result.data.title,
      ...(result.data.description !== undefined && {
        description: result.data.description,
      }),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    tasks.push(task);

    return reply.code(201).send({ data: task });
  });

  app.get('/tasks', async () => ({
    data: tasks,
  }));

  return app;
}
