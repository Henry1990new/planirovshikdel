import Groq from 'groq-sdk';
import { env } from './env';

function getGroq(): Groq {
  return new Groq({ apiKey: env.GROQ_API_KEY });
}

export async function transcribeAudio(fileUrl: string): Promise<string> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Ошибка загрузки файла: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  // File доступен глобально в Node.js 18+
  const file = new File([arrayBuffer], 'audio.ogg', { type: 'audio/ogg' });

  const groq = getGroq();
  const transcription = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3',
    language: 'ru',
  });

  return transcription.text;
}
