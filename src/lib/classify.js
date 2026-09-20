import { normalizeWithMap, extractDatesInOrder } from "./parser.js";

const CONTEXT_RADIUS = 60;
const MAX_BELEGE_PER_THEMA = 3;

/**
 * Themen-Klassifikation mit Beleg: ein Thema gilt erst als getroffen, wenn
 * mindestens `mindestTreffer` verschiedene Schlagwörter vorkommen (sonst
 * erzeugen Einzeltreffer zu viele Haken zum Wegklicken). Jeder Treffer liefert
 * bis zu drei Belege { segmentId, seite, zitat } mit ±60 Zeichen Kontext aus
 * dem ROHTEXT des Segments (Zitate müssen belegbar bleiben, auch wenn der
 * Treffer selbst über den normalisierten Text gefunden wurde — z. B. wenn ein
 * Schlagwort durch eine Buchstabenergänzung wie "wa[r]ren" unterbrochen ist).
 */
export function classifyThemen(parsed, themenConfig) {
  const { mindestTreffer, themen } = themenConfig;

  const segCache = parsed.segments.map((seg) => {
    const { normalized, map } = normalizeWithMap(seg.text);
    return { seg, lower: normalized.toLowerCase(), map };
  });

  const result = {};
  for (const [thema, keywords] of Object.entries(themen)) {
    const keywordHits = new Map(); // keyword -> beleg[]

    for (const { seg, lower, map } of segCache) {
      for (const kw of keywords) {
        const kwLower = kw.toLowerCase();
        const idx = lower.indexOf(kwLower);
        if (idx === -1) continue;

        const rawStart = map[idx] ?? 0;
        const lastCharIdx = Math.min(idx + kwLower.length - 1, map.length - 1);
        const rawEnd = (map[lastCharIdx] ?? rawStart) + 1;
        const ctxStart = Math.max(0, rawStart - CONTEXT_RADIUS);
        const ctxEnd = Math.min(seg.text.length, rawEnd + CONTEXT_RADIUS);
        const zitat = seg.text.slice(ctxStart, ctxEnd).trim();

        if (!keywordHits.has(kw)) keywordHits.set(kw, []);
        keywordHits.get(kw).push({ segmentId: seg.id, seite: seg.seite, zitat });
      }
    }

    if (keywordHits.size >= mindestTreffer) {
      const belege = [...keywordHits.values()].flat().slice(0, MAX_BELEGE_PER_THEMA);
      const konfidenz = Math.min(1, keywordHits.size / (mindestTreffer * 2));
      result[thema] = { konfidenz, belege };
    }
  }
  return result;
}

/**
 * Zeitliche Einordnung wird NICHT über Schlagwörter bestimmt, sondern
 * deterministisch aus dem Datumsbereich des Bandes gegen die Epochentabelle.
 * Überlappungen sind gewollt (z. B. "Erster Weltkrieg" und "Kaiserreich").
 */
export function classifyZeitlich(zeitraum, zeitlicheEinordnungJahre) {
  const result = {};
  const vonYear = zeitraum.von ? Number(zeitraum.von.slice(0, 4)) : null;
  const bisYear = zeitraum.bis ? Number(zeitraum.bis.slice(0, 4)) : null;
  if (vonYear == null && bisYear == null) return result;

  const lo = vonYear ?? bisYear;
  const hi = bisYear ?? vonYear;

  for (const epoch of zeitlicheEinordnungJahre) {
    const epochVon = epoch.von ?? -Infinity;
    const epochBis = epoch.bis ?? Infinity;
    if (lo <= epochBis && hi >= epochVon) {
      result[epoch.label] = { konfidenz: 1, belege: [] };
    }
  }
  return result;
}

const DATE = "\\d{1,2}\\.\\d{1,2}\\.\\d{2,4}";
// Nicht-gierig und ohne Zeilenumbruch, damit der Ortsname nicht über die
// nächste Zeile/Anrede hinaus "weiterfrisst".
const ORT = "[A-ZÄÖÜ][^\\n,.;]{0,40}?";

const SALUTATION_STOPWORDS = new Set([
  "liebe", "lieber", "liebste", "liebster", "werte", "werter", "sehr", "geehrte",
  "geehrter", "mein", "meine", "hallo", "guten",
]);

/**
 * Sucht im Kopfbereich (erste ~800 Zeichen) nach "geb./geboren am TT.MM.JJJJ
 * [in ORT]" und "gest./gestorben am TT.MM.JJJJ [in ORT]" sowie einem
 * nahegelegenen Zwei-Wörter-Namenskandidaten (Vorname Nachname) davor.
 * Typisch für Erschließungsbögen-Kopfzeilen bei Briefen/Erinnerungstexten.
 */
export function extractHeaderInfo(text) {
  const header = (text || "").slice(0, 800);
  const empty = { geburtsdatum: "", geburtsort: "", sterbedatum: "", sterbeort: "", name: { vorname: "", nachname: "" } };

  const geburt = header.match(new RegExp(`(?:[Gg]eb\\.?|[Gg]eboren(?:\\s+am)?)\\s*:?\\s*(${DATE})(?:\\s+in\\s+(${ORT}))?(?=[,.;\\n]|$)`));
  const tod = header.match(
    new RegExp(`(?:[Gg]est\\.?|[Gg]estorben(?:\\s+am)?|[Vv]erstorben(?:\\s+am)?|†)\\s*:?\\s*(${DATE})(?:\\s+in\\s+(${ORT}))?(?=[,.;\\n]|$)`)
  );

  if (!geburt && !tod) return empty;

  const anchor = geburt ? geburt[0] : tod[0];
  const beforeText = header.slice(0, header.indexOf(anchor));
  const nameMatches = [...beforeText.matchAll(/([A-ZÄÖÜ][a-zäöüß]+)\s+([A-ZÄÖÜ][a-zäöüß]+)/g)].reverse();
  const validMatch = nameMatches.find((m) => !SALUTATION_STOPWORDS.has(m[1].toLowerCase()));
  const name = validMatch ? { vorname: validMatch[1], nachname: validMatch[2] } : { vorname: "", nachname: "" };

  return {
    geburtsdatum: geburt?.[1] || "",
    geburtsort: (geburt?.[2] || "").trim(),
    sterbedatum: tod?.[1] || "",
    sterbeort: (tod?.[2] || "").trim(),
    name,
  };
}

const SIGNATURE_STOPWORDS = new Set([
  "vater", "mutter", "sohn", "tochter", "bruder", "schwester", "onkel", "tante",
  "opa", "oma", "großvater", "großmutter", "freund", "freundin", "mann", "frau",
  "familie", "wir", "ich", "dein", "deine", "euer", "eure",
]);

/**
 * Grobe Signatur-Heuristik für Briefe ohne Kopfbereich: sucht nahe am
 * Textende nach typischen Briefschluss-Formeln ("Dein Kurt", "gez. Grete
 * Müller", …) und schlägt daraus einen möglichen Autorennamen vor.
 */
export function guessAuthorName(text) {
  const NAME = "[A-ZÄÖÜ][a-zäöüß]+";
  // Erlaubt einen optionalen Punkt/Ausrufezeichen nach dem Namen ("Dein Erik.")
  // und geschütztes Leerzeichen (docx-Export nutzt häufig  ) als Whitespace.
  // Fängt bis zu drei Wörter als eine Gruppe, damit auch ein Beziehungswort
  // zwischen Auslöser und Name Platz hat ("Dein Sohn Erik").
  const pattern = new RegExp(
    `(?:Dein|Deine|Euer|Eure|Herzlichst|Hochachtungsvoll|Mit freundlichen Grüßen|gez\\.?)[,:]?[ \\t\\u00A0]*\\n?[ \\t\\u00A0]*((?:${NAME}[ \\t\\u00A0]+){0,2}${NAME})[ \\t\\u00A0]*[.!]?[ \\t\\u00A0]*$`,
    "gm"
  );

  // Nicht nur den letzten Treffer im gesamten Text prüfen: folgt der echten
  // Schlussformel z. B. noch ein PS mit einem eigenen (Stoppwort-)Treffer
  // ("PS: Grüße auch Deine Mutter"), würde sonst der ganze Vorschlag verworfen,
  // obwohl weiter oben eine gültige Signatur steht. Deshalb von hinten nach
  // vorne den ersten Treffer nehmen, der einen echten Namen ergibt.
  const matches = [...(text || "").matchAll(pattern)];
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const words = matches[i][1].split(/[ \t\u00A0]+/);
    // Führende Beziehungswörter abstreifen ("Sohn", "Tochter", "Mutter", …) —
    // "Dein Sohn Erik" -> Erik ist der Name, "Sohn" nur die Beziehungsangabe.
    while (words.length > 1 && SIGNATURE_STOPWORDS.has(words[0].toLowerCase())) {
      words.shift();
    }
    if (SIGNATURE_STOPWORDS.has(words[0].toLowerCase())) continue; // nur Stoppwörter übrig -> kein Name
    return { vorname: words[0], nachname: words[1] || "" };
  }

  return { vorname: "", nachname: "" };
}

const TOP_LINE_WINDOW = 5;

// Häufige Titel/Anreden vor einem Namen in Kopf-/Titelzeilen. Bewusst kurz
// gehalten — bei Bedarf einfach ergänzen.
const NAME_TITLES = [
  "Pfarrer", "Pastor", "Dr\\.?", "Prof\\.?", "Herr", "Frau", "Fräulein",
  "Hauptmann", "Leutnant", "Major", "Bürgermeister", "Lehrer", "Lehrerin",
];

// Adelsprädikate/Namenspartikel mitten im Nachnamen ("Sebastian von der
// Mütze", "Anna von Arnim") — sonst scheitert die Ganze-Zeile-Prüfung an den
// kleingeschriebenen Wörtern zwischen Vor- und Nachname.
const NAME_PARTICLE = "(?:von und zu|von der|von den|von dem|von|zu|van|de)";

const STANDALONE_NAME_RE = new RegExp(
  `^(?:(?:${NAME_TITLES.join("|")})\\s+)?([A-ZÄÖÜ][a-zäöüß]+)(?:\\s+((?:${NAME_PARTICLE}\\s+)?[A-ZÄÖÜ][a-zäöüß]+))?$`
);
const ADDRESSEE_LINE_RE = /^An\b/; // "An Herrn Müller", "An meine liebe Frau" -> Adressat, nicht Autor
const VON_PREFIX_RE = /^von\s+/i; // "von Sebastian Müller" -> "von" zählt als Autor-Hinweis, nicht als Adressat

// Typische Überschriften-/Gattungswörter, die wie ein alleinstehender Name
// aussehen ("Tagebuch", "Erster Weltkrieg" als Bandüberschrift), aber keiner
// sind — verhindert falsche Treffer der Titelzeilen-Heuristik.
const HEADING_STOPWORDS = new Set([
  "tagebuch", "tagebücher", "brief", "briefe", "erinnerungen", "erinnerungstext",
  "vorwort", "einleitung", "inhalt", "inhaltsverzeichnis", "kapitel", "teil",
  "band", "anhang", "anfang", "ende", "schluss",
  "erster", "erste", "zweiter", "zweite", "dritter", "dritte", "vierter", "vierte",
  "fünfter", "fünfte", "weltkrieg", "krieg",
]);

/**
 * Sucht in den ersten Zeilen des Dokuments (vor jeder Absatz-/Paragraph-
 * Aufteilung, also echte Zeilen) nach einer Zeile, die für sich allein nur aus
 * einem Namen bzw. Titel + Name besteht — ein häufiges Muster für
 * Titelzeilen/Verfasserangaben ohne Geburtsdatum-Anker und ohne Briefschluss.
 * Zeilen, die mit "An" beginnen (Adressat), werden ausdrücklich ausgeschlossen;
 * ein vorangestelltes "von" wird dagegen als Autoren-Hinweis akzeptiert und
 * vor der Namensprüfung entfernt.
 */
export function guessAuthorFromTopLine(text) {
  const empty = { vorname: "", nachname: "" };
  const lines = (text || "").split(/\r?\n/).slice(0, TOP_LINE_WINDOW);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || ADDRESSEE_LINE_RE.test(line)) continue;

    const candidate = line.replace(VON_PREFIX_RE, "");
    const m = candidate.match(STANDALONE_NAME_RE);
    if (!m) continue;

    const [, first, second] = m;
    const firstLower = first.toLowerCase();
    if (SIGNATURE_STOPWORDS.has(firstLower) || HEADING_STOPWORDS.has(firstLower)) continue;
    if (second && HEADING_STOPWORDS.has(second.toLowerCase())) continue;

    return second ? { vorname: first, nachname: second } : { vorname: "", nachname: first };
  }

  return empty;
}

function toIsoFromNumeric(d) {
  if (!d) return null;
  const parts = d.split(".");
  if (parts.length !== 3) return null;
  let [day, month, year] = parts;
  if (year.length === 2) year = `19${year}`;
  if (year.length !== 4) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Geburts-/Sterbedatum im Kopfbereich sind keine "Geschrieben von/bis"-Daten
 * und dürfen die per Datumsfallback ermittelte Zeitspanne nicht verfälschen
 * (die Bandüberschrift-Quelle ist davon nicht betroffen, da sie ein eigenes,
 * unverwechselbares Muster in den ersten sechs Absätzen ist).
 */
function refineZeitraumExcludingHeaderDates(parsed, header) {
  if (parsed.zeitraum.quelle !== "erstes-letztes-datum") return parsed.zeitraum;

  const exclude = new Set([toIsoFromNumeric(header.geburtsdatum), toIsoFromNumeric(header.sterbedatum)].filter(Boolean));
  if (!exclude.size) return parsed.zeitraum;

  const dates = extractDatesInOrder(parsed.normalizedText).filter((d) => !exclude.has(d.iso));
  if (!dates.length) return { von: "", bis: "", quelle: "keine" };
  return { von: dates[0].iso, bis: dates[dates.length - 1].iso, quelle: "erstes-letztes-datum" };
}

/** Offene Fragen, die sich aus einem Transkript grundsätzlich nicht auflösen lassen. */
export function buildOffeneFragen(parsed) {
  return [
    ...parsed.offeneFragen,
    "Schriftträger des Originals (Handschrift, Sütterlin, Schreibmaschine …) ist aus " +
      "dem Transkript nicht ableitbar — am Original prüfen.",
  ];
}

/**
 * Bündelt Themen-/Zeit-Klassifikation und die (schwächeren, aber weiterhin
 * nützlichen) Autor-Heuristiken zu einem einzigen Ergebnis für die Ausbaustufe.
 */
export function classifyTranscript(parsed, { vocab, themenConfig }) {
  const header = extractHeaderInfo(parsed.rawText);
  const signaturName = guessAuthorName(parsed.rawText);
  const topLineName = guessAuthorFromTopLine(parsed.rawText);
  const zeitraum = refineZeitraumExcludingHeaderDates(parsed, header);

  return {
    themen: classifyThemen(parsed, themenConfig),
    zeitlicheEinordnung: classifyZeitlich(zeitraum, vocab.zeitlicheEinordnungJahre),
    zeitraum,
    header,
    signaturName,
    topLineName,
    offeneFragen: buildOffeneFragen(parsed),
  };
}
