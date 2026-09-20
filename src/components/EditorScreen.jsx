import { useState, useCallback } from "react";
import ErschliessungForm from "./ErschliessungForm.jsx";
import SegmentedText from "./SegmentedText.jsx";
import ContentSummaries from "./ContentSummaries.jsx";
import { saveErschliessung } from "../lib/api.js";

export default function EditorScreen({
  volltext,
  dateiname,
  form,
  setForm,
  segments,
  inhaltsangaben,
  setInhaltsangaben,
  onSaved,
}) {
  const [activeSegmentIds, setActiveSegmentIds] = useState([]);
  const [activeSummaryIndexes, setActiveSummaryIndexes] = useState([]);
  const [saveState, setSaveState] = useState({ status: "idle", message: "" });

  const highlightSegments = useCallback((refs) => {
    setActiveSegmentIds(refs);
    setActiveSummaryIndexes([]);
  }, []);

  const highlightSummariesForSegment = useCallback(
    (segmentId) => {
      setActiveSegmentIds([segmentId]);
      const idxs = inhaltsangaben
        .map((ia, i) => (ia.refs.includes(segmentId) ? i : -1))
        .filter((i) => i !== -1);
      setActiveSummaryIndexes(idxs);
    },
    [inhaltsangaben]
  );

  const handleSave = useCallback(async () => {
    setSaveState({ status: "saving", message: "" });
    try {
      const result = await saveErschliessung({ form, volltext, segments, inhaltsangaben });
      setSaveState({
        status: "saved",
        message: `Gespeichert als ${result.docxPath}`,
      });
    } catch (e) {
      setSaveState({ status: "error", message: e.message });
    }
  }, [form, volltext, segments, inhaltsangaben]);

  return (
    <div className="editor-screen">
      <div className="editor-header">
        <div>
          <h1>{dateiname || "Zeitzeugnis"}</h1>
          <p className="editor-subtitle">Groberschließung – alle Felder sind editierbar.</p>
        </div>
        <div className="save-area">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saveState.status === "saving"}
          >
            {saveState.status === "saving" ? "Speichert …" : "Erschließung speichern"}
          </button>
          {saveState.status === "saved" && (
            <p className="save-status save-status-ok">
              {saveState.message} —{" "}
              <button className="linklike" onClick={onSaved}>
                im Archiv ansehen
              </button>
            </p>
          )}
          {saveState.status === "error" && <p className="save-status save-status-error">{saveState.message}</p>}
        </div>
      </div>

      <ErschliessungForm form={form} setForm={setForm} segments={segments} onSegmentRefClick={highlightSegments} />

      <ContentSummaries
        inhaltsangaben={inhaltsangaben}
        setInhaltsangaben={setInhaltsangaben}
        segments={segments}
        onRefClick={highlightSegments}
        activeSummaryIndexes={activeSummaryIndexes}
      />

      <SegmentedText segments={segments} activeSegmentIds={activeSegmentIds} onSegmentClick={highlightSummariesForSegment} />
    </div>
  );
}
