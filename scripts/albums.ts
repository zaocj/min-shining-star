import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import Database from 'better-sqlite3';
import { albumSlugSchema, generatedSlugSchema } from '../src/lib/content/invitation-schema.ts';

async function main() {
  const { values, positionals } = parseArgs({ options: { apply: { type: 'boolean', default: false }, album: { type: 'string' } }, allowPositionals: true });
  const [action, ...slugs] = positionals;
  if (!['migrate', 'assign'].includes(action) || (action === 'migrate' && (slugs.length || values.album)) || (action === 'assign' && !slugs.length)) {
    throw new Error('用法：npm run db:migrate:album -- [--apply]；npm run album:assign -- <请柬slug> [...] [--album photo随机字符串] [--apply]');
  }
  if (!process.env.DATABASE_PATH) throw new Error('缺少 DATABASE_PATH');
  const databasePath = resolve(process.env.DATABASE_PATH);
  const db = new Database(databasePath, { fileMustExist: true });
  try {
    db.pragma('busy_timeout = 5000');
    const columns = db.pragma('table_info(invitations)') as Array<{ name: string }>;
    if (!['slug', 'content', 'updated_at'].every((name) => columns.some((column) => column.name === name))) throw new Error('invitations 表结构不匹配');
    const backup = async () => {
      const directory = resolve(dirname(databasePath), 'backups');
      mkdirSync(directory, { recursive: true });
      const path = resolve(directory, `before-album-${action}-${Date.now()}-${randomUUID()}.db`);
      await db.backup(path);
      console.log(`备份：${path}`);
    };
    const hasColumn = columns.some((column) => column.name === 'album_slug');
    if (action === 'migrate') {
      if (hasColumn) { console.log('album_slug 已存在，无需迁移。'); return; }
      const sql = readFileSync(new URL('../drizzle/manual/add-album-slug.sql', import.meta.url), 'utf8');
      console.log(sql.trim());
      if (!values.apply) { console.log('dry-run 完成，添加 --apply 执行迁移。'); return; }
      await backup();
      db.transaction(() => { db.exec(sql); })();
      console.log('已添加 album_slug，现有内容与发布状态保持不变。');
      return;
    }
    if (!hasColumn) throw new Error('缺少 album_slug，请先执行 npm run db:migrate:album -- --apply');
    const uniqueSlugs = [...new Set(slugs.map((slug) => generatedSlugSchema.parse(slug)))];
    const select = db.prepare('SELECT album_slug FROM invitations WHERE slug = ?');
    const rows = uniqueSlugs.map((slug) => {
      const row = select.get(slug) as { album_slug: string | null } | undefined;
      if (!row) throw new Error(`未找到请柬：${slug}`);
      return { slug, albumSlug: row.album_slug };
    });
    const current = [...new Set(rows.map((row) => row.albumSlug).filter((value) => value !== null))];
    if (!values.album && current.length > 1) throw new Error('请柬已关联不同相册，请用 --album 明确指定目标相册');
    let albumSlug = values.album ?? current[0];
    if (!albumSlug) {
      do { albumSlug = `photo${randomBytes(6).toString('hex')}`; }
      while (db.prepare('SELECT 1 FROM invitations WHERE album_slug = ?').get(albumSlug));
    }
    albumSlugSchema.parse(albumSlug);
    console.log(`相册：${albumSlug}；COS 前缀：usersphotos/${albumSlug}/`);
    for (const row of rows) console.log(`/${row.slug} → ${albumSlug}`);
    if (!values.apply) { console.log('dry-run 完成，添加 --apply 保存关联；可用 --album 固定上面的相册 slug。'); return; }
    if (rows.every((row) => row.albumSlug === albumSlug)) { console.log('关联已存在，无需更新。'); return; }
    await backup();
    db.transaction(() => {
      const update = db.prepare('UPDATE invitations SET album_slug = ?, updated_at = ? WHERE slug = ? AND album_slug IS ?');
      for (const row of rows) {
        if (row.albumSlug === albumSlug) continue;
        if (update.run(albumSlug, Math.floor(Date.now() / 1000), row.slug, row.albumSlug).changes !== 1) throw new Error('相册关联已被其他操作修改，请重试');
      }
    })();
    console.log('相册关联已保存。');
  } finally { db.close(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
