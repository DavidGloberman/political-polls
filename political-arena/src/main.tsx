import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Check,
  GripVertical,
  ImageDown,
  LoaderCircle,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import "./styles.css";
import type { PollTable } from "./types";
import { clearTable, loadTable, saveTable } from "./storage";
import {
  allValid,
  createId,
  mergePolls,
  sortPartiesByFirstPoll,
  validateTable,
} from "./utils";
import { parseWithOpenAI } from "./parser";
import { sampleText } from "./sample";

const API_KEY_STORAGE = "political-arena-openai-key";
const MODEL_STORAGE = "political-arena-model";

async function createTableImage(table: PollTable): Promise<void> {
  const width = 1500;
  const rowHeight = 58;
  const headerHeight = 92;
  const titleHeight = 105;
  const footerHeight = 55;
  const nameWidth = 330;
  const pollWidth = Math.max(150, Math.floor((width - nameWidth - 80) / Math.max(table.polls.length, 1)));
  const actualWidth = nameWidth + pollWidth * table.polls.length + 80;
  const height = titleHeight + headerHeight + rowHeight * table.parties.length + rowHeight + footerHeight;
  const esc = (value: string | number) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  const xRight = actualWidth - 40;
  const tableRight = actualWidth - 40;
  const partyX = tableRight - nameWidth;
  const font = "Arial, sans-serif";
  const svgRows: string[] = [];

  svgRows.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
  svgRows.push(`<rect x="0" y="0" width="100%" height="${titleHeight}" fill="#111827"/>`);
  svgRows.push(`<text x="${xRight}" y="43" text-anchor="end" direction="rtl" unicode-bidi="plaintext" font-family="${font}" font-size="30" font-weight="700" fill="#ffffff">${esc(table.title)}</text>`);
  svgRows.push(`<text x="${xRight}" y="75" text-anchor="end" direction="rtl" unicode-bidi="plaintext" font-family="${font}" font-size="17" fill="#d1d5db">סיכום סקרי מנדטים</text>`);

  const tableTop = titleHeight;
  svgRows.push(`<rect x="40" y="${tableTop}" width="${actualWidth - 80}" height="${headerHeight}" fill="#f3f4f6"/>`);
  svgRows.push(`<text x="${partyX + nameWidth / 2}" y="${tableTop + 56}" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" font-family="${font}" font-size="19" font-weight="700" fill="#111827">מפלגה</text>`);

  table.polls.forEach((poll, index) => {
    const center = tableRight - nameWidth - pollWidth * index - pollWidth / 2;
    svgRows.push(`<text x="${center}" y="${tableTop + 56}" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" font-family="${font}" font-size="18" font-weight="700" fill="#111827">${esc(poll.source)}</text>`);
  });

  table.parties.forEach((party, rowIndex) => {
    const y = tableTop + headerHeight + rowHeight * rowIndex;
    svgRows.push(`<rect x="40" y="${y}" width="${actualWidth - 80}" height="${rowHeight}" fill="${rowIndex % 2 === 0 ? "#ffffff" : "#f9fafb"}"/>`);
    svgRows.push(`<line x1="40" y1="${y + rowHeight}" x2="${actualWidth - 40}" y2="${y + rowHeight}" stroke="#e5e7eb"/>`);
    svgRows.push(`<text x="${partyX + nameWidth - 24}" y="${y + 37}" text-anchor="end" direction="rtl" unicode-bidi="plaintext" font-family="${font}" font-size="18" font-weight="600" fill="#111827">${esc(party.name)}</text>`);
    table.polls.forEach((poll, index) => {
      const center = tableRight - nameWidth - pollWidth * index - pollWidth / 2;
      const value = party.values[poll.id];
      svgRows.push(`<text x="${center}" y="${y + 37}" text-anchor="middle" font-family="${font}" font-size="20" font-weight="700" fill="#111827">${value == null ? "—" : esc(value)}</text>`);
    });
  });

  const totalY = tableTop + headerHeight + rowHeight * table.parties.length;
  svgRows.push(`<rect x="40" y="${totalY}" width="${actualWidth - 80}" height="${rowHeight}" fill="#eef2ff"/>`);
  svgRows.push(`<text x="${partyX + nameWidth - 24}" y="${totalY + 37}" text-anchor="end" direction="rtl" unicode-bidi="plaintext" font-family="${font}" font-size="18" font-weight="700" fill="#111827">סה״כ</text>`);
  const totals = validateTable(table);
  table.polls.forEach((poll, index) => {
    const center = tableRight - nameWidth - pollWidth * index - pollWidth / 2;
    const result = totals.find((item) => item.pollId === poll.id);
    svgRows.push(`<text x="${center}" y="${totalY + 37}" text-anchor="middle" font-family="${font}" font-size="20" font-weight="700" fill="#111827">${result?.total ?? 0}</text>`);
  });
  svgRows.push(`<text x="${xRight}" y="${height - 19}" text-anchor="end" direction="rtl" unicode-bidi="plaintext" font-family="${font}" font-size="14" fill="#6b7280">זירה פוליטית</text>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${actualWidth}" height="${height}" viewBox="0 0 ${actualWidth} ${height}">${svgRows.join("")}</svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("לא ניתן ליצור את התמונה."));
      image.src = url;
    });

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = actualWidth * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("לא ניתן ליצור את התמונה.");
    context.scale(scale, scale);
    context.drawImage(image, 0, 0);

    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new Error("לא ניתן לייצא את התמונה.");

    const downloadUrl = URL.createObjectURL(png);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "political-arena-polls.png";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function App() {
  const [table, setTable] = useState<PollTable | null>(() => loadTable());
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) || "");
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_STORAGE) || "gpt-5-mini");
  const [draggedPartyId, setDraggedPartyId] = useState<string | null>(null);
  const [draggedPollId, setDraggedPollId] = useState<string | null>(null);

  useEffect(() => saveTable(table), [table]);

  const validationResults = useMemo(() => (table ? validateTable(table) : []), [table]);
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
      const parsedPolls = await parseWithOpenAI(text, apiKey, model);
      if (!parsedPolls.length) throw new Error("לא נמצאו סקרים בטקסט.");
      setTable((current) => current ? mergePolls(current, parsedPolls) : sortPartiesByFirstPoll(mergePolls(null, parsedPolls)));
      setText("");
      setMessage(`נוספו ${parsedPolls.length} סקרים בהצלחה.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "אירעה שגיאה בפרסור.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateImage() {
    if (!table || !ready || imageBusy) return;
    setImageBusy(true);
    setMessage(null);
    try {
      await createTableImage(table);
      setMessage("התמונה נוצרה והורדה התחילה.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "אירעה שגיאה ביצירת התמונה.");
    } finally {
      setImageBusy(false);
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

  const updateCell = (partyId: string, pollId: string, value: string) => {
    const numericValue = value.trim() === "" ? null : Number(value);
    if (numericValue !== null && (!Number.isInteger(numericValue) || numericValue < 0)) return;
    updateTable((current) => ({
      ...current,
      parties: current.parties.map((party) => party.id === partyId ? { ...party, values: { ...party.values, [pollId]: numericValue } } : party),
    }));
  };

  const reorderItems = (type: "party" | "poll", targetId: string) => {
    const sourceId = type === "party" ? draggedPartyId : draggedPollId;
    if (!sourceId || sourceId === targetId) return;
    updateTable((current) => {
      if (type === "party") {
        const parties = [...current.parties];
        const sourceIndex = parties.findIndex((party) => party.id === sourceId);
        const targetIndex = parties.findIndex((party) => party.id === targetId);
        if (sourceIndex < 0 || targetIndex < 0) return current;
        const [movedParty] = parties.splice(sourceIndex, 1);
        parties.splice(targetIndex, 0, movedParty);
        return { ...current, parties };
      }
      const polls = [...current.polls];
      const sourceIndex = polls.findIndex((poll) => poll.id === sourceId);
      const targetIndex = polls.findIndex((poll) => poll.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const [movedPoll] = polls.splice(sourceIndex, 1);
      polls.splice(targetIndex, 0, movedPoll);
      return { ...current, polls };
    });
    if (type === "party") setDraggedPartyId(null); else setDraggedPollId(null);
  };

  return (
    <div className="app">
      <header>
        <div className="brand"><div className="logo">🏛</div><div><b>זירה פוליטית</b><small>סיכום סקרי מנדטים</small></div></div>
        <div className="top-actions">
          {table && <button className="ghost" onClick={startNewSummary}><RotateCcw size={16} /> התחל מחדש</button>}
          <button className="ghost" onClick={() => setSettingsOpen(true)}><Settings size={16} /> הגדרות AI</button>
        </div>
      </header>

      {!table ? (
        <main className="landing">
          <div className="hero">
            <span className="eyebrow"><Sparkles size={15} /> כלי מהיר לסיכום סקרים</span>
            <h1>הדבק את הסקרים שלך.<br /><span>אנחנו נסדר את השאר.</span></h1>
            <p>הדבק סקר אחד או כמה סקרים, פרסר אותם, תקן רק אם צריך וקבל טבלת סיכום מוכנה לשיתוף.</p>
            <div className="paste">
              <div className="paste-head"><div><b>טקסט הסקרים</b><small>אפשר להדביק כמה סקרים יחד</small></div><button className="small" onClick={() => setText(sampleText)}>טען דוגמה</button></div>
              <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={"מעריב:\nישר! 23\nהליכוד 20\nביחד 15\n...\n\nחדשות 12:\nישר 24\nהליכוד 23\n..."} />
              <div className="paste-foot"><span>{text ? `${text.length.toLocaleString("he-IL")} תווים` : "הדבק כאן את הטקסט שהתקבל"}</span><button className="primary" disabled={busy || !text.trim()} onClick={parsePolls}>{busy ? <><LoaderCircle className="spin" size={17} /> מפרסר...</> : <><Sparkles size={17} /> פרסר סקרים</>}</button></div>
            </div>
            {message && <div className="message bad"><X size={17} /> {message}</div>}
            <div className="steps"><span><b>01</b> מדביקים</span><span><b>02</b> AI מפרסר</span><span><b>03</b> עורכים</span><span><b>04</b> מורידים</span></div>
          </div>
        </main>
      ) : (
        <main className="work">
          <div className="work-head">
            <div><span className="eyebrow">טבלת סיכום</span><h1>עריכה וסידור</h1><p>הכול ניתן לעריכה. גרור את הידית כדי לשנות סדר.</p></div>
            <div className="actions">
              <button className="secondary" onClick={() => setText("")}><Plus size={17} /> הוסף סקר</button>
              <button className="primary" disabled={!ready || imageBusy} onClick={handleCreateImage} title={!ready ? "כל הסקרים צריכים להסתכם ל־120" : ""}>{imageBusy ? <><LoaderCircle className="spin" size={17} /> יוצר תמונה...</> : <><ImageDown size={17} /> צור תמונה</>}</button>
            </div>
          </div>

          <div className={`status ${ready ? "ok" : "bad"}`}>{ready ? <Check size={16} /> : <X size={16} />}{ready ? "כל הסקרים תקינים — 120" : "יש סקרים שדורשים תיקון"}</div>
          {!ready && <div className="warning"><strong>לפני יצירת התמונה צריך להשלים את הסקרים</strong><div>{validationResults.filter((result) => !result.valid).map((result) => <span key={result.pollId}>{result.source}: {result.total} {result.total < 120 ? `(חסרים ${120 - result.total})` : `(עודפים ${result.total - 120})`}</span>)}</div></div>}

          <section className="editor">
            <div className="title"><input value={table.title} onChange={(event) => updateTable((current) => ({ ...current, title: event.target.value }))} /><span><Save size={13} /> נשמר אוטומטית</span></div>
            <div className="scroll"><table><thead><tr><th>מפלגה</th>{table.polls.map((poll) => <th key={poll.id} draggable onDragStart={() => setDraggedPollId(poll.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderItems("poll", poll.id)}><div className="head-cell"><GripVertical size={15} /><input value={poll.source} onChange={(event) => updateTable((current) => ({ ...current, polls: current.polls.map((currentPoll) => currentPoll.id === poll.id ? { ...currentPoll, source: event.target.value } : currentPoll) }))} /><button className="icon danger" onClick={() => updateTable((current) => ({ ...current, polls: current.polls.filter((currentPoll) => currentPoll.id !== poll.id), parties: current.parties.map((party) => { const values = { ...party.values }; delete values[poll.id]; return { ...party, values }; }) }))}><Trash2 size={13} /></button></div></th>)}</tr></thead>
              <tbody>{table.parties.map((party) => <tr key={party.id} draggable onDragStart={() => setDraggedPartyId(party.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderItems("party", party.id)}><td><div className="party"><GripVertical size={16} /><input value={party.name} onChange={(event) => updateTable((current) => ({ ...current, parties: current.parties.map((currentParty) => currentParty.id === party.id ? { ...currentParty, name: event.target.value } : currentParty) }))} /><button className="icon danger" onClick={() => updateTable((current) => ({ ...current, parties: current.parties.filter((currentParty) => currentParty.id !== party.id) }))}><Trash2 size={13} /></button></div></td>{table.polls.map((poll) => <td key={poll.id}><input className="num" value={party.values[poll.id] ?? ""} placeholder="--" onChange={(event) => updateCell(party.id, poll.id, event.target.value)} /></td>)}</tr>)}
                <tr className="total"><td>סה״כ</td>{validationResults.map((result) => <td key={result.pollId} className={result.valid ? "good" : "wrong"}>{result.total}{result.valid && <Check size={14} />}</td>)}</tr></tbody>
            </table></div>
            <div className="editor-foot"><button className="secondary" onClick={() => updateTable((current) => ({ ...current, parties: [...current.parties, { id: createId("party"), name: "מפלגה חדשה", values: Object.fromEntries(current.polls.map((poll) => [poll.id, null])) }] }))}><Plus size={16} /> הוסף מפלגה</button><span><GripVertical size={14} /> גרור שורות ועמודות לשינוי הסדר</span></div>
          </section>

          <section className="add"><div><Plus size={19} /><div><b>רוצה להוסיף עוד סקר?</b><small>הדבק אותו כאן והמערכת תפרסר רק אותו ותוסיף לטבלה.</small></div></div><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="הדבק כאן את הסקר החדש..." /><button className="primary" disabled={busy || !text.trim()} onClick={parsePolls}>{busy ? <><LoaderCircle className="spin" /> מפרסר...</> : <><Plus /> הוסף סקר</>}</button></section>
          {message && <div className="message info"><Check size={17} /> {message}</div>}
        </main>
      )}

      {settingsOpen && <div className="backdrop" onMouseDown={() => setSettingsOpen(false)}><div className="modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><b><Settings size={18} /> הגדרות AI</b><button className="icon" onClick={() => setSettingsOpen(false)}><X /></button></div><p>המפתח נשמר מקומית בדפדפן ונשלח ישירות לשירות ה-AI.</p><label>OpenAI API Key</label><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-..." /><label>Model</label><input value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-5-mini" /><div className="modal-actions"><button className="secondary" onClick={() => { setApiKey(""); localStorage.removeItem(API_KEY_STORAGE); }}>נקה מפתח</button><button className="primary" onClick={() => { localStorage.setItem(API_KEY_STORAGE, apiKey); localStorage.setItem(MODEL_STORAGE, model); setSettingsOpen(false); setMessage("הגדרות נשמרו."); }}>שמור</button></div></div></div>}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
