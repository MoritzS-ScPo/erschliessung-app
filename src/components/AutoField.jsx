/**
 * Textfeld für automatisch vorgeschlagene Werte (Seiten, Geschrieben von/bis):
 * blau, solange `automatik.bestaetigt` falsch ist, wird beim ersten Fokus
 * bestätigt (turns black). Zeigt ggf. einen Hinweis (z. B. "geschätzt") und
 * einen Segment-Verweis-Button, wenn Belege vorhanden sind.
 */
export default function AutoField({ label, value, onChange, automatik, onConfirm, onRefClick, placeholder }) {
  const suggested = Boolean(automatik && !automatik.bestaetigt);
  const belege = automatik?.belege;
  const segmentIds = belege?.length ? [...new Set(belege.map((b) => b.segmentId))] : null;

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="text"
        className={suggested ? "input input-suggested" : "input"}
        placeholder={placeholder}
        value={value}
        onFocus={() => suggested && onConfirm?.()}
        onChange={onChange}
      />
      {automatik?.hinweis && <span className="auto-hint">{automatik.hinweis}</span>}
      {segmentIds && (
        <button type="button" className="chip-ref auto-ref" onClick={() => onRefClick?.(segmentIds)}>
          Beleg: ({segmentIds.join(",")})
        </button>
      )}
    </label>
  );
}
