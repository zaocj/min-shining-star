-- Run through npm run db:migrate:album -- --apply (checks the column and backs up first).
-- Nullable for existing/legacy invitations. Multiple invitations may share one album.
ALTER TABLE invitations ADD COLUMN album_slug TEXT;
