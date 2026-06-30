import type { VercelRequest, VercelResponse } from '@vercel/node';
import { env } from '../lib/env';
import { getUnremindedTasksForDay, markReminded } from '../lib/db';
import { sendMessage } from '../lib/telegram';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const offsetHours = parseInt(env.TZ_OFFSET_HOURS, 10);
  const nowLocal = new Date(Date.now() + offsetHours * 3600 * 1000);
  const localDate = nowLocal.toISOString().slice(0, 10);
  const nowMinutes = nowLocal.getUTCHours() * 60 + nowLocal.getUTCMinutes();

  const tasks = await getUnremindedTasksForDay(localDate);

  // Remind about tasks starting in the next 5–20 minutes
  const due = tasks.filter(t => {
    if (!t.time) return false;
    const [h, m] = t.time.split(':').map(Number);
    const taskMin = h * 60 + m;
    return taskMin > nowMinutes + 4 && taskMin <= nowMinutes + 20;
  });

  for (const task of due) {
    const minutesLeft = Math.round(
      (task.time!.split(':').map(Number).reduce((h, m) => h * 60 + m, 0)) - nowMinutes,
    );
    await sendMessage(
      task.user_id,
      `⏰ Через ${minutesLeft} мин: ${task.time ? `[${task.time}] ` : ''}${task.text}`,
    );
    await markReminded(task.id);
  }

  return res.status(200).json({ ok: true, reminded: due.length });
}
