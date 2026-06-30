import { DbTask } from './db';

const DAY_NAMES_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTH_NAMES_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function overdueLabel(day: string, todayStr: string): string {
  const yesterday = addDays(todayStr, -1);
  if (day === yesterday) return 'вчера';
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAY_NAMES_SHORT[dt.getUTCDay()]} ${d} ${MONTH_NAMES_SHORT[m - 1]}`;
}

function taskLine(t: DbTask, bullet: string): string {
  const time = t.time ? `[${t.time}] ` : '';
  return `${bullet} #${t.id} ${time}${t.text}`;
}

export function formatTasksWithOverdue(tasks: DbTask[], overdue: DbTask[], todayStr: string): string {
  const lines: string[] = [];

  if (tasks.length === 0) {
    lines.push('Задач на сегодня нет. Отправь голосовое или текстовое сообщение с планами.');
  } else {
    const done = tasks.filter(t => t.done);
    const pending = tasks.filter(t => !t.done);
    lines.push(`Задачи на сегодня (${done.length}/${tasks.length} выполнено):\n`);
    for (const t of pending) lines.push(taskLine(t, '•'));
    if (done.length > 0) {
      lines.push('\nВыполнено:');
      for (const t of done) lines.push(taskLine(t, '✓'));
    }
  }

  if (overdue.length > 0) {
    lines.push(`\n──────────────\nПросроченные (${overdue.length}):\n`);
    for (const t of overdue) {
      const time = t.time ? `[${t.time}] ` : '';
      lines.push(`• #${t.id} ${time}${t.text} (${overdueLabel(t.day, todayStr)})`);
    }
    lines.push('\n/move_overdue — перенести все на сегодня');
  }

  return lines.join('\n');
}

export function formatTasks(tasks: DbTask[]): string {
  if (tasks.length === 0) {
    return 'Задач нет. Отправь голосовое или текстовое сообщение с планами.';
  }
  const done = tasks.filter(t => t.done);
  const pending = tasks.filter(t => !t.done);
  const lines: string[] = [`Задачи (${done.length}/${tasks.length} выполнено):\n`];
  for (const t of pending) lines.push(taskLine(t, '•'));
  if (done.length > 0) {
    lines.push('\nВыполнено:');
    for (const t of done) lines.push(taskLine(t, '✓'));
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
    const [y, m, d] = day.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    let label: string;
    if (day === todayStr) {
      label = `Сегодня, ${d} ${MONTH_NAMES_SHORT[m - 1]}`;
    } else {
      label = `${DAY_NAMES_SHORT[dt.getUTCDay()]} ${d} ${MONTH_NAMES_SHORT[m - 1]}`;
    }
    const done = dayTasks.filter(t => t.done).length;
    lines.push(`${label} (${done}/${dayTasks.length}):`);
    for (const t of dayTasks) {
      lines.push(taskLine(t, t.done ? '✓' : '•'));
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}
