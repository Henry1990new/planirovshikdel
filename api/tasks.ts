import type { VercelRequest, VercelResponse } from '@vercel/node';
import { env } from '../lib/env';
import { getTasksRange, insertTask, updateTaskById, deleteTaskById } from '../lib/db';

function checkAuth(req: VercelRequest): boolean {
  return req.headers.authorization === `Bearer ${env.WEB_PASSWORD}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  const userId = parseInt(env.WEB_USER_ID, 10);
  if (isNaN(userId)) return res.status(500).json({ error: 'WEB_USER_ID не настроен' });

  try {
    if (req.method === 'GET') {
      const from = (req.query.from as string) || today();
      const to = (req.query.to as string) || from;
      const tasks = await getTasksRange(userId, from, to);
      return res.json(tasks);
    }

    if (req.method === 'POST') {
      const { text, time, day } = req.body as { text?: string; time?: string; day?: string };
      if (!text?.trim() || !day) return res.status(400).json({ error: 'text и day обязательны' });
      const task = await insertTask(userId, text.trim(), time || null, day);
      return res.status(201).json(task);
    }

    if (req.method === 'PATCH') {
      const id = parseInt(req.query.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'id обязателен' });
      const { text, time, day, done } = req.body as {
        text?: string; time?: string | null; day?: string; done?: boolean;
      };
      const updates: Partial<{ text: string; time: string | null; day: string; done: boolean }> = {};
      if (text !== undefined) updates.text = text;
      if (time !== undefined) updates.time = time;
      if (day !== undefined) updates.day = day;
      if (done !== undefined) updates.done = done;
      const task = await updateTaskById(userId, id, updates);
      if (!task) return res.status(404).json({ error: 'Задача не найдена' });
      return res.json(task);
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'id обязателен' });
      await deleteTaskById(userId, id);
      return res.json({ deleted: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : JSON.stringify(err);
    console.error('tasks API error:', msg);
    return res.status(500).json({ error: msg });
  }
}
