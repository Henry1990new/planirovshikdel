import { DbTask } from './db';

const DAY_NAMES = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const MONTHS_FULL = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
const DAY_NAMES_SHORT = ['вс','пн','вт','ср','чт','пт','сб'];

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function parseDateUTC(day: string): [number, number, number] {
  return day.split('-').map(Number) as [number, number, number];
}

function overdueLabel(day: string, todayStr: string): string {
  if (day === addDays(todayStr, -1)) return 'вчера';
  const [y, m, d] = parseDateUTC(day);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAY_NAMES_SHORT[dt.getUTCDay()]} ${d} ${MONTHS_SHORT[m - 1]}`;
}

function taskLine(t: DbTask, bullet: string): string {
  const time = t.time ? `[${t.time}] ` : '';
  return `${bullet} #${t.id} ${time}${t.text}`;
}

// Главный вид /tasks — все предстоящие дела + просроченные
export function formatAllTasks(
  todayTasks: DbTask[],
  futureTasks: DbTask[],
  overdue: DbTask[],
  todayStr: string,
): string {
  const hasAnything = overdue.length > 0 || todayTasks.length > 0 || futureTasks.length > 0;
  if (!hasAnything) {
    return 'Нет запланированных задач.\n\nОтправь голосовое или текстовое сообщение с планами.';
  }

  const lines: string[] = [];

  // Просроченные
  if (overdue.length > 0) {
    lines.push(`Просроченные (${overdue.length}):`);
    for (const t of overdue) {
      const time = t.time ? `[${t.time}] ` : '';
      lines.push(`• #${t.id} ${time}${t.text} (${overdueLabel(t.day, todayStr)})`);
    }
    lines.push('/move_overdue — перенести на сегодня');
    lines.push('');
    lines.push('──────────────');
    lines.push('');
  }

  // Сегодня
  if (todayTasks.length > 0) {
    const [, m, d] = parseDateUTC(todayStr);
    const done = todayTasks.filter(t => t.done).length;
    const counter = done > 0 ? ` (${done}/${todayTasks.length} выполнено)` : ` (${todayTasks.length})`;
    lines.push(`${d} ${MONTHS_FULL[m - 1]} — Сегодня${counter}:`);
    for (const t of todayTasks.filter(tsk => !tsk.done)) lines.push(taskLine(t, '•'));
    for (const t of todayTasks.filter(tsk => tsk.done)) lines.push(taskLine(t, '✓'));
    lines.push('');
  }

  // Будущие даты, сгруппированные
  const byDay = new Map<string, DbTask[]>();
  for (const t of futureTasks) {
    if (!byDay.has(t.day)) byDay.set(t.day, []);
    byDay.get(t.day)!.push(t);
  }

  for (const [day, dayTasks] of [...byDay.entries()].sort()) {
    const [, m, d] = parseDateUTC(day);
    const dt = new Date(Date.UTC(...parseDateUTC(day)));
    const label = `${d} ${MONTHS_FULL[m - 1]} — ${DAY_NAMES[dt.getUTCDay()]}`;
    lines.push(`${label} (${dayTasks.length}):`);
    for (const t of dayTasks) lines.push(taskLine(t, '•'));
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

// Используется в /tomorrow
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

// Оставляем для обратной совместимости (используется в remind/daily API)
export function formatTasksWeek(tasks: DbTask[], todayStr: string): string {
  const byDay = new Map<string, DbTask[]>();
  for (const t of tasks) {
    if (!byDay.has(t.day)) byDay.set(t.day, []);
    byDay.get(t.day)!.push(t);
  }
  const lines = ['Задачи на неделю:\n'];
  for (const [day, dayTasks] of [...byDay.entries()].sort()) {
    const [, m, d] = parseDateUTC(day);
    const dt = new Date(Date.UTC(...parseDateUTC(day)));
    const label = day === todayStr
      ? `Сегодня, ${d} ${MONTHS_SHORT[m - 1]}`
      : `${DAY_NAMES_SHORT[dt.getUTCDay()]} ${d} ${MONTHS_SHORT[m - 1]}`;
    const done = dayTasks.filter(t => t.done).length;
    lines.push(`${label} (${done}/${dayTasks.length}):`);
    for (const t of dayTasks) lines.push(taskLine(t, t.done ? '✓' : '•'));
    lines.push('');
  }
  return lines.join('\n').trim();
}
