import type { PartyDictionaryEntry, PollTable } from "./types";

const STORAGE_KEY = "political-arena-state-v1";
const PARTY_DICTIONARY_KEY = "political-arena-party-dictionary-v1";

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

export function savePartyDictionary(dictionary: PartyDictionaryEntry[]) {
  localStorage.setItem(PARTY_DICTIONARY_KEY, JSON.stringify(dictionary));
}

export function loadPartyDictionary(): PartyDictionaryEntry[] {
  try {
    const storedValue = localStorage.getItem(PARTY_DICTIONARY_KEY);

    if (!storedValue) {
      return [];
    }

    const dictionary = JSON.parse(storedValue) as PartyDictionaryEntry[];

    return Array.isArray(dictionary) ? dictionary : [];
  } catch {
    return [];
  }
}

export const clearTable = () => localStorage.removeItem(STORAGE_KEY);
