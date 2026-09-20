import express from "express";
import cors from "cors";
import multer from "multer";
import mammoth from "mammoth";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

import { insertErschliessung, listErschliessungen, getErschliessung, deleteErschliessung } from "./db.js";
import { generateDocx } from "./docxExport.js";
import { buildBaseFilename, resolveUniqueFilename } from "./filename.js";
import { ocrFileToText } from "./ocr.js";
import { isOllamaAvailable, extractPersonen } from "./llm.js";
import { parseTranscript } from "../src/lib/parser.js";
import { classifyTranscript } from "../src/lib/classify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In einer gepackten Electron-App liegt der Programmordner (asar) schreibgeschützt
// im Installationsverzeichnis — Electron setzt dann ERSCHLIESSUNG_DATA_DIR auf einen
// beschreibbaren, nutzerspezifischen Ordner (app.getPath("userData")). Ohne diese
// Variable (normaler `npm run dev`/`npm run app` aus dem Quellcode) bleibt es beim
// bisherigen Verhalten: archive/ und data/ direkt im Projektordner.
const APP_DATA_DIR = process.env.ERSCHLIESSUNG_DATA_DIR || path.join(__dirname, "..");
const ARCHIVE_DIR = path.join(APP_DATA_DIR, "archive");
fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

const DEMO_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "shared", "demoData.json"), "utf-8"));
const VOCAB = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "shared", "vocab.json"), "utf-8"));
const THEMEN_CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "shared", "themen.json"), "utf-8"));

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.get("/api/vocab", (req, res) => {
  res.json({ ...VOCAB, themenConfig: THEMEN_CONFIG });
});

app.get("/api/demo", (req, res) => {
  res.json(DEMO_DATA);
});

app.post("/api/parse", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Keine Datei erhalten." });
    // multer/busboy liefert den Dateinamen als Latin1-Bytes; auf UTF-8 zurückwandeln.
    const originalname = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const { buffer } = req.file;
    const ext = path.extname(originalname).toLowerCase();

    let volltext = "";
    if (ext === ".txt") {
      volltext = buffer.toString("utf-8");
    } else if (ext === ".docx") {
      const result = await mammoth.extractRawText({ buffer });
      volltext = result.value;
    } else {
      return res.status(400).json({
        error: "Format nicht unterstützt. Erlaubt sind .txt, .docx, .pdf, .jpg/.jpeg, .png.",
      });
    }

    res.json({ dateiname: originalname, volltext });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Datei konnte nicht gelesen werden." });
  }
});

// Automatische Groberschließung: Regelschicht (parser.js/classify.js) läuft
// immer; das lokale Modell (server/llm.js) wird nur versucht, wenn Ollama
// erreichbar ist. modellVerfuegbar sagt dem Frontend ehrlich, ob geraten
// werden musste oder ob gar nicht erst versucht wurde.
app.post("/api/analyse", async (req, res) => {
  try {
    const { volltext } = req.body;
    if (typeof volltext !== "string" || !volltext.trim()) {
      return res.status(400).json({ error: "Volltext fehlt." });
    }

    const parsed = parseTranscript(volltext);
    const classification = classifyTranscript(parsed, { vocab: VOCAB, themenConfig: THEMEN_CONFIG });

    const modellVerfuegbar = await isOllamaAvailable();
    const personen = modellVerfuegbar
      ? await extractPersonen({ text: volltext, beziehungen: VOCAB.beziehungen })
      : [];

    res.json({
      segments: parsed.segments,
      seiten: parsed.seiten,
      zeitraum: classification.zeitraum,
      offeneFragen: classification.offeneFragen,
      themen: classification.themen,
      zeitlicheEinordnung: classification.zeitlicheEinordnung,
      header: classification.header,
      signaturName: classification.signaturName,
      topLineName: classification.topLineName,
      personen,
      modellVerfuegbar,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analyse fehlgeschlagen." });
  }
});

app.post("/api/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Keine Datei erhalten." });
    const originalname = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const { buffer } = req.file;
    const ext = path.extname(originalname).toLowerCase();

    if (![".pdf", ".jpg", ".jpeg", ".png"].includes(ext)) {
      // TODO: Transkribus-API — spezialisierte Handschriftenerkennung (Sütterlin, Kurrent)
      // für Fälle, in denen die lokale Tesseract-OCR unten nicht ausreicht.
      return res.status(400).json({ error: "Für OCR werden .pdf, .jpg/.jpeg oder .png erwartet." });
    }

    const { volltext, warning } = await ocrFileToText(buffer, ext);
    res.json({ dateiname: originalname, volltext, warning });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Texterkennung (OCR) fehlgeschlagen." });
  }
});

app.post("/api/save", async (req, res) => {
  try {
    const { form, volltext, segments, inhaltsangaben } = req.body;
    if (!form) return res.status(400).json({ error: "Formular fehlt." });

    const erschliessungsdatum = form.erschliessungsdatum || new Date().toISOString().slice(0, 10);
    const dokumentart = form.dokument?.gattung || "Dokument";

    const baseFilename = buildBaseFilename({
      erschliessungsdatum,
      autorVorname: form.autor?.vorname,
      autorNachname: form.autor?.nachname,
      dokumentart,
    });

    const filename = resolveUniqueFilename(baseFilename, ".docx", (candidate) =>
      fs.existsSync(path.join(ARCHIVE_DIR, candidate))
    );
    const absPath = path.join(ARCHIVE_DIR, filename);

    const buffer = await generateDocx({ form, volltext, segments, inhaltsangaben });
    fs.writeFileSync(absPath, buffer);

    const id = insertErschliessung({
      erschliessungsdatum,
      autor_vorname: form.autor?.vorname || "",
      autor_nachname: form.autor?.nachname || "",
      dokumentart,
      gattung: dokumentart,
      signatur: form.signatur || "",
      docx_path: path.join("archive", filename),
      volltext: volltext || "",
      form_json: JSON.stringify({ form, segments, inhaltsangaben }),
    });

    res.json({ id, docxPath: path.join("archive", filename) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Speichern fehlgeschlagen." });
  }
});

app.get("/api/archiv", (req, res) => {
  res.json(listErschliessungen());
});

app.get("/api/archiv/:id", (req, res) => {
  const record = getErschliessung(req.params.id);
  if (!record) return res.status(404).json({ error: "Nicht gefunden." });
  const { form, segments, inhaltsangaben } = JSON.parse(record.form_json);
  res.json({ ...record, form, segments, inhaltsangaben });
});

app.delete("/api/archiv/:id", (req, res) => {
  const record = getErschliessung(req.params.id);
  if (!record) return res.status(404).json({ error: "Nicht gefunden." });

  if (record.docx_path) {
    const absPath = path.join(APP_DATA_DIR, record.docx_path);
    if (absPath.startsWith(ARCHIVE_DIR) && fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }
  }

  deleteErschliessung(req.params.id);
  res.json({ ok: true });
});

app.post("/api/archiv/:id/open", (req, res) => {
  const record = getErschliessung(req.params.id);
  if (!record) return res.status(404).json({ error: "Nicht gefunden." });
  const absPath = path.join(APP_DATA_DIR, record.docx_path);
  if (!absPath.startsWith(ARCHIVE_DIR) || !fs.existsSync(absPath)) {
    return res.status(404).json({ error: "Datei nicht gefunden." });
  }
  // "start" ist auf Windows kein eigenes Programm, sondern ein cmd.exe-Builtin —
  // execFile ruft nie eine Shell auf, deshalb hier explizit über cmd /c. Das
  // führende "" ist nötig, weil start sein erstes Argument sonst als Fenstertitel
  // interpretiert (insbesondere bei Pfaden mit Leerzeichen/Anführungszeichen).
  const [opener, openerArgs] =
    process.platform === "darwin"
      ? ["open", [absPath]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", absPath]]
        : ["xdg-open", [absPath]];
  execFile(opener, openerArgs, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Datei konnte nicht geöffnet werden." });
    }
    res.json({ ok: true });
  });
});

// Produktions-/App-Modus: liefert den per `vite build` erzeugten Frontend-Build
// über denselben Server aus (ein Origin für UI + /api, keine CORS-Sonderfälle
// nötig). Im normalen Entwicklungsbetrieb (`npm run dev`) existiert `dist/`
// nicht und diese Route greift nie — Vite bedient das Frontend dann selbst.
const DIST_DIR = path.join(__dirname, "..", "dist");
if (fs.existsSync(path.join(DIST_DIR, "index.html"))) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

const PORT = 3001;
app.listen(PORT, "localhost", () => {
  console.log(`[server] läuft lokal auf http://localhost:${PORT}`);
});
