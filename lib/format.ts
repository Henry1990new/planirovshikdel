import { DbTask } from './db';

export function formatTasks(tasks: DbTask[]): string {
  if (tasks.length === 0) {
    return 'Задач нет. Отправь голосовое или текстовое сообщение с планами.';
  }

  const done = tasks.filter(t => t.done);
  const pending = tasks.filter(t => !t.done);

  const lines: string[] = [`Задачи (${done.length}/${tasks.length} выполнено):\n`];

  for (const task of pending) {
    const time = task.time ? `[${task.time}] ` : '';
    lines.push(`• #${task.id} ${time}${task.text}`);
  }

  if (done.length > 0) {
    lines.push('\nВыполнено:');
    for (const task of done) {
      const time = task.time ? `[${task.time}] ` : '';
      lines.push(`✓ ${time}${task.text}`);
    }
  }

  return lines.join('\n');
}

export function formatTasksWeek(tasks: DbTask[], todayStr: string): string {
  const byDay = new Map<string, DbTask[]>();
  for (const t of tasks) {
    if (!byDay.has(t.day)) byDay.set(t.day, []);
    byDay.get(t.day)!.push(t);
  }

  const lines = ['Задачи на неделю:\n'];

  for (const [day, dayTasks] of [...byDay.entries()].sort()) {
    const d = new Date(day);
    let label: string;
    if (day === todayStr) {
      label = `Сегодня, ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
    } else {
      label = d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
    }

    const done = dayTasks.filter(t => t.done).length;
    lines.push(`${label} (${done}/${dayTasks.length}):`);

    for (const t of dayTasks) {
      const time = t.time ? `[${t.time}] ` : '';
      const mark = t.done ? '✓' : '•';
      lines.push(`${mark} #${t.id} ${time}${t.text}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}
