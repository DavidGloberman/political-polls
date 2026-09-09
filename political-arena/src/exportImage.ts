import type { PollTable } from "./types";
import { displayPartyName, validateTable } from "./utils";

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const text = (
  value: string,
  x: number,
  y: number,
  size: number,
  weight = 700,
  anchor = "middle",
) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial, DejaVu Sans, sans-serif" font-size="${size}px" font-weight="${weight}" fill="#f5f8ff">${esc(value)}</text>`;

export async function downloadTableAsPng(table: PollTable) {
  const validation = validateTable(table);
  if (!validation.every((v) => v.valid)) {
    throw new Error("אי אפשר ליצור תמונה לפני שכל הסקרים מסתכמים ל־120.");
  }

  const width = Math.max(1500, 460 + table.polls.length * 155);
  const rowHeight = 66;
  const headerHeight = 96;
  const titleHeight = 190;
  const footerHeight = 70;
  const height =
    titleHeight +
    headerHeight +
    table.parties.length * rowHeight +
    rowHeight +
    footerHeight;
  const margin = 48;
  const partyWidth = 250;
  const tableWidth = width - margin * 2;
  const pollWidth =
    (tableWidth - partyWidth) / Math.max(table.polls.length, 1);
  const tableX = margin;
  const tableY = titleHeight;

  const defs = `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#071022"/>
        <stop offset="55%" stop-color="#111b3c"/>
        <stop offset="100%" stop-color="#071022"/>
      </linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#6759ff"/>
        <stop offset="100%" stop-color="#43d2e8"/>
      </linearGradient>
      <linearGradient id="header" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#263a78"/>
        <stop offset="100%" stop-color="#4a3e9a"/>
      </linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="12" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>`;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${defs}
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <circle cx="${width - 90}" cy="70" r="180" fill="#6759ff" opacity=".08" filter="url(#glow)"/>
    <circle cx="80" cy="${height - 100}" r="170" fill="#43d2e8" opacity=".06" filter="url(#glow)"/>
    ${text("זירה פוליטית", width / 2, 68, 25, 800)}
    ${text(table.title || "סיכום סקרי השבוע", width / 2, 125, 46, 900)}
    ${text("סיכום סקרי מנדטים", width / 2, 160, 19, 500)}
    <rect x="${width / 2 - 100}" y="178" width="200" height="4" rx="2" fill="url(#accent)"/>
    <g opacity=".12">${text("זירה פוליטית", width / 2, height / 2 + 80, 110, 900)}</g>
  `;

  const partyX = tableX + tableWidth - partyWidth;
  svg += `<rect x="${partyX}" y="${tableY}" width="${partyWidth}" height="${headerHeight}" rx="10" fill="url(#header)"/>`;
  svg += text("מפלגה", partyX + partyWidth / 2, tableY + 59, 23, 900);

  table.polls.forEach((poll, index) => {
    const x = partyX - (index + 1) * pollWidth;
    svg += `<rect x="${x}" y="${tableY}" width="${pollWidth}" height="${headerHeight}" rx="10" fill="url(#header)"/>`;
    svg += text(poll.source, x + pollWidth / 2, tableY + 55, 20, 800);
  });

  table.parties.forEach((party, rowIndex) => {
    const y = tableY + headerHeight + rowIndex * rowHeight;
    const fill = rowIndex % 2 === 0 ? "#0d1d38" : "#102442";
    svg += `<rect x="${partyX}" y="${y}" width="${partyWidth}" height="${rowHeight}" fill="${fill}"/>`;
    svg += text(displayPartyName(party.name), partyX + partyWidth / 2, y + 42, 20, 800);
    table.polls.forEach((poll, index) => {
      const x = partyX - (index + 1) * pollWidth;
      svg += `<rect x="${x}" y="${y}" width="${pollWidth}" height="${rowHeight}" fill="${fill}"/>`;
      const value = party.values[poll.id];
      svg += text(value == null ? "--" : String(value), x + pollWidth / 2, y + 42, 24, 900);
    });
  });

  const totalY = tableY + headerHeight + table.parties.length * rowHeight;
  svg += `<rect x="${partyX}" y="${totalY}" width="${partyWidth}" height="${rowHeight}" fill="#19345d"/>`;
  svg += text("סה״כ", partyX + partyWidth / 2, totalY + 42, 21, 900);
  validation.forEach((result, index) => {
    const x = partyX - (index + 1) * pollWidth;
    svg += `<rect x="${x}" y="${totalY}" width="${pollWidth}" height="${rowHeight}" fill="#19345d"/>`;
    svg += text(String(result.total), x + pollWidth / 2, totalY + 42, 22, 900);
  });

  const fullTableHeight = headerHeight + (table.parties.length + 1) * rowHeight;
  svg += `<rect x="${tableX}" y="${tableY}" width="${tableWidth}" height="${fullTableHeight}" rx="12" fill="none" stroke="#3b5683" stroke-width="2"/>`;
  for (let i = 1; i < table.polls.length + 1; i++) {
    const x = partyX - i * pollWidth;
    svg += `<line x1="${x}" y1="${tableY}" x2="${x}" y2="${tableY + fullTableHeight}" stroke="#29466f" stroke-width="1"/>`;
  }
  svg += `<line x1="${partyX}" y1="${tableY}" x2="${partyX}" y2="${tableY + fullTableHeight}" stroke="#29466f" stroke-width="1"/>`;
  for (let i = 0; i <= table.parties.length + 1; i++) {
    const y = tableY + headerHeight + i * rowHeight;
    svg += `<line x1="${tableX}" y1="${y}" x2="${tableX + tableWidth}" y2="${y}" stroke="#29466f" stroke-width="1"/>`;
  }

  svg += text("נתונים. תמונה גדולה יותר.", margin, height - 27, 14, 500, "start");
  svg += text("זירה פוליטית", width - margin, height - 27, 14, 700, "end");
  svg += `</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("יצירת התמונה נכשלה."));
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("הדפדפן לא הצליח ליצור תמונה.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("שמירת PNG נכשלה.")),
        "image/png",
      ),
    );
    const downloadUrl = URL.createObjectURL(png);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "political-arena-summary.png";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
