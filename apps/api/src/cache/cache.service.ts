import { Injectable, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';

const CACHE_TTL_MS = (parseInt(process.env.CACHE_TTL_SECONDS || '3600', 10)) * 1000;

@Injectable()
export class CacheService implements OnModuleInit {
  private db!: Database.Database;

  onModuleInit() {
    const dbPath = process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'cache.sqlite');
    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    require('fs').mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        fetched_at INTEGER NOT NULL
      )
    `);
  }

  get<T>(key: string): T | null {
    const row = this.db.prepare('SELECT data, fetched_at FROM cache WHERE key = ?').get(key) as any;
    if (!row) return null;
    if (Date.now() - row.fetched_at > CACHE_TTL_MS) {
      this.db.prepare('DELETE FROM cache WHERE key = ?').run(key);
      return null;
    }
    return JSON.parse(row.data) as T;
  }

  set(key: string, data: any): void {
    this.db.prepare(
      'INSERT OR REPLACE INTO cache (key, data, fetched_at) VALUES (?, ?, ?)',
    ).run(key, JSON.stringify(data), Date.now());
  }
}
