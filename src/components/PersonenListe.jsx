import vocab from "../../shared/vocab.json";

function findSegmentId(seite, segments) {
  const target = String(seite || "").trim();
  if (!target) return null;
  const match = segments.find((s) => String(s.seite) === target);
  return match ? match.id : null;
}

export default function PersonenListe({ personen, setPersonen, segments, modellVerfuegbar, onRefClick }) {
  const updateItem = (index, patch) => {
    setPersonen(personen.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };
  const removeItem = (index) => setPersonen(personen.filter((_, i) => i !== index));
  const addItem = () =>
    setPersonen([...personen, { name: "", beziehung: "", seite: "", unsicher: false, quelle: "manuell", bestaetigt: true }]);

  const confirmOnFocus = (index, p) => {
    if (p.quelle === "modell" && !p.bestaetigt) updateItem(index, { bestaetigt: true });
  };

  return (
    <section className="personen-liste">
      <div className="section-header-row">
        <h2>Personen</h2>
        <button type="button" className="btn btn-ghost btn-small" onClick={addItem}>
          + Person hinzufügen
        </button>
      </div>

      {!modellVerfuegbar && (
        <p className="muted auto-hint">
          Personen- und Freitextfelder wurden nicht gefüllt — kein lokales Modell erreichbar.
        </p>
      )}

      {personen.length === 0 && modellVerfuegbar && <p className="muted">Keine Personen erkannt.</p>}

      {personen.length > 0 && (
        <ul className="summary-list personen-list">
          {personen.map((p, index) => {
            const suggested = p.quelle === "modell" && !p.bestaetigt;
            const inputClass = suggested ? "input input-suggested" : "input";
            const segId = findSegmentId(p.seite, segments);

            return (
              <li key={index} className="summary-item personen-item">
                <input
                  type="text"
                  className={`${inputClass} personen-name`}
                  placeholder="Name"
                  value={p.name}
                  onFocus={() => confirmOnFocus(index, p)}
                  onChange={(e) => updateItem(index, { name: e.target.value, bestaetigt: true })}
                />
                <select
                  className={inputClass}
                  value={p.beziehung}
                  onFocus={() => confirmOnFocus(index, p)}
                  onChange={(e) => updateItem(index, { beziehung: e.target.value, bestaetigt: true })}
                >
                  <option value="">Beziehung –</option>
                  {vocab.beziehungen.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className={`${inputClass} input-number`}
                  placeholder="Seite"
                  value={p.seite}
                  onFocus={() => confirmOnFocus(index, p)}
                  onChange={(e) => updateItem(index, { seite: e.target.value, bestaetigt: true })}
                />
                {p.unsicher && (
                  <span className="muted" title="Unsicher erkannt — im Text nicht eindeutig">
                    (?)
                  </span>
                )}
                {segId && (
                  <button type="button" className="chip-ref" onClick={() => onRefClick?.([segId])}>
                    → Segment {segId}
                  </button>
                )}
                <button className="btn-icon" aria-label="Person löschen" onClick={() => removeItem(index)}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
