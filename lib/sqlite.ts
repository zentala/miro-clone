import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

// This module is used exclusively by Node.js route handlers.
type Statement = { get(...args: unknown[]): unknown; all(...args: unknown[]): unknown[]; run(...args: unknown[]): unknown };
type Database = { exec(sql: string): void; prepare(sql: string): Statement };
let database: Database | undefined;
export function getDatabase(): Database {
    if (database) return database;
    const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (path: string) => Database };
    const configuredPath = process.env.MIRO_SQLITE_PATH;
    if (configuredPath && !isAbsolute(configuredPath)) throw new Error("MIRO_SQLITE_PATH must be absolute");
    const databasePath = configuredPath || join(process.cwd(), "data", "miro.sqlite");
    mkdirSync(dirname(databasePath), { recursive: true });
    const db = new DatabaseSync(databasePath);
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
        CREATE TABLE IF NOT EXISTS boards (
            id TEXT PRIMARY KEY, title TEXT NOT NULL,
            created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
            document TEXT NOT NULL
        )`);
    database = db;
    return db;
}
