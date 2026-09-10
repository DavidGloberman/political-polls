export type CellValue = number | null;

export interface PartyDictionaryEntry {
  id: string;
  name: string;
  aliases: string[];
}

export interface ParsedParty {
  name: string;
  seats: number | null;
  partyId?: string;
}

export interface ParsedPoll {
  id: string;
  source: string;
  parties: ParsedParty[];
}

export interface PollColumn {
  id: string;
  source: string;
}

export interface TableParty {
  id: string;
  name: string;
  values: Record<string, CellValue>;
}

export interface PollTable {
  version: 1;
  title: string;
  polls: PollColumn[];
  parties: TableParty[];
}

export interface ValidationResult {
  pollId: string;
  source: string;
  total: number;
  valid: boolean;
  missing: number;
  excess: number;
}

export interface ParseResponse {
  polls: Array<{
    source: string;
    parties: Array<{
      sourceName: string;
      seats: number | null;
    }>;
  }>;
}
