// Hand-written types mirroring migrations/0001_init.sql.

export type BoardRole = "owner" | "member";

export type Board = {
  id: string;
  owner_id: string;
  name: string;
  background: string | null;
  created_at: string;
  updated_at: string;
};

export type BoardMember = {
  id: string;
  board_id: string;
  user_id: string;
  role: BoardRole;
  display_name: string | null;
  created_at: string;
};

export type List = {
  id: string;
  board_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type Card = {
  id: string;
  board_id: string;
  list_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  is_done: boolean;
  assigned_to: string | null;
  due_notified_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type ChecklistItem = {
  id: string;
  board_id: string;
  card_id: string;
  text: string;
  is_done: boolean;
  position: number;
  created_at: string;
};

export type Attachment = {
  id: string;
  board_id: string;
  card_id: string;
  file_name: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export type AiMessageRole = "user" | "assistant";

export type AiMessage = {
  id: string;
  board_id: string;
  card_id: string;
  role: AiMessageRole;
  content: string;
  created_by: string | null;
  created_at: string;
};
