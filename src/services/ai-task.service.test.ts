
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { executeAITaskCommand } from './ai-task.service.js';

import {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
} from '../repositories/task.repository.js';

import { generateAIResponse } from './gemini.service.js';

vi.mock('../repositories/task.repository.js', () => ({
  createTask: vi.fn(),
  getTasks: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock('./gemini.service.js', () => ({
  generateAIResponse: vi.fn(),
}));

const taskId = 'dd934a4e-758a-4d64-a0eb-655b41a1cd50';

const mockTask = {
  id: taskId,
  title: 'Build my portfolio website',
  status: 'pending' as const,
  createdAt: new Date('2026-11-18T07:33:23.735Z'),
};

describe('AI Task Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTasks).mockResolvedValue([mockTask]);
  });

  it('creates a task', async () => {
    vi.mocked(generateAIResponse).mockResolvedValue(
      JSON.stringify({
        action: 'create',
        title: 'Learn TypeScript',
      }),
    );

    vi.mocked(createTask).mockResolvedValue({
      ...mockTask,
      title: 'Learn TypeScript',
    });

    const result = await executeAITaskCommand('Create a task to learn TypeScript');

    expect(createTask).toHaveBeenCalledWith({
      title: 'Learn TypeScript',
      description: undefined,
    });

    expect(result.message).toBe('Task created successfully.');
  });

  it('lists tasks', async () => {
    vi.mocked(generateAIResponse).mockResolvedValue(
      JSON.stringify({ action: 'list' }),
    );

    const result = await executeAITaskCommand('Show all tasks');

    expect(result.data).toEqual([mockTask]);
    expect(result.message).toBe('Found 1 task(s).');
  });

  it('updates a task', async () => {
    vi.mocked(generateAIResponse).mockResolvedValue(
      JSON.stringify({
        action: 'update',
        taskId,
        status: 'completed',
      }),
    );

    vi.mocked(updateTask).mockResolvedValue({
      ...mockTask,
      status: 'completed',
    });

    const result = await executeAITaskCommand(
      'Mark my portfolio task as completed',
    );

    expect(updateTask).toHaveBeenCalledWith(taskId, {
      title: undefined,
      description: undefined,
      status: 'completed',
    });

    expect(result.message).toBe('Task updated successfully.');
  });

  it('requests confirmation before deleting a task', async () => {
    vi.mocked(generateAIResponse).mockResolvedValue(
      JSON.stringify({
        action: 'delete',
        taskId,
      }),
    );

    const result = await executeAITaskCommand(
      'Delete my portfolio task',
    );

    expect(result.confirmationRequired).toBe(true);
    expect(result.data).toEqual({
      id: taskId,
      title: mockTask.title,
    });

    expect(deleteTask).not.toHaveBeenCalled();
  });

  it('returns a message when the task does not exist', async () => {
    vi.mocked(getTasks).mockResolvedValue([]);

    vi.mocked(generateAIResponse).mockResolvedValue(
      JSON.stringify({
        action: 'delete',
        taskId,
      }),
    );

    const result = await executeAITaskCommand('Delete a task');

    expect(result.message).toBe('The requested task was not found.');
    expect(deleteTask).not.toHaveBeenCalled();
  });

  it('handles invalid AI responses', async () => {
    vi.mocked(generateAIResponse).mockResolvedValue(
      'This is not valid JSON',
    );

    await expect(
      executeAITaskCommand('Do something'),
    ).rejects.toThrow('AI returned an invalid response');
  });

  it('handles unknown actions', async () => {
    vi.mocked(generateAIResponse).mockResolvedValue(
      JSON.stringify({ action: 'unknown' }),
    );

    const result = await executeAITaskCommand('Do something');

    expect(result.message).toBe(
      'I could not understand that task request. Please try again.',
    );
  });
});
