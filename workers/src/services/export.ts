import { CRITERIA_ORDERED } from "../config/rubric";
import { buildZip } from "../lib/zip";
import * as userRepo from "../repo/user";
import * as analytics from "./analytics";
import { computeJudgeStats, type JudgeStats } from "./judge_stats";

interface ReportData {
  rankings: analytics.LeaderboardEntry[];
  judgeStats: JudgeStats[];
  criterionAverages: { criterion_id: number; criterion_name: string; average_score: number }[];
  criteriaNames: string[];
  generatedAt: string;
}

async function gatherReportData(db: D1Database, eventsDb: D1Database): Promise<ReportData> {
  const { entries } = await analytics.getLeaderboard(db, eventsDb, { page: 1, page_size: 100000 });
  const judges = await userRepo.listReviewers(db);
  return {
    rankings: entries,
    judgeStats: await computeJudgeStats(db, judges),
    criterionAverages: await analytics.getCriterionAverages(db),
    criteriaNames: CRITERIA_ORDERED.map((c) => c.name),
    generatedAt: formatGeneratedAt(new Date()),
  };
}

/** Matches strftime("%Y-%m-%d %H:%M UTC"). */
function formatGeneratedAt(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

const yesNo = (value: boolean) => (value ? "Yes" : "No");
const orBlank = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));
const displayName = (judge: { full_name: string | null; email: string }) => judge.full_name || judge.email;

// ---- CSV ----

/** Python's csv.writer quotes only when needed and terminates rows with CRLF. */
function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(cells: (string | number)[]): string {
  return `${cells.map(csvCell).join(",")}\r\n`;
}

export async function buildCsv(db: D1Database, eventsDb: D1Database): Promise<Uint8Array> {
  const data = await gatherReportData(db, eventsDb);
  let out = "";

  out += csvRow([`Hackathon Evaluation Report - generated ${data.generatedAt}`]);
  out += csvRow([]);

  out += csvRow(["FINAL RANKINGS"]);
  // "Needs Re-review" explains an otherwise inexplicable blank score: the team edited the
  // submission after it was judged, so the reviews were invalidated and it is unscored until
  // they are redone. Without the column an exported ranking looks like missing data.
  out += csvRow([
    "Rank", "Project", "Overall Score", "Std Dev", "Reviews Completed", "Flagged", "Needs Re-review",
  ]);
  for (const e of data.rankings) {
    out += csvRow([
      e.rank,
      e.project_title,
      orBlank(e.overall_score),
      orBlank(e.std_dev),
      e.reviews_completed,
      yesNo(e.is_flagged),
      yesNo(e.needs_reevaluation),
    ]);
  }
  out += csvRow([]);

  out += csvRow(["SUBMISSION CRITERION BREAKDOWN"]);
  out += csvRow(["Project", ...data.criteriaNames]);
  for (const e of data.rankings) {
    out += csvRow([
      e.project_title,
      ...data.criteriaNames.map((name) =>
        Object.prototype.hasOwnProperty.call(e.criterion_scores, name) ? String(e.criterion_scores[name]) : ""
      ),
    ]);
  }
  out += csvRow([]);

  out += csvRow(["JUDGE STATISTICS"]);
  out += csvRow([
    "Judge", "Started", "Completed", "Pending", "Avg Score Given",
    "Std Dev", "Avg Review Time (s)", "Harsh", "Lenient", "High Variance",
  ]);
  for (const s of data.judgeStats) {
    out += csvRow([
      displayName(s.judge),
      s.reviews_started,
      s.reviews_completed,
      s.reviews_pending,
      orBlank(s.average_score_given),
      orBlank(s.std_dev_given),
      orBlank(s.average_review_time_seconds),
      yesNo(s.is_harsh),
      yesNo(s.is_lenient),
      yesNo(s.is_high_variance),
    ]);
  }
  out += csvRow([]);

  out += csvRow(["CRITERION AVERAGES"]);
  out += csvRow(["Criterion", "Average Score"]);
  for (const c of data.criterionAverages) {
    out += csvRow([c.criterion_name, c.average_score]);
  }

  // utf-8-sig: the BOM is what makes Excel open the file as UTF-8.
  const body = new TextEncoder().encode(out);
  const withBom = new Uint8Array(body.length + 3);
  withBom.set([0xef, 0xbb, 0xbf], 0);
  withBom.set(body, 3);
  return withBom;
}

// ---- XLSX ----

const xmlEscape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Cell = string | number | null;

function sheetXml(rows: Cell[][], boldFirstRow: boolean): string {
  const body = rows
    .map((cells, rowIndex) => {
      const cellXml = cells
        .map((value, colIndex) => {
          if (value === null || value === "") return "";
          const ref = `${columnName(colIndex)}${rowIndex + 1}`;
          const style = boldFirstRow && rowIndex === 0 ? ' s="1"' : "";
          if (typeof value === "number") return `<c r="${ref}"${style}><v>${value}</v></c>`;
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cellXml}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function columnName(index: number): string {
  let name = "";
  let n = index;
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

export async function buildXlsx(db: D1Database, eventsDb: D1Database): Promise<Uint8Array> {
  const data = await gatherReportData(db, eventsDb);

  const sheets: { name: string; rows: Cell[][] }[] = [
    {
      name: "Rankings",
      rows: [
        ["Rank", "Project", "Overall Score", "Std Dev", "Reviews Completed", "Flagged", "Needs Re-review"],
        ...data.rankings.map((e) => [
          e.rank, e.project_title, e.overall_score,
          e.std_dev, e.reviews_completed, yesNo(e.is_flagged), yesNo(e.needs_reevaluation),
        ] as Cell[]),
      ],
    },
    {
      name: "Submission Statistics",
      rows: [
        ["Project", ...data.criteriaNames],
        ...data.rankings.map((e) => [
          e.project_title,
          ...data.criteriaNames.map((n) => (Object.prototype.hasOwnProperty.call(e.criterion_scores, n) ? e.criterion_scores[n]! : null)),
        ] as Cell[]),
      ],
    },
    {
      name: "Judge Statistics",
      rows: [
        ["Judge", "Started", "Completed", "Pending", "Avg Score Given", "Std Dev", "Avg Review Time (s)", "Harsh", "Lenient", "High Variance"],
        ...data.judgeStats.map((s) => [
          displayName(s.judge), s.reviews_started, s.reviews_completed, s.reviews_pending,
          s.average_score_given, s.std_dev_given, s.average_review_time_seconds,
          yesNo(s.is_harsh), yesNo(s.is_lenient), yesNo(s.is_high_variance),
        ] as Cell[]),
      ],
    },
    {
      name: "Criterion Breakdown",
      rows: [
        ["Criterion", "Average Score"],
        ...data.criterionAverages.map((c) => [c.criterion_name, c.average_score] as Cell[]),
      ],
    },
  ];

  const sheetEntries = sheets.map((s, i) => ({
    name: `xl/worksheets/sheet${i + 1}.xml`,
    content: sheetXml(s.rows, true),
  }));

  const workbookSheets = sheets
    .map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("");
  const workbookRels = sheets
    .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
    .join("");
  const overrides = sheets
    .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join("");

  return buildZip([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
    },
    ...sheetEntries,
  ]);
}

// ---- PDF ----

const pdfEscape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/**
 * A landscape-letter PDF built directly, replacing reportlab. The content matches the
 * original report; the visual layout is a simpler fixed-column grid rather than
 * reportlab's Table flowables.
 */
export async function buildPdf(db: D1Database, eventsDb: D1Database): Promise<Uint8Array> {
  const data = await gatherReportData(db, eventsDb);
  const pageWidth = 792;
  const pageHeight = 612;
  const margin = 36;
  const lineHeight = 13;

  const pages: string[][] = [];
  let current: string[] = [];
  let y = pageHeight - margin;

  const newPage = () => {
    if (current.length) pages.push(current);
    current = [];
    y = pageHeight - margin;
  };
  const write = (text: string, x: number, size: number, bold: boolean) => {
    current.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${pdfEscape(text)}) Tj ET`
    );
  };
  const advance = (amount = lineHeight) => {
    y -= amount;
    if (y < margin + lineHeight) newPage();
  };

  write("Hackathon Evaluation Report", margin, 16, true);
  advance(22);
  write(data.generatedAt, margin, 9, false);
  advance(20);

  const table = (title: string, header: string[], rows: string[][], widths: number[]) => {
    write(title, margin, 12, true);
    advance(16);
    let x = margin;
    header.forEach((h, i) => {
      write(h, x, 8, true);
      x += widths[i]!;
    });
    advance();
    for (const row of rows) {
      x = margin;
      row.forEach((cell, i) => {
        const limit = Math.max(Math.floor(widths[i]! / 4.6), 4);
        write(cell.length > limit ? `${cell.slice(0, limit - 1)}…` : cell, x, 8, false);
        x += widths[i]!;
      });
      advance();
    }
    advance(10);
  };

  table(
    "Final Rankings",
    ["Rank", "Project", "Overall", "Std Dev", "Reviews", "Flagged", "Re-review"],
    data.rankings.map((e) => [
      String(e.rank),
      e.project_title,
      e.overall_score === null ? "-" : e.overall_score.toFixed(2),
      e.std_dev === null ? "-" : e.std_dev.toFixed(2),
      String(e.reviews_completed),
      yesNo(e.is_flagged),
      yesNo(e.needs_reevaluation),
    ]),
    [40, 210, 65, 65, 55, 55, 65]
  );

  table(
    "Judge Statistics",
    ["Judge", "Started", "Completed", "Avg Score", "Std Dev", "Flags"],
    data.judgeStats.map((s) => [
      displayName(s.judge),
      String(s.reviews_started),
      String(s.reviews_completed),
      s.average_score_given === null ? "-" : s.average_score_given.toFixed(2),
      s.std_dev_given === null ? "-" : s.std_dev_given.toFixed(2),
      [s.is_harsh && "Harsh", s.is_lenient && "Lenient", s.is_high_variance && "High Variance"]
        .filter(Boolean)
        .join(", ") || "-",
    ]),
    [200, 70, 70, 70, 70, 180]
  );

  table(
    "Criterion Breakdown",
    ["Criterion", "Average Score"],
    data.criterionAverages.map((c) => [c.criterion_name, c.average_score.toFixed(2)]),
    [300, 120]
  );

  newPage();

  const encoder = new TextEncoder();
  const objects: string[] = [];
  const pageObjectIds = pages.map((_, i) => 4 + i * 2);

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  const boldFontId = 3 + pages.length * 2 + 1;

  pages.forEach((content, i) => {
    const pageId = pageObjectIds[i]!;
    const streamId = pageId + 1;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${streamId} 0 R >>`;
    const stream = content.join("\n");
    objects[streamId] = `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`;
  });
  objects[boldFontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i += 1) {
    if (!objects[i]) continue;
    offsets[i] = encoder.encode(pdf).length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = encoder.encode(pdf).length;
  const maxId = objects.length;
  pdf += `xref\n0 ${maxId}\n0000000000 65535 f \n`;
  for (let i = 1; i < maxId; i += 1) {
    pdf += `${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxId} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return encoder.encode(pdf);
}
