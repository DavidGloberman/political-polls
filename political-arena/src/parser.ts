import type { ParseResponse, ParsedPoll } from "./types";
import { createId } from "./utils";

const SYSTEM = `You strictly parse Hebrew election poll text. Return ONLY JSON. Do not invent, infer, correct, calculate, or add data. Numeric seats must be integers explicitly present. If a party has no numeric seat count or is explicitly described as not passing the threshold, seats=null. Source is required; if it cannot be identified, return an empty polls array. Preserve supplied source and party names. Shape: {"polls":[{"source":"string","parties":[{"name":"string","seats":number|null}]}]}.`;

export async function parseWithOpenAI(
  text: string,
  apiKey: string,
  model: string,
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
        { role: "user", content: text },
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
                          name: { type: "string" },
                          seats: { type: ["integer", "null"] },
                        },
                        required: ["name", "seats"],
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

  return parsedResponse.polls.map((poll) => ({
    id: createId("parsed"),
    source: poll.source,
    parties: poll.parties,
  }));
}
