import type { ParseResponse, ParsedPoll } from "./types";
import { createId, normalizePartyName } from "./utils";

const SYSTEM = `You are a strict parser for Hebrew election poll text.

Your only responsibility is to extract the data explicitly written in the supplied text.

Extract:
1. Each poll and its source name.
2. Each party name exactly as it appears in that poll.
3. The integer seat count explicitly associated with that party.

Parsing rules:
- Return only information explicitly present in the supplied text.
- Do not invent, infer, correct, calculate, complete, redistribute, or guess seat counts.
- seats must be the integer explicitly associated with that party, or null when no numeric seat count is explicitly present.
- If a party is explicitly described as not passing the threshold and no seat count is present, seats=null.
- Preserve the party name as it appears in the source text in sourceName.
- Source is required. If a poll source cannot be identified, do not invent one.
- Do not merge two source names unless the text itself identifies them as the same source.
- Do not create parties that are not represented by the supplied text.
- Do not use political knowledge or external knowledge.
- Do not match parties to a dictionary. Party matching is performed deterministically by the application after parsing.
- Return JSON only and follow the supplied schema exactly.`;

function validateParseResponse(response: ParseResponse) {
  for (const poll of response.polls) {
    if (!poll.source.trim()) {
      throw new Error("ה-AI החזיר סקר ללא מקור.");
    }

    const seenNames = new Set<string>();

    for (const party of poll.parties) {
      if (!party.sourceName.trim()) {
        throw new Error("ה-AI החזיר מפלגה ללא שם.");
      }

      if (party.seats !== null && party.seats < 0) {
        throw new Error("ה-AI החזיר מספר מנדטים לא תקין.");
      }

      const normalizedName = normalizePartyName(party.sourceName);
      if (seenNames.has(normalizedName)) {
        throw new Error(
          `המפלגה "${party.sourceName}" הופיעה יותר מפעם אחת באותו סקר.`,
        );
      }
      seenNames.add(normalizedName);
    }
  }
}

export async function parseWithOpenAI(
  text: string,
  apiKey: string,
  model: string,
  _dictionary: unknown,
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
        { role: "user", content: `POLL_TEXT:\n${text}` },
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
                          sourceName: { type: "string" },
                          seats: { type: ["integer", "null"] },
                        },
                        required: ["sourceName", "seats"],
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

  let parsedResponse: ParseResponse;

  try {
    parsedResponse = JSON.parse(outputText) as ParseResponse;
  } catch {
    throw new Error("ה-AI החזיר JSON לא תקין.");
  }

  validateParseResponse(parsedResponse);

  return parsedResponse.polls.map((poll) => ({
    id: createId("parsed"),
    source: poll.source.trim(),
    parties: poll.parties.map((party) => ({
      name: party.sourceName.trim(),
      seats: party.seats,
    })),
  }));
}
