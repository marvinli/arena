import { join } from "node:path";
import Database from "better-sqlite3";

const DB_PATH =
  process.env.DB_PATH ?? join(import.meta.dirname, "../data/arena.db");

const db: import("better-sqlite3").Database = new Database(DB_PATH);

// WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

export default db;
