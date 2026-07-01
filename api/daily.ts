import type { VercelRequest, VercelResponse } from '@vercel/node';
import { env } from '../lib/env';
import { getAllOverdueTasks } from '../lib/db';
import { sendMessage } from '../lib/telegram';

const DAY_NAMES = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTH_NAMES = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function dateLabel(day: string, todayStr: string): string {
  const yesterday = (() => {
    const [y, m, d] = todayStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  })();
  if (day === yesterday) return 'вчера';
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAY_NAMES[dt.getUTCDay()]} ${d} ${MONTH_NAMES[m - 1]}`;
}

function isAuthorized(req: VercelRequest): boolean {
  if (req.headers.authorization === `Bearer ${env.CRON_SECRET}`) return true;
  if (req.query.secret === env.CRON_SECRET) return true;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorized(req)) {
    return res.status(401).end();
  }

  const offsetHours = parseInt(env.TZ_OFFSET_HOURS, 10);
  const nowLocal = new Date(Date.now() + offsetHours * 3600 * 1000);
  const todayStr = nowLocal.toISOString().slice(0, 10);

  const allOverdue = await getAllOverdueTasks(todayStr);
  if (allOverdue.length === 0) return res.status(200).json({ ok: true, notified: 0 });

  // Group by user
  const byUser = new Map<number, typeof allOverdue>();
  for (const t of allOverdue) {
    if (!byUser.has(t.user_id)) byUser.set(t.user_id, []);
    byUser.get(t.user_id)!.push(t);
  }

  for (const [userId, tasks] of byUser) {
    const lines = tasks.map(t => {
      const time = t.time ? `[${t.time}] ` : '';
      return `• ${time}${t.text} (${dateLabel(t.day, todayStr)})`;
    });
    await sendMessage(
      userId,
      `📋 Просроченные задачи (${tasks.length}):\n\n${lines.join('\n')}\n\n/move_overdue — перенести на сегодня`,
    );
  }

  return res.status(200).json({ ok: true, notified: byUser.size });
}
