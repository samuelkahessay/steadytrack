import 'server-only';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import demoMicrocards from '@/data/demo-microcards.json';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type Row = Record<string, JsonValue | undefined>;
type RpcParams = {
  p_subjects?: string[];
  p_exclude_ids?: string[];
  p_limit?: number;
  p_min_quality_score?: number;
};
type LocalError = { message: string; code?: string };
type PublicRow = Record<string, never>;
type QueryResult = { data: PublicRow[]; error: LocalError | null };
type SingleResult = { data: PublicRow | null; error: LocalError | null };

const dbPath = process.env.STEADYTRACK_LOCAL_DB || path.join(process.cwd(), '.local', 'steadytrack.sqlite');

let instance: Database.Database | null = null;

function getDb() {
  if (instance) return instance;

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  instance = new Database(dbPath);
  instance.pragma('foreign_keys = ON');
  instance.exec(`
    CREATE TABLE IF NOT EXISTS content_microcards (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      outcome_code TEXT NOT NULL,
      summary TEXT NOT NULL,
      steps TEXT NOT NULL,
      pitfall TEXT,
      quick_check TEXT NOT NULL,
      quality_score INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS microcard_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      microcard_id TEXT NOT NULL,
      feedback_type TEXT NOT NULL,
      was_correct INTEGER,
      user_id TEXT,
      session_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contributor_signups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      interest_areas TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const count = instance.prepare('SELECT COUNT(*) AS count FROM content_microcards').get() as { count: number };
  if (count.count === 0) {
    const insert = instance.prepare(`
      INSERT INTO content_microcards (
        id, subject, unit_id, outcome_code, summary, steps, pitfall, quick_check, quality_score, status
      ) VALUES (
        @id, @subject, @unit_id, @outcome_code, @summary, @steps, @pitfall, @quick_check, @quality_score, 'active'
      )
    `);

    const seed = instance.transaction((cards: Row[]) => {
      for (const card of cards) {
        insert.run({
          ...card,
          steps: JSON.stringify(card.steps || []),
          quick_check: JSON.stringify(card.quick_check || {}),
        });
      }
    });

    seed(demoMicrocards as Row[]);
  }

  return instance;
}

function decodeCard(row: Row): Row {
  return {
    ...row,
    steps: JSON.parse(String(row.steps || '[]')),
    quick_check: JSON.parse(String(row.quick_check || '{}')),
  };
}

class LocalQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private selected = '*';
  private maxRows: number | null = null;

  constructor(private table: string) {}

  select(columns: string) {
    this.selected = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push(row => row[column] === value);
    return this;
  }

  gte(column: string, value: number | string) {
    this.filters.push(row => {
      const current = row[column];
      if (typeof value === 'number') return Number(current) >= value;
      return String(current || '') >= value;
    });
    return this;
  }

  order(_column: string, _options?: { ascending?: boolean }) {
    return this;
  }

  limit(count: number) {
    this.maxRows = count;
    return this;
  }

  in(column: string, values: unknown[]) {
    const set = new Set(values);
    this.filters.push(row => set.has(row[column]));
    return this;
  }

  async single(): Promise<SingleResult> {
    const result = await this.execute();
    const first = result.data[0] || null;
    return first
      ? { data: first, error: null }
      : { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
  }

  async insert(value: Row) {
    try {
      if (this.table === 'microcard_feedback') {
        getDb().prepare(`
          INSERT INTO microcard_feedback (microcard_id, feedback_type, was_correct, user_id, session_id)
          VALUES (@microcard_id, @feedback_type, @was_correct, @user_id, @session_id)
        `).run({ ...value, was_correct: value.was_correct === null ? null : value.was_correct ? 1 : 0 });
        return { data: null, error: null };
      }

      if (this.table === 'contributor_signups') {
        getDb().prepare(`
          INSERT INTO contributor_signups (name, email, interest_areas, message)
          VALUES (@name, @email, @interest_areas, @message)
        `).run({ ...value, interest_areas: JSON.stringify(value.interest_areas || []) });
        return { data: null, error: null };
      }

      return { data: null, error: new Error(`Insert not supported for ${this.table}`) };
    } catch (error) {
      return { data: null, error };
    }
  }

  then(resolve: (value: QueryResult) => void, reject: (reason?: unknown) => void) {
    this.execute().then(resolve, reject);
  }

  private async execute() {
    try {
      if (this.table !== 'content_microcards') {
        return { data: [], error: null };
      }

      let rows = getDb().prepare('SELECT * FROM content_microcards').all() as Row[];
      rows = rows.filter(row => this.filters.every(filter => filter(row)));
      if (this.maxRows !== null) rows = rows.slice(0, this.maxRows);

      const data = rows.map(row => {
        const decoded = decodeCard(row);
        if (this.selected.trim() === 'subject') return { subject: decoded.subject };
        return decoded;
      });

      return { data: data as PublicRow[], error: null };
    } catch (error) {
      return { data: [], error: { message: error instanceof Error ? error.message : String(error) } };
    }
  }
}

export function getLocalServerClient() {
  return {
    from(table: string) {
      return new LocalQuery(table);
    },
    async rpc(name: string, params: RpcParams) {
      if (name !== 'get_random_infinite_cards') {
        return { data: null, error: new Error(`RPC not supported: ${name}`) };
      }

      try {
        const subjects = new Set(params.p_subjects || []);
        const excluded = new Set(params.p_exclude_ids || []);
        const minQuality = Number(params.p_min_quality_score || 0);
        const limit = Number(params.p_limit || 20);

        const rows = (getDb().prepare('SELECT * FROM content_microcards WHERE status = ?').all('active') as Row[])
          .map(decodeCard)
          .filter(card => subjects.has(String(card.subject || '')))
          .filter(card => !excluded.has(String(card.id || '')))
          .filter(card => Number(card.quality_score) >= minQuality)
          .sort(() => Math.random() - 0.5)
          .slice(0, limit);

        return { data: rows, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  };
}
