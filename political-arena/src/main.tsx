import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Check,
  GripVertical,
  ImageDown,
  LoaderCircle,
  Menu,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import "./styles.css";
import "./partyDictionary.css";
import type { PartyDictionaryEntry, PollTable } from "./types";
import {
  clearTable,
  loadPartyDictionary,
  loadTable,
  savePartyDictionary,
  saveTable,
} from "./storage";
import {
  allValid,
  createId,
  mergePolls,
  normalizePartyName,
  sortPartiesByFirstPoll,
  validateTable,
} from "./utils";
import { parseWithOpenAI } from "./parser";
import { sampleText } from "./sample";
import { downloadTableAsPng } from "./exportImage";

const API_KEY_STORAGE = "political-arena-openai-key";
const MODEL_STORAGE = "political-arena-model";

function getInitialDictionary(table: PollTable | null) {
  const stored = loadPartyDictionary();

  if (stored.length || !table) {
    return stored;
  }

  return table.parties.map((party) => ({
    id: party.id,
    name: party.name,
    aliases: [],
  }));
}

function App() {
  const [table, setTable] = useState<PollTable | null>(() => loadTable());
  const [dictionary, setDictionary] = useState<PartyDictionaryEntry[]>(() =>
    getInitialDictionary(loadTable()),
  );
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(API_KEY_STORAGE) || "",
  );
  const [model, setModel] = useState(
    () => localStorage.getItem(MODEL_STORAGE) || "gpt-5-mini",
  );
  const [draggedPartyId, setDraggedPartyId] = useState<string | null>(null);
  const [draggedPollId, setDraggedPollId] = useState<string | null>(null);

  useEffect(() => saveTable(table), [table]);
  useEffect(() => savePartyDictionary(dictionary), [dictionary]);

  const validationResults = useMemo(
    () => (table ? validateTable(table) : []),
    [table],
  );
  const ready = !!table && allValid(table);

  const updateTable = (updater: (current: PollTable) => PollTable) => {
    setTable((current) => (current ? updater(current) : current));
  };

  async function parsePolls() {
    if (!text.trim()) {
      setMessage("הדבק קודם את טקסט הסקר.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const parsedPolls = await parseWithOpenAI(text, apiKey, model, dictionary);

      if (!parsedPolls.length) {
        throw new Error("לא נמצאו סקרים בטקסט.");
      }

      const nextDictionary = structuredClone(dictionary);
      const nextTable = table
        ? mergePolls(table, parsedPolls, nextDictionary)
        : sortPartiesByFirstPoll(
            mergePolls(null, parsedPolls, nextDictionary),
          );

      setDictionary(nextDictionary);
      setTable(nextTable);
      setText("");
      setMessage(`נוספו ${parsedPolls.length} סקרים בהצלחה.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "אירעה שגיאה בפרסור.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function exportImage() {
    if (!table || !ready) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await downloadTableAsPng(table);
      setMessage("התמונה נוצרה בהצלחה.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "אירעה שגיאה ביצירת התמונה.",
      );
    } finally {
      setBusy(false);
    }
  }

  const startNewSummary = () => {
    if (confirm("להתחיל סיכום חדש? העבודה הנוכחית תימחק מהדפדפן.")) {
      clearTable();
      setTable(null);
      setText("");
      setMessage(null);
    }
  };

  const renameParty = (partyId: string, newName: string) => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      return;
    }

    const currentParty = table?.parties.find((party) => party.id === partyId);
    if (!currentParty) {
      return;
    }

    const duplicate = dictionary.find(
      (entry) =>
        entry.id !== partyId &&
        (normalizePartyName(entry.name) === normalizePartyName(trimmedName) ||
          entry.aliases.some(
            (alias) => normalizePartyName(alias) === normalizePartyName(trimmedName),
          )),
    );

    if (duplicate) {
      setMessage(`השם כבר משויך למפלגה "${duplicate.name}".`);
      return;
    }

    setTable((current) =>
      current
        ? {
            ...current,
            parties: current.parties.map((party) =>
              party.id === partyId ? { ...party, name: trimmedName } : party,
            ),
          }
        : current,
    );

    setDictionary((current) =>
      current.map((entry) => {
        if (entry.id !== partyId) {
          return entry;
        }

        const aliases = [...entry.aliases];
        if (
          entry.name.trim() !== trimmedName &&
          entry.name.trim() &&
          !aliases.some(
            (alias) => normalizePartyName(alias) === normalizePartyName(entry.name),
          )
        ) {
          aliases.push(entry.name.trim());
        }

        return { ...entry, name: trimmedName, aliases };
      }),
    );
  };

  const updateAlias = (
    partyId: string,
    aliasIndex: number,
    value: string,
  ) => {
    setDictionary((current) =>
      current.map((entry) => {
        if (entry.id !== partyId) {
          return entry;
        }

        const aliases = [...entry.aliases];
        aliases[aliasIndex] = value;
        return { ...entry, aliases };
      }),
    );
  };

  const addAlias = (partyId: string) => {
    setDictionary((current) =>
      current.map((entry) =>
        entry.id === partyId
          ? { ...entry, aliases: [...entry.aliases, ""] }
          : entry,
      ),
    );
  };

  const removeAlias = (partyId: string, aliasIndex: number) => {
    setDictionary((current) =>
      current.map((entry) =>
        entry.id === partyId
          ? {
              ...entry,
              aliases: entry.aliases.filter((_, index) => index !== aliasIndex),
            }
          : entry,
      ),
    );
  };

  const removeParty = (partyId: string) => {
    setDictionary((current) => current.filter((entry) => entry.id !== partyId));
  };

  const updateCell = (partyId: string, pollId: string, value: string) => {
    const numericValue = value.trim() === "" ? null : Number(value);

    if (
      numericValue !== null &&
      (!Number.isInteger(numericValue) || numericValue < 0)
    ) {
      return;
    }

    updateTable((current) => ({
      ...current,
      parties: current.parties.map((party) =>
        party.id === partyId
          ? {
              ...party,
              values: {
                ...party.values,
                [pollId]: numericValue,
              },
            }
          : party,
      ),
    }));
  };

  const reorderItems = (type: "party" | "poll", targetId: string) => {
    const sourceId = type === "party" ? draggedPartyId : draggedPollId;

    if (!sourceId || sourceId === targetId) {
      return;
    }

    updateTable((current) => {
      if (type === "party") {
        const parties = [...current.parties];
        const sourceIndex = parties.findIndex((party) => party.id === sourceId);
        const targetIndex = parties.findIndex((party) => party.id === targetId);

        if (sourceIndex < 0 || targetIndex < 0) {
          return current;
        }

        const [movedParty] = parties.splice(sourceIndex, 1);
        parties.splice(targetIndex, 0, movedParty);
        return { ...current, parties };
      }

      const polls = [...current.polls];
      const sourceIndex = polls.findIndex((poll) => poll.id === sourceId);
      const targetIndex = polls.findIndex((poll) => poll.id === targetId);

      if (sourceIndex < 0 || targetIndex < 0) {
        return current;
      }

      const [movedPoll] = polls.splice(sourceIndex, 1);
      polls.splice(targetIndex, 0, movedPoll);
      return { ...current, polls };
    });

    if (type === "party") {
      setDraggedPartyId(null);
    } else {
      setDraggedPollId(null);
    }
  };

  return (
    <div className="app">
      <header>
        <div className="brand">
          <div className="logo">🏛</div>
          <div>
            <b>זירה פוליטית</b>
            <small>סיכום סקרי מנדטים</small>
          </div>
        </div>

        <div className="top-actions">
          {table && (
            <button className="ghost" onClick={startNewSummary}>
              <RotateCcw size={16} /> התחל מחדש
            </button>
          )}

          <div className="menu-wrap">
            <button
              className="ghost menu-button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="תפריט"
            >
              <Menu size={19} />
            </button>
            {menuOpen && (
              <div className="menu-dropdown">
                <button
                  onClick={() => {
                    setDictionaryOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  ניהול שמות מפלגות
                </button>
                <button
                  onClick={() => {
                    setSettingsOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  <Settings size={15} /> הגדרות AI
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {!table ? (
        <main className="landing">
          <div className="hero">
            <span className="eyebrow">
              <Sparkles size={15} /> כלי מהיר לסיכום סקרים
            </span>
            <h1>
              הדבק את הסקרים שלך.
              <br />
              <span>אנחנו נסדר את השאר.</span>
            </h1>
            <p>
              הדבק סקר אחד או כמה סקרים, פרסר אותם, תקן רק אם צריך וקבל טבלת
              סיכום מוכנה לשיתוף.
            </p>

            <div className="paste">
              <div className="paste-head">
                <div>
                  <b>טקסט הסקרים</b>
                  <small>אפשר להדביק כמה סקרים יחד</small>
                </div>
                <button className="small" onClick={() => setText(sampleText)}>
                  טען דוגמה
                </button>
              </div>

              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={"מעריב:\nישר! 23\nהליכוד 20\nביחד 15\n...\n\nחדשות 12:\nישר 24\nהליכוד 23\n..."}
              />

              <div className="paste-foot">
                <span>
                  {text
                    ? `${text.length.toLocaleString("he-IL")} תווים`
                    : "הדבק כאן את הטקסט שהתקבל"}
                </span>
                <button
                  className="primary"
                  disabled={busy || !text.trim()}
                  onClick={parsePolls}
                >
                  {busy ? (
                    <>
                      <LoaderCircle className="spin" size={17} /> מפרסר...
                    </>
                  ) : (
                    <>
                      <Sparkles size={17} /> פרסר סקרים
                    </>
                  )}
                </button>
              </div>
            </div>

            {message && (
              <div className="message bad">
                <X size={17} /> {message}
              </div>
            )}

            <div className="steps">
              <span>
                <b>01</b> מדביקים
              </span>
              <span>
                <b>02</b> AI מפרסר
              </span>
              <span>
                <b>03</b> עורכים
              </span>
              <span>
                <b>04</b> מורידים
              </span>
            </div>
          </div>
        </main>
      ) : (
        <main className="work">
          <div className="work-head">
            <div>
              <span className="eyebrow">טבלת סיכום</span>
              <h1>עריכה וסידור</h1>
              <p>הכול ניתן לעריכה. גרור את הידית כדי לשנות סדר.</p>
            </div>
            <div className="actions">
              <button className="secondary" onClick={() => setText("")}>
                <Plus size={17} /> הוסף סקר
              </button>
              <button
                className="primary"
                disabled={!ready || busy}
                onClick={exportImage}
                title={!ready ? "כל הסקרים צריכים להסתכם ל־120" : ""}
              >
                {busy ? (
                  <>
                    <LoaderCircle className="spin" size={17} /> יוצר תמונה...
                  </>
                ) : (
                  <>
                    <ImageDown size={17} /> צור תמונה
                  </>
                )}
              </button>
            </div>
          </div>

          <div className={`status ${ready ? "ok" : "bad"}`}>
            {ready ? <Check size={16} /> : <X size={16} />}
            {ready ? "כל הסקרים תקינים — 120" : "יש סקרים שדורשים תיקון"}
          </div>

          {!ready && (
            <div className="warning">
              <strong>לפני יצירת התמונה צריך להשלים את הסקרים</strong>
              <div>
                {validationResults
                  .filter((result) => !result.valid)
                  .map((result) => (
                    <span key={result.pollId}>
                      {result.source}: {result.total}{" "}
                      {result.total < 120
                        ? `(חסרים ${120 - result.total})`
                        : `(עודפים ${result.total - 120})`}
                    </span>
                  ))}
              </div>
            </div>
          )}

          <section className="editor">
            <div className="title">
              <input
                value={table.title}
                onChange={(event) =>
                  updateTable((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
              <span>
                <Save size={13} /> נשמר אוטומטית
              </span>
            </div>

            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>מפלגה</th>
                    {table.polls.map((poll) => (
                      <th
                        key={poll.id}
                        draggable
                        onDragStart={() => setDraggedPollId(poll.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => reorderItems("poll", poll.id)}
                      >
                        <div className="head-cell">
                          <GripVertical size={15} />
                          <input
                            value={poll.source}
                            onChange={(event) =>
                              updateTable((current) => ({
                                ...current,
                                polls: current.polls.map((currentPoll) =>
                                  currentPoll.id === poll.id
                                    ? {
                                        ...currentPoll,
                                        source: event.target.value,
                                      }
                                    : currentPoll,
                                ),
                              }))
                            }
                          />
                          <button
                            className="icon danger"
                            onClick={() =>
                              updateTable((current) => ({
                                ...current,
                                polls: current.polls.filter(
                                  (currentPoll) => currentPoll.id !== poll.id,
                                ),
                                parties: current.parties.map((party) => {
                                  const values = { ...party.values };
                                  delete values[poll.id];
                                  return { ...party, values };
                                }),
                              }))
                            }
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {table.parties.map((party) => (
                    <tr
                      key={party.id}
                      draggable
                      onDragStart={() => setDraggedPartyId(party.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => reorderItems("party", party.id)}
                    >
                      <td>
                        <div className="party">
                          <GripVertical size={16} />
                          <input
                            value={party.name}
                            onChange={(event) =>
                              renameParty(party.id, event.target.value)
                            }
                          />
                          <button
                            className="icon danger"
                            onClick={() => {
                              removeParty(party.id);
                              updateTable((current) => ({
                                ...current,
                                parties: current.parties.filter(
                                  (currentParty) => currentParty.id !== party.id,
                                ),
                              }));
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>

                      {table.polls.map((poll) => (
                        <td key={poll.id}>
                          <input
                            className="num"
                            value={party.values[poll.id] ?? ""}
                            placeholder="--"
                            onChange={(event) =>
                              updateCell(
                                party.id,
                                poll.id,
                                event.target.value,
                              )
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}

                  <tr className="total">
                    <td>סה״כ</td>
                    {validationResults.map((result) => (
                      <td
                        key={result.pollId}
                        className={result.valid ? "good" : "wrong"}
                      >
                        {result.total}
                        {result.valid && <Check size={14} />}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="editor-foot">
              <button
                className="secondary"
                onClick={() => {
                  const id = createId("party");
                  updateTable((current) => ({
                    ...current,
                    parties: [
                      ...current.parties,
                      {
                        id,
                        name: "מפלגה חדשה",
                        values: Object.fromEntries(
                          current.polls.map((poll) => [poll.id, null]),
                        ),
                      },
                    ],
                  }));
                  setDictionary((current) => [
                    ...current,
                    { id, name: "מפלגה חדשה", aliases: [] },
                  ]);
                }}
              >
                <Plus size={16} /> הוסף מפלגה
              </button>
              <span>
                <GripVertical size={14} /> גרור שורות ועמודות לשינוי הסדר
              </span>
            </div>
          </section>

          <section className="add">
            <div>
              <Plus size={19} />
              <div>
                <b>רוצה להוסיף עוד סקר?</b>
                <small>
                  הדבק אותו כאן והמערכת תפרסר רק אותו ותוסיף לטבלה.
                </small>
              </div>
            </div>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="הדבק כאן את הסקר החדש..."
            />
            <button
              className="primary"
              disabled={busy || !text.trim()}
              onClick={parsePolls}
            >
              {busy ? (
                <>
                  <LoaderCircle className="spin" /> מפרסר...
                </>
              ) : (
                <>
                  <Plus /> הוסף סקר
                </>
              )}
            </button>
          </section>

          {message && (
            <div className="message info">
              <Check size={17} /> {message}
            </div>
          )}
        </main>
      )}

      {settingsOpen && (
        <div className="backdrop" onMouseDown={() => setSettingsOpen(false)}>
          <div
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <b>
                <Settings size={18} /> הגדרות AI
              </b>
              <button className="icon" onClick={() => setSettingsOpen(false)}>
                <X />
              </button>
            </div>

            <p>המפתח נשמר מקומית בדפדפן ונשלח ישירות לשירות ה-AI.</p>

            <label>OpenAI API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
            />

            <label>Model</label>
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="gpt-5-mini"
            />

            <div className="modal-actions">
              <button
                className="secondary"
                onClick={() => {
                  setApiKey("");
                  localStorage.removeItem(API_KEY_STORAGE);
                }}
              >
                נקה מפתח
              </button>
              <button
                className="primary"
                onClick={() => {
                  localStorage.setItem(API_KEY_STORAGE, apiKey);
                  localStorage.setItem(MODEL_STORAGE, model);
                  setSettingsOpen(false);
                  setMessage("הגדרות נשמרו.");
                }}
              >
                שמור
              </button>
            </div>
          </div>
        </div>
      )}

      {dictionaryOpen && (
        <div className="backdrop" onMouseDown={() => setDictionaryOpen(false)}>
          <div
            className="modal dictionary-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <b>ניהול שמות מפלגות</b>
              <button className="icon" onClick={() => setDictionaryOpen(false)}>
                <X />
              </button>
            </div>

            <p>
              השם הראשי הוא השם שהמערכת מציגה. aliases הם שמות חלופיים שה-AI
              רשאי להתאים אליו. המערכת לא מוסיפה aliases בעצמה.
            </p>

            <div className="dictionary-list">
              {dictionary.map((entry) => (
                <div className="dictionary-item" key={entry.id}>
                  <div className="dictionary-name-row">
                    <input
                      value={entry.name}
                      onChange={(event) =>
                        setDictionary((current) =>
                          current.map((item) =>
                            item.id === entry.id
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                        )
                      }
                      onBlur={() => {
                        const item = dictionary.find((candidate) => candidate.id === entry.id);
                        if (item && item.name.trim()) {
                          renameParty(entry.id, item.name);
                        }
                      }}
                    />
                    <button
                      className="icon danger"
                      onClick={() => removeParty(entry.id)}
                      title="מחק מהמילון"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="aliases">
                    {entry.aliases.map((alias, index) => (
                      <div className="alias-row" key={`${entry.id}-${index}`}>
                        <input
                          value={alias}
                          onChange={(event) =>
                            updateAlias(entry.id, index, event.target.value)
                          }
                        />
                        <button
                          className="icon"
                          onClick={() => removeAlias(entry.id, index)}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button className="small" onClick={() => addAlias(entry.id)}>
                    <Plus size={13} /> הוסף alias
                  </button>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button
                className="secondary"
                onClick={() => {
                  const id = createId("party");
                  setDictionary((current) => [
                    ...current,
                    { id, name: "מפלגה חדשה", aliases: [] },
                  ]);
                }}
              >
                <Plus size={15} /> הוסף מפלגה
              </button>
              <button
                className="primary"
                onClick={() => setDictionaryOpen(false)}
              >
                סיום
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
