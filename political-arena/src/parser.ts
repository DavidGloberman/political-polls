import type {
  ParseResponse,
  ParsedPoll,
  PartyDictionaryEntry,
} from "./types";
import { createId } from "./utils";

const SYSTEM = `You are a strict parser for Hebrew election poll text.

Your task has exactly two responsibilities:
1. Extract polls, their source names, party names, and seat counts from the supplied text.
2. Match each extracted party to the supplied party dictionary.

Party matching rules:
- Match a party ONLY when the party name exactly matches a dictionary entry's name or one of its aliases, after trimming whitespace and collapsing repeated whitespace.
- Do not use political knowledge, external knowledge, semantic similarity, abbreviations, spelling correction, punctuation interpretation, or guessing to create a match.
- If there is no exact dictionary match, return partyId=null. Do not invent an ID.
- Preserve the party name as it appears in the source text in sourceName.

Parsing rules:
- Return only information explicitly present in the supplied text.
- Do not invent, infer, correct, calculate, complete, or redistribute seat counts.
- seats must be the integer explicitly associated with that party, or null when no numeric seat count is explicitly present.
- If a party is explicitly described as not passing the threshold and no seat count is present, seats=null.
- Source is required. If a poll source cannot be identified, do not invent one.
- Do not merge two source names unless the text itself identifies them as the same source.
- Do not create parties that are not represented by the supplied text.
- Return JSON only and follow the supplied schema exactly.`;

function buildDictionaryText(dictionary: PartyDictionaryEntry[]) {
  return JSON.stringify(
    dictionary.map(({ id, name, aliases }) => ({ id, name, aliases })),
    null,
    2,
  );
}

export async function parseWithOpenAI(
  text: string,
  apiKey: string,
  model: string,
  dictionary: PartyDictionaryEntry[],
): Promise<ParsedPoll[]> {
  if (!apiKey.trim()) {
    throw new Error("חסר API Key. היכנס להגדרות והוסף מפתח AI.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: model || "gpt-5-mini",
      input: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `PARTY_DICTIONARY:\n${buildDictionaryText(dictionary)}\n\nPOLL_TEXT:\n${text}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "poll_parser",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              polls: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    source: { type: "string" },
                    parties: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          partyId: { type: ["string", "null"] },
                          sourceName: { type: "string" },
                          seats: { type: ["integer", "null"] },
                        },
                        required: ["partyId", "sourceName", "seats"],
                      },
                    },
                  },
                  required: ["source", "parties"],
                },
              },
            },
            required: ["polls"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`שגיאה בשירות ה-AI (${response.status}).`);
  }

  const data = await response.json();
  const outputText =
    data.output_text ??
    data.output
      ?.flatMap(
        (outputItem: { content?: unknown[] }) => outputItem.content ?? [],
      )
      .filter(
        (contentItem: { type?: string }) => contentItem.type === "output_text",
      )
      .map((contentItem: { text?: string }) => contentItem.text)
      .join("");

  if (!outputText) {
    throw new Error("לא התקבלה תשובת JSON מה-AI.");
  }

  const parsedResponse = JSON.parse(outputText) as ParseResponse;
  const knownPartyIds = new Set(dictionary.map((party) => party.id));

  return parsedResponse.polls.map((poll) => ({
    id: createId("parsed"),
    source: poll.source,
    parties: poll.parties.map((party) => ({
      name: party.sourceName,
      seats: party.seats,
      partyId:
        party.partyId && knownPartyIds.has(party.partyId)
          ? party.partyId
          : undefined,
    })) as ParsedPoll["parties"],
  }));
}
