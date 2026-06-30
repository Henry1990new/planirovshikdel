import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';
import { Task } from './llm';

export interface DbTask {
  id: number;
  user_id: number;
  text: string;
  time: string | null;
  day: string;
  done: boolean;
  created: string;
}

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _client;
}

export async function saveTasks(userId: number, tasks: Task[], defaultDay: string): Promise<void> {
  const rows = tasks.map(t => ({
    user_id: userId,
    text: t.text,
    time: t.time ?? null,
    day: t.date ?? defaultDay,
    done: false,
  }));
  const { error } = await getClient().from('tasks').insert(rows);
  if (error) throw new Error(JSON.stringify(error));
}

export async function getTasks(userId: number, day: string): Promise<DbTask[]> {
  const { data, error } = await getClient()
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('day', day)
    .order('time', { ascending: true, nullsFirst: false });

  if (error) throw new Error(JSON.stringify(error));
  return (data ?? []) as DbTask[];
}

export async function getTasksRange(userId: number, from: string, to: string): Promise<DbTask[]> {
  const { data, error } = await getClient()
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .gte('day', from)
    .lte('day', to)
    .order('day', { ascending: true })
    .order('time', { ascending: true, nullsFirst: false });

  if (error) throw new Error(JSON.stringify(error));
  return (data ?? []) as DbTask[];
}

export async function insertTask(userId: number, text: string, time: string | null, day: string): Promise<DbTask> {
  const { data, error } = await getClient()
    .from('tasks')
    .insert({ user_id: userId, text, time, day, done: false })
    .select()
    .single();
  if (error) throw new Error(JSON.stringify(error));
  return data as DbTask;
}

export async function updateTaskById(
  userId: number,
  id: number,
  updates: Partial<{ text: string; time: string | null; day: string; done: boolean }>,
): Promise<DbTask | null> {
  const { data, error } = await getClient()
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(JSON.stringify(error));
  }
  return data as DbTask;
}

export async function markDone(userId: number, taskId: number): Promise<boolean> {
  const { error, count } = await getClient()
    .from('tasks')
    .update({ done: true })
    .eq('id', taskId)
    .eq('user_id', userId);
  if (error) throw new Error(JSON.stringify(error));
  return (count ?? 0) > 0;
}

export async function clearTasks(userId: number, day: string): Promise<number> {
  const { error, count } = await getClient()
    .from('tasks')
    .delete()
    .eq('user_id', userId)
    .eq('day', day);
  if (error) throw new Error(JSON.stringify(error));
  return count ?? 0;
}

export async function deleteTaskById(userId: number, id: number): Promise<boolean> {
  const { error, count } = await getClient()
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(JSON.stringify(error));
  return (count ?? 0) > 0;
}
