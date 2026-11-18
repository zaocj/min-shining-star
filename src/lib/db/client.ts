import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { DATABASE_PATH } from 'astro:env/server';

function connect() {
  const sqlite = new Database(DATABASE_PATH, { fileMustExist: true });
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  return drizzle(sqlite);
}

// 开发热更新时也复用连接，避免反复打开 SQLite 文件。
const shared = globalThis as typeof globalThis & { invitationDb?: ReturnType<typeof connect> };
export function getDb() {
  return shared.invitationDb ??= connect();
}
