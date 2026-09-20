/**
 * Parser für transkribierte Zeitzeugnisse (v. a. Tagebücher): liest Struktur
 * aus dem Text, statt sie zu schätzen. Erschließungsregeln aus dem Prompt für
 * die Ausbaustufe "Automatische Groberschließung", an vier echten Tagebuch-
 * Transkripten verifiziert (siehe test/parser.test.js).
 */

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

// Abkürzungen wie in den echten Transkripten üblich ("4. Jan. 20", "3. Dez. Mi.").
const MONTH_ABBREV = {
  Jan: "Januar", Feb: "Februar", Febr: "Februar", Mär: "März", Marz: "März",
  Apr: "April", Jun: "Juni", Jul: "Juli", Aug: "August",
  Sep: "September", Sept: "September", Okt: "Oktober", Nov: "November", Dez: "Dezember",
};

const MONTH_TO_NUM = Object.fromEntries(MONTH_NAMES.map((m, i) => [m, i + 1]));

const ALL_MONTH_WORDS = [...MONTH_NAMES, ...Object.keys(MONTH_ABBREV)];
// Längste zuerst, damit "Febr" vor "Feb" nicht fälschlich abgeschnitten matcht.
const MONTH_WORDS_SORTED = [...ALL_MONTH_WORDS].sort((a, b) => b.length - a.length);
const MONTH_WORD_PATTERN = MONTH_WORDS_SORTED.join("|");

// Ein Monatsname direkt nach dem Kandidaten -> das war ein Datum, keine Seitenzahl.
const MONTH_FOLLOWS = new RegExp(`^\\s*(${MONTH_WORD_PATTERN})\\.?(?=[\\s,.;]|$)`);

function monthNumberFromWord(word) {
  if (MONTH_TO_NUM[word]) return MONTH_TO_NUM[word];
  const full = MONTH_ABBREV[word];
  return full ? MONTH_TO_NUM[full] : null;
}

// ---------------------------------------------------------------------------
// 1.1 Normalisierung
// ---------------------------------------------------------------------------

const SOFT_HYPHEN = "­";
const BRACKET_SEARCH_WINDOW = 200;

/**
 * Entfernt Editionszeichen für die Analyse, behält aber eine Rückführung
 * jedes normalisierten Zeichens auf seinen Index im Rohtext (map[i] =
 * rawIndex), damit Zitate/Belege aus dem unveränderten Rohtext geschnitten
 * werden können.
 */
export function normalizeWithMap(raw) {
  const text = raw || "";
  const n = text.length;
  let normalized = "";
  const map = [];
  let i = 0;

  while (i < n) {
    const ch = text[i];

    if (ch === SOFT_HYPHEN) {
      i += 1;
      continue;
    }

    if (ch === "[") {
      // Suche die Schließung: nimmt das erste "]" ODER bricht ab, sobald ein
      // weiteres "[" auftaucht, bevor "]" gefunden wurde — das beweist, dass
      // das ursprüngliche "[" nie geschlossen wurde (kommt in echten
      // Transkripten vor, z. B. ein fehlendes "]" vor einem Klammerpaar
      // weiter hinten im Satz). Ohne diese Regel würde ein unausgeglichenes
      // "[" bis zum nächsten — inhaltlich unzusammenhängenden — "]" den
      // gesamten Text dazwischen verschlucken. Zusätzlich begrenzt auf
      // dieselbe Zeile und ein großzügiges Fenster als harte Obergrenze.
      const lineEnd = text.indexOf("\n", i);
      const hardLimit = Math.min(n, i + BRACKET_SEARCH_WINDOW, lineEnd === -1 ? n : lineEnd);
      let j = i + 1;
      while (j < hardLimit && text[j] !== "[" && text[j] !== "]") j += 1;
      if (j >= hardLimit || text[j] !== "]") {
        normalized += ch;
        map.push(i);
        i += 1;
        continue;
      }
      const close = j;
      const inner = text.slice(i + 1, close);

      if (/^\^\d+$/.test(inner)) {
        // Fußnotenanker -> entfernen
        i = close + 1;
        continue;
      }
      if (/^\*{1,3}/.test(inner)) {
        // Korrekturmarke -> entfernen (samt Inhalt)
        i = close + 1;
        continue;
      }
      // Buchstabenergänzung -> Klammern entfernen, Inhalt behalten
      for (let k = i + 1; k < close; k += 1) {
        normalized += text[k];
        map.push(k);
      }
      i = close + 1;
      continue;
    }

    if (/\s/.test(ch)) {
      const start = i;
      while (i < n && /\s/.test(text[i])) i += 1;
      normalized += " ";
      map.push(start);
      continue;
    }

    normalized += ch;
    map.push(i);
    i += 1;
  }

  return { normalized, map };
}

/**
 * Zerlegt den ROHTEXT in Absätze (gleiche Regel wie segmentText.js) — vor der
 * Normalisierung, denn normalizeWithMap kollabiert Whitespace-Läufe
 * (inkl. Absatztrennern) zu je einem Leerzeichen und würde die Struktur sonst
 * zerstören.
 */
function splitRawParagraphs(rawText) {
  return (rawText || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// 1.2 Seitenmarken
// ---------------------------------------------------------------------------

const PAGE_MARK_RE = /^(\d{1,5})[.:]/;
const MAX_JUMP = 25;

/**
 * Absatzinitiale Ganzzahl + "." oder ":" als Seitenmarke, mit Monotonie und
 * Sprungbegrenzung. Tagesangaben ("3. November") sehen identisch aus und
 * werden über den nachfolgenden Monatsnamen ausgeschlossen; die verbleibenden
 * Ausreißer (z. B. rückwärts springende Zahlen aus Transkriptionsfehlern)
 * fallen durch die Monotonie-Prüfung selbst heraus.
 */
export function findPageMarks(paragraphs) {
  const marks = [];
  let letzteSeite = null;

  paragraphs.forEach((p, index) => {
    const m = p.match(PAGE_MARK_RE);
    if (!m) return;
    const rest = p.slice(m[0].length);
    if (MONTH_FOLLOWS.test(rest)) return; // das war ein Datum, keine Seitenzahl

    const wert = Number(m[1]);
    if (letzteSeite === null) {
      marks.push({ paragraphIndex: index, seite: wert });
      letzteSeite = wert;
    } else if (wert > letzteSeite && wert - letzteSeite <= MAX_JUMP) {
      marks.push({ paragraphIndex: index, seite: wert });
      letzteSeite = wert;
    }
  });

  const seiteMin = marks.length ? marks[0].seite : null;
  const seiteMax = marks.length ? marks[marks.length - 1].seite : null;
  const warnungOddOnly = marks.length > 5 && marks.every((mk) => mk.seite % 2 === 1);

  return { marks, seiteMin, seiteMax, warnungOddOnly };
}

// ---------------------------------------------------------------------------
// 1.3 Datumsangaben mit Jahres-Fortschreibung
// ---------------------------------------------------------------------------

const NAMED_DATE_RE = new RegExp(
  `\\b(\\d{1,2})\\.\\s*(${MONTH_WORD_PATTERN})\\.?(?:\\s+(\\d{4}|\\d{2}))?`,
  "g"
);
const NUMERIC_DATE_RE = /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g;

/** Häufigstes vierstelliges Jahr im Dokument als Jahrhundert-Anker. */
export function findCenturyAnchor(text) {
  const years = text.match(/\b(1[5-9]\d{2}|20[0-2]\d)\b/g) || [];
  if (!years.length) return null;
  const counts = new Map();
  for (const y of years) counts.set(y, (counts.get(y) || 0) + 1);
  let best = null;
  let bestCount = -1;
  for (const [y, c] of counts) {
    if (c > bestCount) {
      best = Number(y);
      bestCount = c;
    }
  }
  return best;
}

/** Löst ein zweistelliges Jahr relativ zum Jahrhundert-Anker auf. */
export function resolveTwoDigitYear(twoDigit, anchor) {
  if (anchor == null) return 2000 + twoDigit; // kein Anker: neutrale Annahme
  const century = Math.floor(anchor / 100) * 100;
  let year = century + twoDigit;
  if (year - anchor > 50) year -= 100;
  if (anchor - year > 50) year += 100;
  return year;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Alle Datumsangaben in Lesereihenfolge, mit Jahres-Fortschreibung (Jahr wird
 * nur beim ersten Eintrag/Jahreswechsel genannt) und Jahrhundert-Anker für
 * zweistellige Jahre. Gibt { iso, index (Position im Text) } zurück.
 */
export function extractDatesInOrder(normalizedText) {
  const anchor = findCenturyAnchor(normalizedText);
  const candidates = [];

  let m;
  NAMED_DATE_RE.lastIndex = 0;
  while ((m = NAMED_DATE_RE.exec(normalizedText)) !== null) {
    const day = Number(m[1]);
    const monthNum = monthNumberFromWord(m[2]);
    if (!monthNum || day < 1 || day > 31) continue;
    candidates.push({ index: m.index, day, month: monthNum, yearRaw: m[3] });
  }

  NUMERIC_DATE_RE.lastIndex = 0;
  while ((m = NUMERIC_DATE_RE.exec(normalizedText)) !== null) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) continue;
    candidates.push({ index: m.index, day, month, yearRaw: m[3] });
  }

  candidates.sort((a, b) => a.index - b.index);

  let lastYear = null;
  const results = [];
  for (const c of candidates) {
    let year;
    if (c.yearRaw) {
      year = c.yearRaw.length === 2 ? resolveTwoDigitYear(Number(c.yearRaw), anchor) : Number(c.yearRaw);
    } else if (lastYear != null) {
      year = lastYear;
    } else {
      continue; // kein Jahr bekannt -> Datum nicht auflösbar
    }
    lastYear = year;
    results.push({ index: c.index, iso: `${year}-${pad2(c.month)}-${pad2(c.day)}` });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 1.4 Zeitraum des Bandes
// ---------------------------------------------------------------------------

const BAND_HEADER_RE = new RegExp(
  `(${MONTH_NAMES.join("|")})\\s*(\\d{2,4})\\s*[-–]\\s*(${MONTH_NAMES.join("|")})\\s*(\\d{2,4})`
);

/** Bandüberschrift in den ersten sechs Absätzen (höchste Konfidenz). */
export function findBandUeberschrift(paragraphs, fullText) {
  const head = paragraphs.slice(0, 6).join(" ");
  const m = head.match(BAND_HEADER_RE);
  if (!m) return null;

  const anchor = findCenturyAnchor(fullText);
  const resolveYear = (raw) => (raw.length === 2 ? resolveTwoDigitYear(Number(raw), anchor) : Number(raw));

  const vonMonth = MONTH_TO_NUM[m[1]];
  const vonYear = resolveYear(m[2]);
  const bisMonth = MONTH_TO_NUM[m[3]];
  const bisYear = resolveYear(m[4]);

  return {
    von: `${vonYear}-${pad2(vonMonth)}-01`,
    bis: `${bisYear}-${pad2(bisMonth)}-01`,
  };
}

/**
 * Zeitraum-Ermittlung: 1) Bandüberschrift, sonst 2) erstes/letztes Datum in
 * Lesereihenfolge (NICHT Minimum/Maximum — Tagebücher erwähnen Geburtsjahre
 * und Rückblicke, die die Spanne sonst verfälschen würden).
 */
export function determineZeitraum(paragraphs, normalizedText) {
  const header = findBandUeberschrift(paragraphs, normalizedText);
  if (header) {
    return { von: header.von, bis: header.bis, quelle: "bandueberschrift" };
  }

  const dates = extractDatesInOrder(normalizedText);
  if (!dates.length) return { von: "", bis: "", quelle: "keine" };

  return {
    von: dates[0].iso,
    bis: dates[dates.length - 1].iso,
    quelle: "erstes-letztes-datum",
  };
}

// ---------------------------------------------------------------------------
// Seitenschätzung (Fallback, wenn keine Seitenmarken gefunden wurden)
// ---------------------------------------------------------------------------

export function estimatePages(text) {
  const charsPerPage = 2500;
  return Math.max(1, Math.round((text || "").length / charsPerPage));
}

// ---------------------------------------------------------------------------
// Segmente: jedes Segment bekommt die zuletzt gültige Seite/Datum mit.
// ---------------------------------------------------------------------------

/**
 * Ordnet jedem Absatz die zuletzt gültige Seitenzahl und das zuletzt gültige
 * Datum zu. `normalizedTexts[i]` und `rawParagraphs[i]` gehören 1:1
 * zusammen; `datesInOrder` referenziert Indizes im mit "\n\n" verbundenen
 * normalisierten Volltext (also exakt `normalizedTexts.join("\n\n")`).
 */
function buildSegments(rawParagraphs, normalizedTexts, pageMarks, datesInOrder) {
  const pageByParagraph = new Map(pageMarks.map((mk) => [mk.paragraphIndex, mk.seite]));

  let cursor = 0;
  const offsets = normalizedTexts.map((t) => {
    const start = cursor;
    cursor += t.length + 2; // Länge des "\n\n"-Trenners
    return { start, end: start + t.length };
  });

  const dateForParagraphIndex = new Array(rawParagraphs.length).fill("");
  let di = 0;
  offsets.forEach(({ end }, pi) => {
    let lastInParagraph = "";
    while (di < datesInOrder.length && datesInOrder[di].index < end) {
      lastInParagraph = datesInOrder[di].iso;
      di += 1;
    }
    dateForParagraphIndex[pi] = lastInParagraph;
  });

  let letzteSeite = "";
  let letztesDatum = "";
  const segments = [];

  rawParagraphs.forEach((text, index) => {
    const id = index + 1;
    if (pageByParagraph.has(index)) letzteSeite = pageByParagraph.get(index);
    if (dateForParagraphIndex[index]) letztesDatum = dateForParagraphIndex[index];
    segments.push({ id, text, seite: letzteSeite, datum: letztesDatum });
  });

  return segments;
}

// ---------------------------------------------------------------------------
// Top-Level
// ---------------------------------------------------------------------------

export function parseTranscript(rawText) {
  const raw = rawText || "";
  const rawParagraphs = splitRawParagraphs(raw);
  const normalizedParagraphs = rawParagraphs.map((p) => normalizeWithMap(p));
  const normalizedTexts = normalizedParagraphs.map((p) => p.normalized);
  const normalizedText = normalizedTexts.join("\n\n");

  const { marks, seiteMin, seiteMax, warnungOddOnly } = findPageMarks(normalizedTexts);
  const hasPageMarks = marks.length > 0;

  const seiten = hasPageMarks
    ? { min: seiteMin, max: seiteMax, quelle: "gelesen", warnungOddOnly }
    : { min: null, max: estimatePages(raw), quelle: "geschaetzt", warnungOddOnly: false };

  const zeitraum = determineZeitraum(normalizedTexts, normalizedText);
  const datesInOrder = extractDatesInOrder(normalizedText);
  const segments = buildSegments(rawParagraphs, normalizedTexts, marks, datesInOrder);

  const offeneFragen = [];
  if (hasPageMarks && seiteMin != null && seiteMin > 1) {
    offeneFragen.push("Band setzt einen vorhergehenden fort, Verweis auf weitere Signaturen prüfen.");
  }

  return {
    rawText: raw,
    normalizedText,
    paragraphs: rawParagraphs,
    normalizedParagraphs: normalizedParagraphs.map((p, i) => ({ normalized: p.normalized, map: p.map, raw: rawParagraphs[i] })),
    seiten,
    zeitraum,
    segments,
    offeneFragen,
  };
}
