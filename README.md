# Erschließung – lokaler Prototyp

Ein komplett kostenloser, vollständig lokal laufender Prototyp einer Erschließungs-App
für ein Archiv persönlicher Zeitzeugnisse (Briefe, Tagebücher, Erinnerungstexte).

Kein Cloud-Dienst, keine kostenpflichtige API, keine Netzwerkaufrufe zur Laufzeit.
Nach `npm install` läuft alles offline auf `localhost`.

## Architektur

- **Frontend:** React + Vite (`src/`)
- **Backend:** Node + Express, nur auf `localhost:3001` (`server/`)
- **Datenbank:** SQLite über `better-sqlite3`, Datei `./data/archiv.db`
- **.docx-Erzeugung:** npm-Library `docx`
- **.docx-Lesen (Upload):** `mammoth`; `.txt` direkt über `fs`
- **OCR (Foto/PDF → Fließtext):** `tesseract.js` (WASM, läuft lokal), Sprachmodelle liegen
  bereits im Repo unter `server/tessdata/` — kein Netzwerkzugriff zur Laufzeit. PDFs werden
  vorher mit `pdfjs-dist` + `@napi-rs/canvas` seitenweise in Bilder gerastert.
- Gemeinsames Vokabular/Schema (Themen, Zeitliche Einordnung, Arten …) liegt in
  `shared/vocab.json` und `shared/demoData.json` und wird von Frontend und Backend genutzt.
  Die Schlagwortlisten für die automatische Themen-Erkennung liegen separat in
  `shared/themen.json` (siehe „Automatische Groberschließung" unten).
- **Automatische Groberschließung:** `src/lib/parser.js` liest Struktur direkt aus dem
  Transkript (Seitenmarken, Datumsangaben, Bandüberschrift), `src/lib/classify.js` leitet
  daraus belegte Themen-/Zeit-Vorschläge ab. Optional ein lokales Sprachmodell über
  [Ollama](https://ollama.com) (`server/llm.js`) für Personen-Erkennung — läuft ohne
  laufendes Ollama vollständig weiter, nur ohne diesen einen Zusatz.

## Start

```bash
npm install
npm run dev
```

Das startet Frontend (Vite, `http://localhost:5173`) und Backend
(Express, `http://localhost:3001`) gleichzeitig über `concurrently`.
Die App im Browser unter **http://localhost:5173** öffnen.

Voraussetzung: Node.js ≥ 18. `better-sqlite3` kompiliert beim Install ggf. ein natives
Modul; dafür werden Xcode Command Line Tools (macOS) bzw. build-essentials (Linux) benötigt.

## Speicherorte

- **.docx-Dateien:** `./archive/` — eine Datei pro gespeicherter Erschließung
- **Datenbank:** `./data/archiv.db` (SQLite, WAL-Modus)

Beide Ordner werden beim ersten Start automatisch angelegt und sind in `.gitignore`
ausgeschlossen.

## Dateibenennungsschema

```
{Erschließungsdatum}_{Nachname-Vorname}_{Dokumentart}.docx
```

Beispiel: `2025-07-20_Rasenberger-Kurt_Brief.docx`

- Datum als `YYYY-MM-DD`.
- Fehlt der Autorenname vollständig, wird `Unbekannt` verwendet.
- Umlaute werden transliteriert (ä→ae, ö→oe, ü→ue, ß→ss), Leerzeichen werden zu
  Bindestrichen, übrige Sonderzeichen entfernt.
- Bei Namenskollision wird automatisch `_2`, `_3`, … angehängt
  (siehe `server/filename.js`).

## Bedienung

1. **Startbildschirm:** Datei per Drag & Drop oder Klick hochladen — `.txt`/`.docx` werden
   direkt übernommen, `.pdf`/`.jpg`/`.jpeg`/`.png` laufen durch die lokale Texterkennung
   (OCR). Nach der OCR erscheint ein Zwischenschritt mit dem erkannten Text in einem
   editierbaren Feld zum Prüfen/Korrigieren, bevor es weitergeht — OCR ist nie perfekt,
   besonders bei Fotos. Zusätzlich „Demo laden“ für einen Beispiel-Datensatz, oder direkt
   ins „Archiv“ wechseln.
2. Nach dem Upload (bzw. nach Bestätigen des OCR-Texts) schickt die App den Volltext an
   `POST /api/analyse`: Dort liest `parser.js` Struktur direkt aus dem Transkript
   (Seitenmarken, Datumsangaben, Bandüberschrift — siehe unten) und `classify.js` leitet
   daraus belegte Themen-/Zeit-Vorschläge ab. Ein vorausgefülltes Formular erscheint:
   Seitenzahl und Zeitraum (aus echten Seitenmarken/der Bandüberschrift gelesen, nicht
   geschätzt), Themen und Zeitliche Einordnung als Chips, sowie — wenn im Kopfbereich ein
   Muster wie „geb./geboren am TT.MM.JJJJ in ORT“ vorkommt — ein Vorschlag für Vorname,
   Nachname, Geburtsdatum/-ort und Sterbedatum/-ort (sonst Fallback auf einen
   Briefschluss wie „Dein Kurt“, „gez. Grete Müller“). Jeder automatisch gefüllte Wert
   ist **blau** dargestellt, bis er bestätigt ist (ein Klick — auf einen Chip, oder Fokus
   in ein Textfeld — bestätigt ihn und färbt ihn schwarz; ein weiterer Klick auf einen
   bereits bestätigten Chip entfernt ihn wie gewohnt). Belegstellen erscheinen als kleiner
   „(3,7)“-Verweis neben dem Feld — Klick scrollt zu den betroffenen Segmenten im Volltext
   unten, genau wie bei den Inhaltsangaben. Alle Felder bleiben frei editierbar.
3. Der Volltext wird in nummerierte Segmente (Absätze) zerlegt; jedes Segment kennt seine
   zuletzt gültige Seite und sein zuletzt gültiges Datum aus dem Transkript.
4. **Personen** (neuer Abschnitt) werden — nur wenn ein lokales Modell über Ollama
   erreichbar ist — automatisch aus dem Text extrahiert: Name, Beziehung, Seite, sowie
   ein `(?)`-Hinweis bei unsicherer Erkennung. Ist kein Modell erreichbar, bleibt der
   Abschnitt leer und die App sagt das offen, statt zu raten. Frei
   hinzufügbar/editierbar/löschbar wie die Inhaltsangaben.
5. Inhaltsangaben sind frei formulierte Stichpunkte mit Segment-Verweisen, z. B. „(1,2)“ —
   vollständig manuell, keine automatische Vorbelegung mehr (reine Keyword-Treffer waren
   keine echte Zusammenfassung und sind entfernt). Klick auf einen Verweis scrollt zu den
   Segmenten und hebt sie hervor; Klick auf ein Segment zeigt die darauf verweisenden
   Inhaltsangaben.
6. „Erschließung speichern“ erzeugt die `.docx`-Datei, legt sie in `./archive/` ab und
   schreibt einen Datensatz (inkl. Volltext und vollständigem Formular-JSON) in die
   SQLite-Datenbank.
7. Im „Archiv“ lassen sich gespeicherte Erschließungen durchsuchen/filtern, per
   „Öffnen“ zurück in den Editor laden oder per „.docx öffnen“ im Standardprogramm
   des Betriebssystems öffnen.

## Texterkennung (OCR) für Foto/PDF

`.pdf`, `.jpg`/`.jpeg` und `.png` laufen über `server/ocr.js` durch **Tesseract**
(via `tesseract.js`, Sprachen Deutsch + Englisch, Modelle lokal unter
`server/tessdata/`). Alles läuft offline, keine Cloud, keine laufenden Kosten.

**Grenzen:** Tesseract erkennt zuverlässig Maschinenschrift/Druckschrift und klare
moderne Handschrift. Historische **Kurrent-/Sütterlinschrift wird NICHT zuverlässig
erkannt** — dafür ist Tesseracts allgemeines Modell nicht trainiert. Deshalb bleibt
nach der OCR immer ein Korrektur-Schritt (editierbares Textfeld) im Frontend
zwischengeschaltet, und es gibt weiterhin einen Hinweis auf **Transkribus** als
spezialisierten (kostenpflichtigen Cloud-)Dienst für historische Handschriften.
Markierte Stellen im Code für eine spätere Anbindung:

- `src/components/UploadScreen.jsx` — `// TODO: Transkribus-API`
- `server/index.js` (Route `/api/ocr`) — `// TODO: Transkribus-API`

Für eine spätere lokale/offline HTR-Variante (ohne Cloud-Dienst wie Transkribus) kommen
grundsätzlich **Kraken** oder **Loghi** (offline Handwritten Text Recognition,
mit auf historische Schriften trainierbaren Modellen) infrage — im Prototyp bewusst
nicht eingebaut, nur als Zukunftsoption dokumentiert.

Um das Repo klein zu halten, sind die „fast“-Sprachmodelle von Tesseract eingebunden
(~5,5 MB). Für höhere Erkennungsgenauigkeit können die „best“-Modelle von
[tessdata_best](https://github.com/tesseract-ocr/tessdata_best) anstelle der Dateien in
`server/tessdata/` verwendet werden (deutlich größer, aber genauer).

### Automatische Groberschließung

Beim Upload eines transkribierten Zeitzeugnisses (v. a. Tagebücher) füllt die App so
viel wie möglich vor — aber jeder Vorschlag ist belegt und geprüft, nie geraten. Läuft
über `POST /api/analyse` (Backend, damit `shared/themen.json` ohne Frontend-Rebuild
wirksam ist und das optionale LLM angebunden werden kann):

**`src/lib/parser.js`** — liest Struktur aus dem Text, statt sie zu schätzen:

- **Normalisierung** (`normalizeWithMap`): entfernt Korrekturmarken (`[*wort]`,
  `[**wort]`, `[***wort]`) und Fußnotenanker (`[^12]`) vollständig, löst
  Buchstabenergänzungen (`[r]`, `[t]`, `[en]`) durch Entfernen nur der Klammern auf,
  behält aber eine Rückführung jedes normalisierten Zeichens auf seine Position im
  Rohtext — Belegzitate werden aus dem unveränderten Rohtext geschnitten.
- **Seitenmarken**: absatzinitiale Ganzzahl + „.“ oder „:“, akzeptiert nur bei
  Monotonie mit Sprungbegrenzung (≤ 25) gegenüber der zuletzt akzeptierten Seite —
  Tagesangaben („3. November“) sehen identisch aus, fallen aber automatisch heraus
  (verworfen, wenn direkt ein Monatsname folgt; sonst i. d. R. schon durch die
  Monotonie-Prüfung). Findet der Parser keine Seitenmarken, fällt er auf eine
  Zeichenschätzung zurück und kennzeichnet das Feld als **geschätzt** statt gelesen.
- **Datumsangaben mit Jahres-Fortschreibung**: das zuletzt genannte Jahr wird
  fortgetragen (Tagebücher nennen das Jahr oft nur beim ersten Eintrag). Zweistellige
  Jahre werden relativ zum häufigsten vierstelligen Jahr im Dokument (Jahrhundert-Anker)
  aufgelöst — **niemals aus dem Dateinamen**, der ist als Datumsquelle unzuverlässig.
- **Zeitraum des Bandes**: zuerst die Bandüberschrift in den ersten sechs Absätzen
  (`Monat Jahr – Monat Jahr`, höchste Konfidenz), sonst das erste/letzte Datum in
  Lesereihenfolge (bewusst nicht Minimum/Maximum — das würde durch erwähnte Geburtsjahre
  oder Rückblicke verfälscht).

**`src/lib/classify.js`** — Klassifikation mit Beleg, ersetzt die alte reine
Keyword-Heuristik:

- Ein Thema gilt erst als getroffen, wenn mindestens `mindestTreffer` (Standard: 2)
  **verschiedene** Schlagwörter aus `shared/themen.json` vorkommen — Einzeltreffer
  erzeugen sonst mehr Haken zum Wegklicken als sie Zeit sparen. Jeder Treffer liefert
  bis zu drei Belege (`{ segmentId, seite, zitat }`, ±60 Zeichen Kontext).
- Zeitliche Einordnung wird **nicht** über Schlagwörter bestimmt, sondern
  deterministisch aus dem erkannten Datumsbereich gegen die Epochentabelle in
  `shared/vocab.json` — Überlappungen (z. B. „Erster Weltkrieg“ und „Kaiserreich“)
  sind gewollt.
- Die bisherige Kopfbereich-/Briefschluss-Heuristik für Autorname und
  Geburts-/Sterbedaten bleibt erhalten (weiterhin nur ein Vorschlag).

**`shared/themen.json`** — die Schlagwortlisten für die Themen-Erkennung, getrennt von
`shared/vocab.json`, damit sie **ohne Programmierkenntnisse** gepflegt werden können:
eine einfache JSON-Datei `{ "mindestTreffer": 2, "themen": { "Thema": ["schlagwort", …] } }`.
Ein neues Schlagwort hinzufügen heißt: Datei öffnen, in die passende Liste eintragen,
speichern — kein Rebuild nötig (Server liest die Datei beim Start).

**Konfidenz und Herkunft:** jedes automatisch gefüllte Feld trägt seine Quelle mit
(`"regel"` | `"modell"` | `"geschätzt"`), eine Konfidenz und ggf. Belege. Im UI sind
unbestätigte Vorschläge **blau** (Chips und Textfelder, derselbe Akzent wie bei
Segment-Verweisen), bestätigte **schwarz**. Ein Klick auf einen unbestätigten Chip
bestätigt ihn (statt ihn abzuwählen); ein weiterer Klick auf den jetzt bestätigten Chip
entfernt ihn wie gewohnt. Bei Textfeldern (Seiten, Geschrieben von/bis) bestätigt der
erste Fokus ins Feld. Neben jedem automatisch gesetzten Wert mit Belegen sitzt ein
kleiner Segment-Verweis — Klick scrollt zur Belegstelle im Volltext, dieselbe
Interaktion wie bei den Inhaltsangaben.

**`server/llm.js`** — optionale Personen-Erkennung über ein lokales Sprachmodell:

- Adapter gegen die [Ollama](https://ollama.com)-HTTP-Schnittstelle auf
  `localhost:11434`, Standardmodell `qwen3:14b` (überschreibbar über die
  Umgebungsvariable `OLLAMA_MODEL`).
- Die Regelschicht (`parser.js`/`classify.js`) läuft **immer**; das Modell wird nur
  versucht, wenn Ollama erreichbar ist (`isOllamaAvailable()`, kurzer Timeout, wirft nie).
  Die Antwort von `/api/analyse` enthält `modellVerfuegbar: true|false`. Ist kein Modell
  erreichbar, bleibt der neue „Personen“-Abschnitt leer und zeigt eine ruhige Zeile
  („… kein lokales Modell erreichbar“) statt zu raten.
- Erster Anwendungsfall: **Personen** (Name, Beziehung aus festem Vokabular
  `vocab.beziehungen`, Seite, `unsicher: boolean`). Der Prompt verbietet ausdrücklich,
  Lebensdaten zu erfinden — steht etwas nicht im Text, bleibt das Feld leer.
- Für Ollama-Setup: `ollama pull qwen3:14b` und `ollama serve` (bzw. die
  Ollama-Desktop-App) — vollständig optional, die App funktioniert ohne.

**Offene Fragen statt Raten:** aus einem Transkript lässt sich der Schriftträger des
Originals (Handschrift, Sütterlin, Schreibmaschine …) nicht ableiten — die App vermerkt
das als offene Frage statt zu raten, ebenso wenn ein Band mit einer Seitenzahl > 1
beginnt („Band setzt einen vorhergehenden fort, Verweis auf weitere Signaturen prüfen“).

Regressionstest gegen vier echte Tagebuchbände (Seitenzahlen, Zeiträume, lückenlose
Paginierung über die Bände hinweg) unter `test/parser.test.js`:

```bash
npm test
```

## Projektstruktur

```
erschliessung-app/
├── server/              Express-Backend (nur localhost)
│   ├── index.js         Routen: /api/parse, /api/analyse, /api/ocr, /api/save,
│   │                     /api/archiv, /api/demo, /api/vocab
│   ├── db.js             SQLite-Setup (better-sqlite3)
│   ├── docxExport.js      .docx-Erzeugung aus dem Formular
│   ├── llm.js             Optionaler Ollama-Adapter (Personen-Erkennung)
│   ├── ocr.js             Lokale OCR (Tesseract) für Foto/PDF
│   ├── tessdata/          Lokale Tesseract-Sprachmodelle (deu, eng)
│   └── filename.js       Dateibenennung inkl. Kollisionsbehandlung
├── shared/
│   ├── vocab.json        Kontrolliertes Vokabular (Themen, Zeiträume, Arten, Beziehungen …)
│   ├── themen.json       Schlagwortlisten für die Themen-Erkennung (Pflegestelle)
│   └── demoData.json     Demo-Datensatz (Pfarrer-Briefe, Berlin 1944)
├── src/                  React-Frontend (Vite)
│   ├── components/
│   ├── lib/               API-Client, Segmentierung, Parser, Klassifikation, leeres Formular
│   └── styles/
├── test/
│   ├── parser.test.js    Regressionstest gegen echte Tagebuchbände (`npm test`)
│   └── fixtures/          Die vier Testbände (.docx)
├── data/                 SQLite-Datenbank (zur Laufzeit angelegt, gitignored)
└── archive/               gespeicherte .docx-Dateien (zur Laufzeit angelegt, gitignored)
```

## Demo-Datensatz

Drei Briefe eines Pfarrers aus Berlin-Johannisthal (Januar/Februar 1944) an seine
Frau und seinen Sohn: Bombennächte, Gemeindealltag, Beerdigungen, sowie eine Stelle,
in der er erzählt, wie er 1919 seine Frau kennenlernte. Der Text ist frei erfunden,
orientiert sich aber an der Struktur echter Archivbestände. Enthält acht
Inhaltsangaben mit funktionierenden Segment-Verweisen, um die Verweis-Interaktion
und das .docx-Speichern zu demonstrieren.
