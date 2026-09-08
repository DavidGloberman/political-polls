import type { PollTable } from "./types";

const STORAGE_KEY = "political-arena-state-v1";

export function saveTable(table: PollTable | null) {
  if (!table) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(table));
}

export function loadTable(): PollTable | null {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    const table = JSON.parse(storedValue) as PollTable;

    return table?.version === 1 &&
      Array.isArray(table.polls) &&
      Array.isArray(table.parties)
      ? table
      : null;
  } catch {
    return null;
  }
}

export const clearTable = () => localStorage.removeItem(STORAGE_KEY);
