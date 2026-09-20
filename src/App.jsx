import { useState, useCallback } from "react";
import UploadScreen from "./components/UploadScreen.jsx";
import EditorScreen from "./components/EditorScreen.jsx";
import ArchivScreen from "./components/ArchivScreen.jsx";
import OcrReviewScreen from "./components/OcrReviewScreen.jsx";
import { fetchDemo, uploadFile, ocrFile, fetchArchivEintrag, analyseText } from "./lib/api.js";
import { segmentText } from "./lib/segmentText.js";
import { createEmptyForm, createEmptyAutomatik } from "./lib/emptyForm.js";

// Konfidenz je Quelle — grobe, aber ehrliche Einordnung: gelesene Seitenmarken
// und eine Bandüberschrift sind zuverlässiger als ein Datumsfallback oder eine
// reine Zeichenschätzung.
const KONFIDENZ = {
  gelesen: 0.9,
  geschaetzt: 0.3,
  bandueberschrift: 0.95,
  "erstes-letztes-datum": 0.6,
  keine: 0,
};

function seitenAutomatikFeld(seiten) {
  if (!seiten) return null;
  const wert = seiten.quelle === "gelesen" ? String(seiten.max - seiten.min + 1) : String(seiten.max);
  const hinweis =
    seiten.quelle === "gelesen"
      ? `Seiten ${seiten.min}–${seiten.max} im Transkript erkannt.` +
        (seiten.warnungOddOnly ? " Vermutlich nur linke Seiten gezählt, am Original prüfen." : "")
      : "Keine Seitenmarken im Transkript gefunden — Anzahl aus der Zeichenzahl geschätzt.";
  return { wert, quelle: seiten.quelle, konfidenz: KONFIDENZ[seiten.quelle] ?? 0.5, belege: [], hinweis, bestaetigt: false };
}

function datumAutomatikFeld(wert, quelle) {
  if (!wert) return null;
  const hinweis =
    quelle === "bandueberschrift"
      ? "Aus der Bandüberschrift gelesen."
      : quelle === "erstes-letztes-datum"
        ? "Erstes/letztes Datum im Text — keine Bandüberschrift gefunden."
        : "";
  return { wert, quelle, konfidenz: KONFIDENZ[quelle] ?? 0.5, belege: [], hinweis, bestaetigt: false };
}

function themenAutomatikMap(themenResult) {
  const out = {};
  for (const [thema, info] of Object.entries(themenResult || {})) {
    out[thema] = { konfidenz: info.konfidenz, belege: info.belege, bestaetigt: false };
  }
  return out;
}

function buildPrefilledForm(volltext, analyse) {
  const form = createEmptyForm();
  if (!analyse) return form;

  const { seiten, zeitraum, themen, zeitlicheEinordnung, header, signaturName, topLineName, personen, modellVerfuegbar, offeneFragen } = analyse;

  const automatik = createEmptyAutomatik();
  automatik.seiten = seitenAutomatikFeld(seiten);
  automatik.geschriebenVon = datumAutomatikFeld(zeitraum?.von, zeitraum?.quelle);
  automatik.geschriebenBis = datumAutomatikFeld(zeitraum?.bis, zeitraum?.quelle);
  automatik.themen = themenAutomatikMap(themen);
  automatik.zeitlicheEinordnung = themenAutomatikMap(zeitlicheEinordnung);
  automatik.modellVerfuegbar = Boolean(modellVerfuegbar);
  automatik.hinweise = offeneFragen || [];

  if (automatik.seiten) form.dokument.anzahlSeiten = automatik.seiten.wert;
  if (automatik.geschriebenVon) form.dokument.geschriebenVon = automatik.geschriebenVon.wert;
  if (automatik.geschriebenBis) form.dokument.geschriebenBis = automatik.geschriebenBis.wert;
  form.themen = Object.keys(automatik.themen);
  form.zeitlicheEinordnung = Object.keys(automatik.zeitlicheEinordnung);

  const vorname = header?.name?.vorname || signaturName?.vorname || topLineName?.vorname || "";
  const nachname = header?.name?.nachname || signaturName?.nachname || topLineName?.nachname || "";
  if (vorname) form.autor.vorname = vorname;
  if (nachname) form.autor.nachname = nachname;
  if (header?.geburtsdatum) form.autor.geburtsdatum = header.geburtsdatum;
  if (header?.geburtsort) form.autor.geburtsort = header.geburtsort;
  if (header?.sterbedatum) form.autor.sterbedatum = header.sterbedatum;
  if (header?.sterbeort) form.autor.sterbeort = header.sterbeort;

  form.personen = (personen || []).map((p) => ({
    name: p.name,
    beziehung: p.beziehung || "",
    seite: p.seite || "",
    unsicher: Boolean(p.unsicher),
    quelle: "modell",
    bestaetigt: false,
  }));

  if (automatik.hinweise.length) {
    form.rechercheNoetig = true;
    form.rechercheNotizen = automatik.hinweise.join("\n");
  }

  form.automatik = automatik;
  return form;
}

function mergeForm(base, partial) {
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    autor: { ...base.autor, ...partial.autor },
    weitereAngaben: { ...base.weitereAngaben, ...partial.weitereAngaben },
    dokument: { ...base.dokument, ...partial.dokument },
    enthaeltWeiteres: { ...base.enthaeltWeiteres, ...partial.enthaeltWeiteres },
    automatik: partial.automatik || base.automatik,
    erschliessungsdatum: partial.erschliessungsdatum || base.erschliessungsdatum,
  };
}

export default function App() {
  const [screen, setScreen] = useState("start");
  const [volltext, setVolltext] = useState("");
  const [dateiname, setDateiname] = useState("");
  const [form, setForm] = useState(createEmptyForm());
  const [segments, setSegments] = useState([]);
  const [inhaltsangaben, setInhaltsangaben] = useState([]);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [error, setError] = useState("");
  const [ocrReview, setOcrReview] = useState(null); // { dateiname, volltext, warning }

  // formPartial/ia !== null/undefined -> Demo/Archiv übergeben ihre eigene
  // (ggf. leere) Vorbelegung explizit und die serverseitige Analyse entfällt.
  const openEditorWith = useCallback(async (text, name, formPartial, ia) => {
    setVolltext(text);
    setDateiname(name || "");

    if (formPartial !== undefined && formPartial !== null) {
      setForm(mergeForm(createEmptyForm(), formPartial));
      setSegments(segmentText(text));
      setInhaltsangaben(ia ?? []);
      setScreen("editor");
      return;
    }

    setLoadingLabel("Analysiere Transkript …");
    try {
      const analyse = await analyseText(text);
      setForm(buildPrefilledForm(text, analyse));
      setSegments(analyse.segments?.length ? analyse.segments : segmentText(text));
    } catch (e) {
      // Analyse ist ein Zusatznutzen, kein Muss — bei Fehler trotzdem mit
      // leerem, frei editierbarem Formular öffnen statt den Upload zu blockieren.
      console.error(e);
      setForm(createEmptyForm());
      setSegments(segmentText(text));
    } finally {
      setLoadingLabel("");
    }
    setInhaltsangaben(ia ?? []);
    setScreen("editor");
  }, []);

  const handleUpload = useCallback(
    async (file) => {
      setError("");
      setLoadingLabel("Wird gelesen …");
      try {
        const result = await uploadFile(file);
        await openEditorWith(result.volltext, result.dateiname, null, null);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingLabel("");
      }
    },
    [openEditorWith]
  );

  const handleOcrUpload = useCallback(async (file) => {
    setError("");
    setLoadingLabel("Texterkennung läuft … das kann bei mehrseitigen PDFs etwas dauern.");
    try {
      const result = await ocrFile(file);
      setOcrReview({ dateiname: result.dateiname, volltext: result.volltext, warning: result.warning });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingLabel("");
    }
  }, []);

  const handleDemo = useCallback(async () => {
    setError("");
    setLoadingLabel("Demo wird geladen …");
    try {
      const demo = await fetchDemo();
      await openEditorWith(demo.volltext, demo.dateiname, demo.form, demo.inhaltsangaben);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingLabel("");
    }
  }, [openEditorWith]);

  const handleOpenFromArchiv = useCallback(async (id) => {
    setError("");
    setLoadingLabel("Lädt …");
    try {
      const record = await fetchArchivEintrag(id);
      setVolltext(record.volltext || "");
      setDateiname(record.signatur || "");
      setForm(mergeForm(createEmptyForm(), record.form));
      setSegments(record.segments || segmentText(record.volltext || ""));
      setInhaltsangaben(record.inhaltsangaben || []);
      setScreen("editor");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingLabel("");
    }
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setScreen("start")}>
          Erschließung
        </button>
        <nav>
          <button
            className={screen === "editor" ? "navlink active" : "navlink"}
            onClick={() => setScreen("editor")}
            disabled={!volltext}
          >
            Editor
          </button>
          <button
            className={screen === "archiv" ? "navlink active" : "navlink"}
            onClick={() => setScreen("archiv")}
          >
            Archiv
          </button>
        </nav>
      </header>

      {error && (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      )}

      <main>
        {screen === "start" && !ocrReview && (
          <UploadScreen
            onUpload={handleUpload}
            onOcrUpload={handleOcrUpload}
            onDemo={handleDemo}
            onArchiv={() => setScreen("archiv")}
            loadingLabel={loadingLabel}
          />
        )}
        {screen === "start" && ocrReview && (
          <OcrReviewScreen
            dateiname={ocrReview.dateiname}
            initialText={ocrReview.volltext}
            warning={ocrReview.warning}
            onConfirm={async (text) => {
              setOcrReview(null);
              await openEditorWith(text, ocrReview.dateiname, null, null);
            }}
            onCancel={() => setOcrReview(null)}
          />
        )}
        {screen === "editor" && volltext && (
          <EditorScreen
            volltext={volltext}
            dateiname={dateiname}
            form={form}
            setForm={setForm}
            segments={segments}
            inhaltsangaben={inhaltsangaben}
            setInhaltsangaben={setInhaltsangaben}
            onSaved={() => setScreen("archiv")}
          />
        )}
        {screen === "editor" && !volltext && (
          <div className="empty-state">
            <p>Noch kein Dokument geladen.</p>
            <button className="btn btn-primary" onClick={() => setScreen("start")}>
              Dokument hochladen
            </button>
          </div>
        )}
        {screen === "archiv" && <ArchivScreen onOpen={handleOpenFromArchiv} />}
      </main>
    </div>
  );
}
