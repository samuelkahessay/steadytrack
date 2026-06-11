"use client";

import demoMicrocards from "@/data/demo-microcards.json";
import type { ContentMicrocard } from "@/lib/types";

type LocalError = { message: string; code?: string };
type LocalResult<T> = { data: T; error: LocalError | null };
type MicrocardRow = ContentMicrocard;

let client: LocalBrowserClient | undefined;

class LocalBrowserQuery {
  private filters: Array<(row: MicrocardRow) => boolean> = [];
  private rowLimit: number | null = null;
  private orderColumn: string | null = null;

  constructor(private table: string) {}

  select(_columns: string) {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => getValue(row, column) === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    const set = new Set(values);
    this.filters.push((row) => set.has(getValue(row, column)));
    return this;
  }

  gte(column: string, value: number | string) {
    this.filters.push((row) => Number(getValue(row, column)) >= Number(value));
    return this;
  }

  order(column: string) {
    this.orderColumn = column;
    return this;
  }

  limit(count: number) {
    this.rowLimit = count;
    return this;
  }

  async maybeSingle(): Promise<LocalResult<MicrocardRow | null>> {
    const result = await this.execute();
    return { data: result.data[0] || null, error: null };
  }

  async single(): Promise<LocalResult<MicrocardRow | null>> {
    const result = await this.execute();
    const first = result.data[0] || null;
    return first
      ? { data: first, error: null }
      : { data: null, error: { message: "No rows found", code: "PGRST116" } };
  }

  then(
    resolve: (value: LocalResult<MicrocardRow[]>) => void,
    reject: (reason?: unknown) => void
  ) {
    this.execute().then(resolve, reject);
  }

  private async execute(): Promise<LocalResult<MicrocardRow[]>> {
    if (this.table !== "content_microcards") {
      return { data: [], error: null };
    }

    let rows = (demoMicrocards as MicrocardRow[]).filter((row) =>
      this.filters.every((filter) => filter(row))
    );

    if (this.orderColumn) {
      const column = this.orderColumn;
      rows = [...rows].sort((a, b) =>
        String(getValue(a, column) || "").localeCompare(String(getValue(b, column) || ""))
      );
    }

    if (this.rowLimit !== null) {
      rows = rows.slice(0, this.rowLimit);
    }

    return { data: rows, error: null };
  }
}

function getValue(row: MicrocardRow, column: string) {
  return (row as unknown as Record<string, unknown>)[column];
}

class LocalBrowserClient {
  from(table: string) {
    return new LocalBrowserQuery(table);
  }
}

export function getContentClient() {
  if (!client) {
    client = new LocalBrowserClient();
  }

  return client;
}
