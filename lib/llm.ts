import Groq from 'groq-sdk';
import { env } from './env';

export interface Task {
  text: string;
  time?: string | null;
  date?: string | null; // YYYY-MM-DD, null = сегодня
}

function getGroq(): Groq {
  return new Groq({ apiKey: env.GROQ_API_KEY });
}

function buildPrompt(today: string): string {
  const d = new Date(today);
  const tomorrow = new Date(d); tomorrow.setDate(d.getDate() + 1);
  const afterTomorrow = new Date(d); afterTomorrow.setDate(d.getDate() + 2);
  const dayNames = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];

  return `Ты планировщик задач. Текущая дата: ${today} (${dayNames[d.getDay()]}).

Из текста пользователя извлеки задачи и верни ТОЛЬКО JSON-массив без пояснений:
[{"text":"краткое описание","time":"ЧЧ:ММ или null","date":"ГГГГ-ММ-ДД или null"}]

Правила:
- text: краткое описание задачи на русском
- time: время выполнения ЧЧ:ММ (24ч), null если не указано
- date: дата выполнения ГГГГ-ММ-ДД:
  • Дата не указана или "сегодня" → null
  • "завтра" → ${tomorrow.toISOString().slice(0, 10)}
  • "послезавтра" → ${afterTomorrow.toISOString().slice(0, 10)}
  • Конкретная дата/месяц → вычисли от ${today}
  • "следующий <день>" → ближайший такой день недели
  • "через N дней/недель" → вычисли от ${today}
- Верни только JSON, без пояснений`;
}

function parseTasksJson(raw: string): Task[] {
  const tryParse = (s: string): Task[] | null => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };
  return tryParse(raw) ?? tryParse(raw.match(/\[[\s\S]*\]/)?.[0] ?? '') ?? [];
}

export async function extractTasks(input: string, today: string): Promise<Task[]> {
  const groq = getGroq();
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    messages: [
      { role: 'system', content: buildPrompt(today) },
      { role: 'user', content: input },
    ],
  });
  return parseTasksJson(completion.choices[0]?.message?.content ?? '[]');
}
