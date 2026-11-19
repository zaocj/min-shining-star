import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { importRecordSchema } from '../src/lib/content/invitation-schema.ts';
import { buildInvitationData } from '../src/lib/content/view-model.ts';

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith('--'));
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
if (!file || [...flags].some((flag) => !['--apply', '--publish'].includes(flag))) {
  console.error('用法：npm run invitation:import -- private/invitations.json [--apply] [--publish]');
  process.exit(1);
}

async function main() {
  const records = z.array(importRecordSchema).min(1).parse(JSON.parse(readFileSync(resolve(file!), 'utf8')));
  if (new Set(records.map((record) => record.slug)).size !== records.length) throw new Error('导入资料中的 slug 重复');
  if (!process.env.DATABASE_PATH) throw new Error('缺少 DATABASE_PATH');
  const db = new Database(resolve(process.env.DATABASE_PATH), { fileMustExist: true });
  try {
    db.pragma('busy_timeout = 5000');
    const required = ['slug', 'template_key', 'content_version', 'share_image_url', 'published_at'];
    const columns = db.pragma('table_info(invitations)') as Array<{ name: string }>;
    if (required.some((name) => !columns.some((column) => column.name === name))) throw new Error('数据库表结构不匹配；请先核对迁移历史');
    const select = db.prepare('SELECT template_key, content, status FROM invitations WHERE slug = ?');
    for (const record of records) {
      const old = select.get(record.slug) as { template_key: string; content: string; status: string } | undefined;
      if (old) {
        const content = JSON.parse(old.content);
        if (old.template_key !== record.templateId || content.groom?.name !== record.content.groom.name || content.bride?.name !== record.content.bride.name || content.audience !== record.content.audience) {
          throw new Error(`slug 已由其他请柬占用：${record.slug}`);
        }
      }
      // Validate the exact DTO that both the API and SSR will return before any writes.
      buildInvitationData({
        slug: record.slug, templateKey: record.templateId, templateVersion: record.templateVersion, contentVersion: record.contentVersion,
        content: JSON.stringify({ ...record.content, shareImage: record.shareImage }), templateOptions: JSON.stringify(record.templateOptions),
        shareTitle: record.shareTitle, shareDescription: record.shareDescription, shareImageUrl: record.shareImage.url, noindex: record.noindex,
      });
      console.log(`${old ? '更新' : '新增'} /${record.slug} → ${record.templateId}（${flags.has('--publish') ? 'published' : old?.status ?? 'draft'}）`);
    }
    if (!flags.has('--apply')) { console.log('dry-run 完成，数据库未修改。添加 --apply 执行；--publish 明确发布。'); return; }
    const backupDirectory = resolve(dirname(resolve(process.env.DATABASE_PATH)), 'backups');
    mkdirSync(backupDirectory, { recursive: true });
    const backup = resolve(backupDirectory, `before-import-${Date.now()}.db`);
    await db.backup(backup);
    const upsert = db.prepare(`INSERT INTO invitations
      (slug,status,template_key,template_version,content_version,content,template_options,share_title,share_description,share_image_url,noindex,wedding_date,published_at,created_at,updated_at)
      VALUES (@slug,@status,@templateId,@templateVersion,@contentVersion,@content,@options,@shareTitle,@shareDescription,@shareImageUrl,@noindex,@weddingDate,@publishedAt,@now,@now)
      ON CONFLICT(slug) DO UPDATE SET
      status=excluded.status,template_key=excluded.template_key,template_version=excluded.template_version,content_version=excluded.content_version,
      content=excluded.content,template_options=excluded.template_options,share_title=excluded.share_title,share_description=excluded.share_description,
      share_image_url=excluded.share_image_url,noindex=excluded.noindex,wedding_date=excluded.wedding_date,
      published_at=COALESCE(invitations.published_at,excluded.published_at),updated_at=excluded.updated_at`);
    db.transaction(() => {
      const now = Math.floor(Date.now() / 1000);
      for (const record of records) {
        const old = select.get(record.slug) as { status: string } | undefined;
        const status = flags.has('--publish') ? 'published' : old?.status ?? 'draft';
        upsert.run({
          slug: record.slug, status, templateId: record.templateId, templateVersion: record.templateVersion, contentVersion: record.contentVersion,
          content: JSON.stringify({ ...record.content, shareImage: record.shareImage }), options: JSON.stringify(record.templateOptions), shareTitle: record.shareTitle,
          shareDescription: record.shareDescription, shareImageUrl: record.shareImage.url, noindex: record.noindex ? 1 : 0,
          weddingDate: new Intl.DateTimeFormat('en-CA', { timeZone: record.content.timezone }).format(new Date(record.content.weddingAt)),
          publishedAt: status === 'published' ? now : null, now,
        });
      }
    })();
    console.log(`事务导入完成，共 ${records.length} 条。备份：${backup}`);
  } finally { db.close(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
