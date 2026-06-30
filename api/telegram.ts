import type { VercelRequest, VercelResponse } from '@vercel/node';
import { env } from '../lib/env';
import {
  handleStart,
  handleToday,
  handleTomorrow,
  handleWeek,
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

function serializeError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}\n${err.stack ?? ''}`;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true });
  }

  // Сначала обрабатываем — только потом возвращаем 200.
  // Если вернуть 200 раньше, Vercel может убить функцию до завершения async-работы.
  try {
    const secret = req.headers['x-telegram-bot-api-secret-token'];
    if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      console.log('Неверный секрет, пропускаем');
      return res.status(200).json({ ok: true });
    }

    const update = req.body as TelegramUpdate;
    const message = update?.message;
    if (!message) return res.status(200).json({ ok: true });

    const chatId = message.chat.id;
    const userId = message.from?.id ?? chatId;
    const text = message.text ?? '';

    console.log(`update: chatId=${chatId} userId=${userId} text=${JSON.stringify(text)} voice=${!!message.voice}`);

    if (text.startsWith('/start')) {
      await handleStart(chatId);
    } else if (text.startsWith('/today')) {
      await handleToday(chatId, userId);
    } else if (text.startsWith('/tomorrow')) {
      await handleTomorrow(chatId, userId);
    } else if (text.startsWith('/week')) {
      await handleWeek(chatId, userId);
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

    console.log('update обработан успешно');
  } catch (err) {
    console.error('Ошибка обработки update:', serializeError(err));
    try {
      const chatId = (req.body as TelegramUpdate)?.message?.chat?.id;
      if (chatId) await sendMessage(chatId, 'Произошла ошибка. Попробуй позже.');
    } catch {
      // игнорируем
    }
  }

  // Всегда возвращаем 200 — Telegram не будет ретраить
  return res.status(200).json({ ok: true });
}
