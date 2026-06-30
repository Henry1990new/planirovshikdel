function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Отсутствует переменная окружения: ${key}`);
  return value;
}

export const env = {
  get TELEGRAM_TOKEN() { return getEnv('TELEGRAM_TOKEN'); },
  get TELEGRAM_WEBHOOK_SECRET() { return getEnv('TELEGRAM_WEBHOOK_SECRET'); },
  get GROQ_API_KEY() { return getEnv('GROQ_API_KEY'); },
  get SUPABASE_URL() { return getEnv('SUPABASE_URL'); },
  get SUPABASE_SERVICE_ROLE_KEY() { return getEnv('SUPABASE_SERVICE_ROLE_KEY'); },
  get WEB_PASSWORD() { return getEnv('WEB_PASSWORD'); },
  get CRON_SECRET() { return getEnv('CRON_SECRET'); },
  get TZ_OFFSET_HOURS() { return getEnv('TZ_OFFSET_HOURS'); },
};
