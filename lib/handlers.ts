import { sendMessage, getFileUrl } from './telegram';
import { transcribeAudio } from './transcribe';
import { extractTasks } from './llm';
import { saveTasks, getTasks, markDone, clearTasks } from './db';
import { formatTasks } from './format';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function handleStart(chatId: number): Promise<void> {
  await sendMessage(
    chatId,
    'Привет! Я бот утреннего планирования.\n\n' +
    'Отправь голосовое сообщение или текст с планами на день — я разберу их на задачи и сохраню.\n\n' +
    'Команды:\n' +
    '/today — задачи на сегодня\n' +
    '/done <id> — отметить задачу выполненной\n' +
    '/clear — очистить все задачи на сегодня',
  );
}

export async function handleToday(chatId: number, userId: number): Promise<void> {
  const tasks = await getTasks(userId, today());
  await sendMessage(chatId, formatTasks(tasks));
}

export async function handleDone(chatId: number, userId: number, args: string): Promise<void> {
  const id = parseInt(args.trim(), 10);
  if (isNaN(id)) {
    await sendMessage(chatId, 'Укажи номер задачи: /done <id>');
    return;
  }
  const ok = await markDone(userId, id);
  await sendMessage(chatId, ok ? `Задача #${id} выполнена!` : `Задача #${id} не найдена.`);
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
  const tasks = await extractTasks(text);

  if (tasks.length === 0) {
    await sendMessage(chatId, 'Не удалось извлечь задачи. Попробуй переформулировать.');
    return;
  }

  await saveTasks(userId, tasks, today());

  const lines = [`Добавлено ${tasks.length} задач:`];
  for (const t of tasks) {
    const time = t.time ? ` [${t.time}]` : '';
    lines.push(`•${time} ${t.text}`);
  }
  lines.push('\n/today — показать все задачи');

  await sendMessage(chatId, lines.join('\n'));
}
