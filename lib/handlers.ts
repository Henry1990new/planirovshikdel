import { sendMessage, getFileUrl } from './telegram';
import { transcribeAudio } from './transcribe';
import { extractTasks, Task } from './llm';
import { saveTasks, getTasks, getTasksRange, markDone, clearTasks } from './db';
import { formatTasks, formatTasksWeek } from './format';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function dateLabel(date: string, todayStr: string): string {
  if (date === todayStr) return 'Сегодня';
  if (date === addDays(todayStr, 1)) return 'Завтра';
  const d = new Date(date);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export async function handleStart(chatId: number): Promise<void> {
  await sendMessage(
    chatId,
    'Привет! Я твой ежедневный планировщик.\n\n' +
    'Отправь голосовое сообщение или текст с планами — я разберу их на задачи и сохраню на нужную дату.\n\n' +
    'Примеры:\n' +
    '• «Завтра в 11 встреча с клиентом»\n' +
    '• «15 июля оплатить счёт»\n' +
    '• «Через неделю позвонить врачу»\n\n' +
    'Команды:\n' +
    '/today — задачи на сегодня\n' +
    '/tomorrow — задачи на завтра\n' +
    '/week — задачи на ближайшую неделю\n' +
    '/done <id> — отметить задачу выполненной\n' +
    '/clear — очистить задачи на сегодня',
  );
}

export async function handleToday(chatId: number, userId: number): Promise<void> {
  const tasks = await getTasks(userId, today());
  await sendMessage(chatId, formatTasks(tasks));
}

export async function handleTomorrow(chatId: number, userId: number): Promise<void> {
  const tomorrow = addDays(today(), 1);
  const tasks = await getTasks(userId, tomorrow);
  const d = new Date(tomorrow);
  const label = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  if (tasks.length === 0) {
    await sendMessage(chatId, `Задач на завтра (${label}) нет.\n\nНадиктуй или напиши планы на завтра.`);
    return;
  }
  await sendMessage(chatId, `Задачи на завтра, ${label}:\n\n` + formatTasks(tasks));
}

export async function handleWeek(chatId: number, userId: number): Promise<void> {
  const todayStr = today();
  const tasks = await getTasksRange(userId, todayStr, addDays(todayStr, 6));
  if (tasks.length === 0) {
    await sendMessage(chatId, 'Задач на ближайшую неделю нет.\n\nНадиктуй или напиши свои планы.');
    return;
  }
  await sendMessage(chatId, formatTasksWeek(tasks, todayStr));
}

export async function handleDone(chatId: number, userId: number, args: string): Promise<void> {
  const id = parseInt(args.trim(), 10);
  if (isNaN(id)) {
    await sendMessage(chatId, 'Укажи номер задачи: /done <id>');
    return;
  }
  const ok = await markDone(userId, id);
  await sendMessage(chatId, ok ? `Задача #${id} выполнена! ✓` : `Задача #${id} не найдена.`);
}

export async function handleClear(chatId: number, userId: number): Promise<void> {
  const count = await clearTasks(userId, today());
  await sendMessage(chatId, `Удалено ${count} задач на сегодня.`);
}

export async function handleVoice(chatId: number, userId: number, fileId: string): Promise<void> {
  await sendMessage(chatId, 'Распознаю голосовое сообщение...');
  const fileUrl = await getFileUrl(fileId);
  const text = await transcribeAudio(fileUrl);
  await sendMessage(chatId, `Распознано:\n${text}`);
  await processPlanText(chatId, userId, text);
}

export async function handleText(chatId: number, userId: number, text: string): Promise<void> {
  await processPlanText(chatId, userId, text);
}

async function processPlanText(chatId: number, userId: number, text: string): Promise<void> {
  await sendMessage(chatId, 'Извлекаю задачи...');
  const todayStr = today();
  const tasks = await extractTasks(text, todayStr);

  if (tasks.length === 0) {
    await sendMessage(chatId, 'Не удалось извлечь задачи. Попробуй переформулировать.');
    return;
  }

  await saveTasks(userId, tasks, todayStr);

  // Группируем по дате для красивого вывода
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const d = t.date ?? todayStr;
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(t);
  }

  const n = tasks.length;
  const suffix = n === 1 ? 'а' : n < 5 ? 'и' : '';
  const lines = [`Добавлено ${n} задач${suffix}:`];

  for (const [date, dayTasks] of [...groups.entries()].sort()) {
    lines.push(`\n${dateLabel(date, todayStr)}:`);
    for (const t of dayTasks) {
      lines.push(`•${t.time ? ` [${t.time}]` : ''} ${t.text}`);
    }
  }

  lines.push('\n/today — сегодня  /week — неделя');
  await sendMessage(chatId, lines.join('\n'));
}
