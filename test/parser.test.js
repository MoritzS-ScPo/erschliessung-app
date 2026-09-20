import { test, before, describe } from "node:test";
import assert from "node:assert/strict";
import mammoth from "mammoth";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseTranscript, extractDatesInOrder, resolveTwoDigitYear } from "../src/lib/parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "fixtures");

// Erwartete Werte, an den echten Beständen (transfer-01a043c9) verifiziert.
const BAENDE = [
  { file: "TB_769.docx", signatur: "TB 769", seiteMin: 5, seiteMax: 84, von: "1919-11-01", bis: "1920-03-01" },
  { file: "TB_770.docx", signatur: "TB 770", seiteMin: 85, seiteMax: 164, von: "1920-03-01", bis: "1921-04-01" },
  { file: "TB_771.docx", signatur: "TB 771", seiteMin: 165, seiteMax: 254, von: "1921-04-01", bis: "1923-03-01" },
  { file: "TB_772.docx", signatur: "TB 772", seiteMin: 255, seiteMax: 338, von: "1923-03-01", bis: "1924-09-01" },
];

const parsedByFile = new Map();

before(async () => {
  for (const band of BAENDE) {
    const buffer = fs.readFileSync(path.join(FIXTURES_DIR, band.file));
    const { value: volltext } = await mammoth.extractRawText({ buffer });
    parsedByFile.set(band.file, parseTranscript(volltext));
  }
});

describe("parseTranscript — echte Tagebuchbände", () => {
  for (const band of BAENDE) {
    test(`${band.signatur}: Seiten ${band.seiteMin}–${band.seiteMax} werden gelesen, nicht geschätzt`, () => {
      const parsed = parsedByFile.get(band.file);
      assert.equal(parsed.seiten.quelle, "gelesen");
      assert.equal(parsed.seiten.min, band.seiteMin);
      assert.equal(parsed.seiten.max, band.seiteMax);
    });

    test(`${band.signatur}: Zeitraum ${band.von} – ${band.bis} aus Bandüberschrift`, () => {
      const parsed = parsedByFile.get(band.file);
      assert.equal(parsed.zeitraum.quelle, "bandueberschrift");
      assert.equal(parsed.zeitraum.von, band.von);
      assert.equal(parsed.zeitraum.bis, band.bis);
    });

    test(`${band.signatur}: Beginn > 1 vermerkt "Band setzt einen vorhergehenden fort"`, () => {
      const parsed = parsedByFile.get(band.file);
      assert.ok(parsed.seiten.min > 1);
      assert.ok(
        parsed.offeneFragen.some((f) => f.includes("Band setzt einen vorhergehenden fort")),
        "erwartete offene Frage zur Fortsetzung fehlt"
      );
    });
  }

  test("Paginierung schließt über die vier Bände lückenlos aneinander an", () => {
    for (let i = 1; i < BAENDE.length; i += 1) {
      const prev = parsedByFile.get(BAENDE[i - 1].file);
      const curr = parsedByFile.get(BAENDE[i].file);
      assert.equal(curr.seiten.min, prev.seiten.max + 1, `${BAENDE[i].signatur} sollte direkt an ${BAENDE[i - 1].signatur} anschließen`);
    }
  });
});

describe("Jahrhundert-Anker für zweistellige Jahre", () => {
  test("negativ: ein zweistelliges Jahr darf bei einem Anker im 20. Jh. nicht ins 21. Jh. aufgelöst werden", () => {
    // Anker 1920 (häufigstes 4-stelliges Jahr), "5. März 20" darf NICHT 2020 ergeben.
    const text = "Im Jahr 1919 begann alles. 1920 ging es weiter, und wieder 1920. 5. März 20 war ein wichtiger Tag.";
    const dates = extractDatesInOrder(text);
    const maerzDatum = dates.find((d) => d.iso.endsWith("-03-05"));
    assert.ok(maerzDatum, "Datum '5. März 20' wurde nicht erkannt");
    assert.equal(maerzDatum.iso, "1920-03-05");
    assert.notEqual(maerzDatum.iso, "2020-03-05");
  });

  test("resolveTwoDigitYear bleibt im Jahrhundert des Ankers, nicht im aktuellen", () => {
    assert.equal(resolveTwoDigitYear(20, 1919), 1920);
    assert.equal(resolveTwoDigitYear(3, 1919), 1903);
  });

  test("ohne jedes 4-stellige Jahr im Dokument wird kein Anker erfunden, der ins 21. Jh. zeigt, wenn ein Anker via zweitem Argument gesetzt ist", () => {
    assert.equal(resolveTwoDigitYear(20, 1899), 1920);
  });
});
