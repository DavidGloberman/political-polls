import type {
  CellValue,
  ParsedPoll,
  PartyDictionaryEntry,
  PollTable,
  TableParty,
  ValidationResult,
} from "./types";

export const createId = (prefix = "id") =>
  `${prefix}-${crypto.randomUUID()}`;

export function normalizePartyName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("he");
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

function addDictionaryEntry(
  dictionary: PartyDictionaryEntry[],
  party: TableParty,
  sourceName: string,
) {
  const existing = dictionary.find((entry) => entry.id === party.id);

  if (existing) {
    return;
  }

  dictionary.push({
    id: party.id,
    name: party.name,
    aliases: sourceName === party.name ? [] : [sourceName],
  });
}

export function mergePolls(
  table: PollTable | null,
  incomingPolls: ParsedPoll[],
  dictionary: PartyDictionaryEntry[] = [],
): PollTable {
  const nextTable: PollTable = table
    ? structuredClone(table)
    : {
        version: 1,
        title: "סיכום סקרי השבוע",
        polls: [],
        parties: [],
      };

  const partiesById = new Map(
    nextTable.parties.map((party) => [party.id, party]),
  );
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
      let party = rawParty.partyId
        ? partiesById.get(rawParty.partyId)
        : undefined;

      if (!party) {
        party = partiesByName.get(normalizePartyName(rawParty.name));
      }

      if (!party) {
        const newParty: TableParty = {
          id: createId("party"),
          name: rawParty.name.trim(),
          values: {},
        };
        nextTable.parties.push(newParty);
        partiesById.set(newParty.id, newParty);
        partiesByName.set(normalizePartyName(newParty.name), newParty);
        addDictionaryEntry(dictionary, newParty, rawParty.name.trim());
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
