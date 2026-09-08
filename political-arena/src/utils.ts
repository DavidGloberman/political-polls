import type {
  CellValue,
  ParsedPoll,
  PollTable,
  TableParty,
  ValidationResult,
} from "./types";

export const createId = (prefix = "id") =>
  `${prefix}-${crypto.randomUUID()}`;

export function normalizePartyName(name: string) {
  return name
    .trim()
    .replace(/[״”"']/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("he")
    .replace(/^הרשימה\s+/, "")
    .replace(/^מפלגת\s+/, "");
}

export function displayPartyName(name: string) {
  const normalizedName = normalizePartyName(name);
  const displayNames: Record<string, string> = {
    שס: "ש״ס",
    רעמ: "רע״ם",
    "הרשימה המשותפת": "המשותפת",
    ישר: "ישר!",
  };

  return displayNames[normalizedName] ?? name.trim();
}

export function validatePoll(poll: {
  id: string;
  source: string;
  parties: { seats: CellValue }[];
}): ValidationResult {
  const total = poll.parties.reduce(
    (sum, party) => sum + (party.seats ?? 0),
    0,
  );

  return {
    pollId: poll.id,
    source: poll.source,
    total,
    valid: total === 120,
    missing: Math.max(120 - total, 0),
    excess: Math.max(total - 120, 0),
  };
}

export function validateTable(table: PollTable): ValidationResult[] {
  return table.polls.map((poll) => {
    const total = table.parties.reduce(
      (sum, party) => sum + (party.values[poll.id] ?? 0),
      0,
    );

    return {
      pollId: poll.id,
      source: poll.source,
      total,
      valid: total === 120,
      missing: Math.max(120 - total, 0),
      excess: Math.max(total - 120, 0),
    };
  });
}

export const allValid = (table: PollTable) =>
  validateTable(table).every((result) => result.valid);

export function mergePolls(
  table: PollTable | null,
  incomingPolls: ParsedPoll[],
): PollTable {
  const nextTable: PollTable = table
    ? structuredClone(table)
    : {
        version: 1,
        title: "סיכום סקרי השבוע",
        polls: [],
        parties: [],
      };

  const partiesByName = new Map(
    nextTable.parties.map((party) => [normalizePartyName(party.name), party]),
  );

  for (const incomingPoll of incomingPolls) {
    const pollId = createId("poll");
    nextTable.polls.push({
      id: pollId,
      source: incomingPoll.source.trim(),
    });

    for (const rawParty of incomingPoll.parties) {
      const normalizedName = normalizePartyName(rawParty.name);
      let party = partiesByName.get(normalizedName);

      if (
        !party &&
        normalizedName === normalizePartyName("הרשימה המשותפת")
      ) {
        party = partiesByName.get(normalizePartyName("המשותפת"));
      }

      if (!party) {
        const newParty: TableParty = {
          id: createId("party"),
          name: displayPartyName(rawParty.name),
          values: {},
        };
        nextTable.parties.push(newParty);
        partiesByName.set(normalizedName, newParty);
        party = newParty;
      }

      party.values[pollId] = rawParty.seats;
    }

    for (const party of nextTable.parties) {
      if (!(pollId in party.values)) {
        party.values[pollId] = null;
      }
    }
  }

  for (const party of nextTable.parties) {
    for (const poll of nextTable.polls) {
      if (!(poll.id in party.values)) {
        party.values[poll.id] = null;
      }
    }
  }

  return nextTable;
}

export function sortPartiesByFirstPoll(table: PollTable) {
  const firstPollId = table.polls[0]?.id;

  if (!firstPollId) {
    return table;
  }

  return {
    ...table,
    parties: [...table.parties].sort(
      (firstParty, secondParty) =>
        (secondParty.values[firstPollId] ?? -1) -
        (firstParty.values[firstPollId] ?? -1),
    ),
  };
}
