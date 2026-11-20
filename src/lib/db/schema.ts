import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// 已有表的相册字段迁移见 drizzle/manual/add-album-slug.sql。
export const invitations = sqliteTable('invitations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull(),
  albumSlug: text('album_slug'),
  status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),
  templateKey: text('template_key').notNull(),
  templateVersion: integer('template_version').notNull().default(1),
  contentVersion: integer('content_version').notNull().default(1),
  content: text('content').notNull(),
  templateOptions: text('template_options'),
  shareTitle: text('share_title'),
  shareDescription: text('share_description'),
  shareImageUrl: text('share_image_url'),
  noindex: integer('noindex', { mode: 'boolean' }).notNull().default(true),
  previewToken: text('preview_token'),
  weddingDate: text('wedding_date').notNull(),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  uniqueIndex('invitations_slug_unique').on(table.slug),
  index('invitations_status_idx').on(table.status),
  check('invitations_status_check', sql`${table.status} in ('draft', 'published', 'archived')`),
]);
