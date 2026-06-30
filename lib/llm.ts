import Groq from 'groq-sdk';
import { env } from './env';

export interface Task {
  text: string;
  time?: string | null;
}

function getGroq(): Groq {
  return new Groq({ apiKey: env.GROQ_API_KEY });
}

const SYSTEM_PROMPT = `Ты помощник утреннего планирования. Из текста пользователя извлеки список задач на сегодня.
Верни ТОЛЬКО JSON-массив без пояснений: [{"text":"описание задачи","time":"HH:MM или null"}]
Правила:
- Каждая задача — отдельный элемент массива
- Если время указано явно — добавь в поле time в формате HH:MM (24ч)
- Если время не указано — "time": null
- Текст задачи краткий, на русском языке
- Верни только JSON, ничего больше`;

export async function extractTasks(input: string): Promise<Task[]> {
  const groq = getGroq();
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: input },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '[]';

  // Пробуем распарсить напрямую
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Ищем JSON-массив в ответе
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Не удалось распарсить
      }
    }
  }

  return [];
}
