-- Custom photo as board background, alongside the existing preset gradients.
-- `boards.background` keeps holding a preset id (from src/lib/backgrounds.ts)
-- or is null; `background_image_path` holds a storage path when the board
-- owner/member uploaded their own photo instead — the client treats a set
-- background_image_path as taking priority over the preset.

alter table boards add column background_image_path text;

-- Private bucket, same membership-scoped RLS pattern as "attachments"
-- (migrations/0001_init.sql): files live at `${board_id}/${uuid}-${filename}`,
-- RLS checks board membership from the first path segment.
insert into storage.buckets (id, name, public)
values ('board-backgrounds', 'board-backgrounds', false)
on conflict (id) do nothing;

create policy board_backgrounds_storage_all_members on storage.objects
  for all
  using (bucket_id = 'board-backgrounds' and is_board_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'board-backgrounds' and is_board_member(((storage.foldername(name))[1])::uuid));
