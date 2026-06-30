import { DbTask } from './db';

export function formatTasks(tasks: DbTask[]): string {
  if (tasks.length === 0) {
    return 'Задач нет. Отправь голосовое или текстовое сообщение с планами на день.';
  }

  const done = tasks.filter(t => t.done);
  const pending = tasks.filter(t => !t.done);

  const lines: string[] = [
    `Задачи на сегодня (${done.length}/${tasks.length} выполнено):\n`,
  ];

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
