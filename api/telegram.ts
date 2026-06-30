import type { VercelRequest, VercelResponse } from '@vercel/node';
import { env } from '../lib/env';
import {
  handleStart,
  handleToday,
  handleDone,
  handleClear,
  handleVoice,
  handleText,
} from '../lib/handlers';
import { sendMessage } from '../lib/telegram';

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from?: { id: number };
    text?: string;
    voice?: { file_id: string };
    audio?: { file_id: string };
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Всегда 200 — иначе Telegram будет слать повторные запросы
  res.status(200).json({ ok: true });

  if (req.method !== 'POST') return;

  // Проверяем webhook-секрет
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (secret !== env.TELEGRAM_WEBHOOK_SECRET) return;

  const update = req.body as TelegramUpdate;
  const message = update?.message;
  if (!message) return;

  const chatId = message.chat.id;
  const userId = message.from?.id ?? chatId;
  const text = message.text ?? '';

  try {
    if (text.startsWith('/start')) {
      await handleStart(chatId);
    } else if (text.startsWith('/today')) {
      await handleToday(chatId, userId);
    } else if (text.startsWith('/done')) {
      await handleDone(chatId, userId, text.slice(5));
    } else if (text.startsWith('/clear')) {
      await handleClear(chatId, userId);
    } else if (message.voice) {
      await handleVoice(chatId, userId, message.voice.file_id);
    } else if (message.audio) {
      await handleVoice(chatId, userId, message.audio.file_id);
    } else if (text) {
      await handleText(chatId, userId, text);
    }
  } catch (err) {
    console.error('Ошибка обработки update:', JSON.stringify(err));
    try {
      await sendMessage(chatId, 'Произошла ошибка. Попробуй позже.');
    } catch {
      // игнорируем ошибки при отправке сообщения об ошибке
    }
  }
}
