import { env } from './env';

function apiUrl(method: string): string {
  return `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${method}`;
}

export async function sendMessage(chatId: number, text: string): Promise<void> {
  // Обрезаем длинные сообщения и не используем parse_mode во избежание HTML-ошибок
  const safeText = text.length > 1000 ? text.slice(0, 997) + '...' : text;
  const res = await fetch(apiUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: safeText }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendMessage ${res.status}: ${body}`);
  }
}

export async function getFileUrl(fileId: string): Promise<string> {
  const res = await fetch(apiUrl(`getFile?file_id=${fileId}`));
  const data = await res.json() as { result: { file_path: string } };
  return `https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${data.result.file_path}`;
}
