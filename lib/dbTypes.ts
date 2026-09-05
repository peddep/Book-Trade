// Row shapes for `SELECT *` (or similarly wide) queries against the tables in
// lib/db.ts and lib/hub.ts. These exist only to replace `as any` at call
// sites with something that catches a typo'd column name — they are not
// runtime-validated, so a shape here is only as accurate as the schema was
// when it was written. Every column is optional-ish (nullable) unless the
// CREATE TABLE marks it NOT NULL with no default that could leave it unset
// on an older row.

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  grade: string | null;
  avatar_color: string | null;
  availability: string | null;
  class_no: string | null;
  contact: string | null;
  real_name: string | null;
  banned: number | null;
  terms_accepted_at: string | null;
  google_sub: string | null;
  created_at: string | null;
}

export interface BookRow {
  id: number;
  owner_id: number;
  title: string;
  title_en: string | null;
  price: number | null;
  volume: string | null;
  publisher: string | null;
  author: string;
  subject: string | null;
  grade_level: string | null;
  condition: string;
  description: string | null;
  cover_color: string | null;
  cover_url: string | null;
  isbn: string | null;
  cover_source: string | null;
  thumb_url: string | null;
  available: number;
  deleted_at: string | null;
  created_at: string | null;
}

export interface TradeRow {
  id: number;
  requester_id: number;
  owner_id: number;
  offered_book_id: number;
  wanted_book_id: number;
  status: string;
  message: string | null;
  requester_confirm: string | null;
  owner_confirm: string | null;
  meeting_date: string | null;
  meeting_period: string | null;
  meeting_sub: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RoomRow {
  id: number;
  code: string;
  owner_id: number;
  status: string;
  created_at: string | null;
}

export interface RoomMemberRow {
  id: number;
  room_id: number;
  user_id: number;
  book_id: number;
  received_book_id: number | null;
  created_at: string | null;
}

export interface WonderBoxRow {
  id: number;
  user_id: number;
  book_id: number;
  status: string;
  matched_trade_id: number | null;
  created_at: string | null;
}

export interface GtsDepositRow {
  id: number;
  user_id: number;
  book_id: number;
  wanted_title: string | null;
  wanted_subject: string | null;
  status: string;
  matched_trade_id: number | null;
  created_at: string | null;
}

export interface CatalogBookRow {
  id: number;
  title: string;
  author: string | null;
  publisher: string | null;
  source: string | null;
  created_at: string | null;
}
