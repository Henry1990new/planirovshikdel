import { sendMessage, getFileUrl } from './telegram';
import { transcribeAudio } from './transcribe';
import { extractTasks, Task } from './llm';
import { saveTasks, getTasks, getTasksRange, getUpcomingTasks, getOverdueTasks, moveOverdueTasks, markDone, clearTasks } from './db';
import { formatAllTasks, formatTasks, formatTasksWeek } from './format';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function dateLabel(date: string, todayStr: string): string {
  if (date === todayStr) return 'Сегодня';
  if (date === addDays(todayStr, 1)) return 'Завтра';
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  return `${d} ${months[m - 1]}`;
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
    '/tasks — список задач\n' +
    '/done <id> — отметить задачу выполненной\n' +
    '/move_overdue — перенести просроченные на сегодня\n' +
    '/clear — очистить задачи на сегодня\n' +
    '/webapp — доступ к веб-приложению',
  );
}

export async function handleToday(chatId: number, userId: number): Promise<void> {
  const todayStr = today();
  const [todayTasks, futureTasks, overdue] = await Promise.all([
    getTasks(userId, todayStr),
    getUpcomingTasks(userId, todayStr),
    getOverdueTasks(userId, todayStr),
  ]);
  await sendMessage(chatId, formatAllTasks(todayTasks, futureTasks, overdue, todayStr));
}

export async function handleTomorrow(chatId: number, userId: number): Promise<void> {
  const tomorrow = addDays(today(), 1);
  const tasks = await getTasks(userId, tomorrow);
  const [y, m, d] = tomorrow.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const days = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const label = `${days[dt.getUTCDay()]}, ${d} ${months[m - 1]}`;
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

export async function handleWebApp(chatId: number, userId: number): Promise<void> {
  await sendMessage(
    chatId,
    '🌐 Веб-приложение:\nhttps://planirovshikdel.vercel.app/app.html\n\n' +
    `Твой Telegram ID: ${userId}\n` +
    'Пароль: попроси у владельца бота\n\n' +
    'Введи ID и пароль на странице входа — увидишь свои задачи.',
  );
}

export async function handleMoveOverdue(chatId: number, userId: number): Promise<void> {
  const todayStr = today();
  const count = await moveOverdueTasks(userId, todayStr, todayStr);
  if (count === 0) {
    await sendMessage(chatId, 'Просроченных задач нет.');
    return;
  }
  const suffix = count === 1 ? 'а' : count < 5 ? 'ы' : '';
  await sendMessage(chatId, `Перенесено ${count} задач${suffix} на сегодня. /tasks`);
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

  lines.push('\n/tasks — сегодня  /week — неделя');
  await sendMessage(chatId, lines.join('\n'));
}
