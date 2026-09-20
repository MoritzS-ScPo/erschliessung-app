export default function ContentSummaries({
  inhaltsangaben,
  setInhaltsangaben,
  segments,
  onRefClick,
  activeSummaryIndexes,
}) {
  const updateItem = (index, patch) => {
    setInhaltsangaben(inhaltsangaben.map((ia, i) => (i === index ? { ...ia, ...patch } : ia)));
  };

  const removeItem = (index) => {
    setInhaltsangaben(inhaltsangaben.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setInhaltsangaben([...inhaltsangaben, { text: "", refs: [] }]);
  };

  const toggleRef = (index, segId) => {
    const current = inhaltsangaben[index].refs;
    const refs = current.includes(segId) ? current.filter((r) => r !== segId) : [...current, segId].sort((a, b) => a - b);
    updateItem(index, { refs });
  };

  return (
    <section className="content-summaries">
      <div className="section-header-row">
        <h2>Inhaltsangaben</h2>
        <button className="btn btn-ghost btn-small" onClick={addItem}>
          + Stichpunkt hinzufügen
        </button>
      </div>

      {inhaltsangaben.length === 0 && <p className="muted">Noch keine Inhaltsangaben. Fügen Sie Stichpunkte hinzu.</p>}

      <ul className="summary-list">
        {inhaltsangaben.map((ia, index) => (
          <li key={index} className={activeSummaryIndexes.includes(index) ? "summary-item summary-item-active" : "summary-item"}>
            <input
              type="text"
              className="input summary-text"
              placeholder="Bespricht …"
              value={ia.text}
              onChange={(e) => updateItem(index, { text: e.target.value })}
            />
            <span className="summary-refs">
              {ia.refs.length > 0 ? (
                <button className="ref-link" onClick={() => onRefClick(ia.refs)}>
                  ({ia.refs.join(",")})
                </button>
              ) : (
                <span className="muted">(kein Verweis)</span>
              )}
            </span>
            <details className="ref-editor">
              <summary>Verweise bearbeiten</summary>
              <div className="ref-editor-chips">
                {segments.map((seg) => (
                  <button
                    key={seg.id}
                    type="button"
                    className={ia.refs.includes(seg.id) ? "chip chip-active chip-small" : "chip chip-small"}
                    onClick={() => toggleRef(index, seg.id)}
                  >
                    {seg.id}
                  </button>
                ))}
              </div>
            </details>
            <button className="btn-icon" aria-label="Inhaltsangabe löschen" onClick={() => removeItem(index)}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
