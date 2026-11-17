import { loadEnvFile } from 'node:process';
import { defineConfig } from 'drizzle-kit';

// Node 的原生 .env 加载，不额外引入 dotenv；已导出的变量优先。
try {
  loadEnvFile('.env');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

if (!process.env.DATABASE_PATH) {
  throw new Error('请在 .env 或进程环境中设置 DATABASE_PATH。');
}

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_PATH },
});
