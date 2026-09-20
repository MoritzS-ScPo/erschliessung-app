/**
 * `suggestions` (optional) markiert automatisch vorgeschlagene, aber noch
 * nicht bestätigte Optionen blau: { [option]: { belege, bestaetigt } }.
 * Klick auf einen unbestätigten Vorschlag bestätigt ihn (onConfirm), statt
 * ihn abzuwählen — ein zweiter Klick (jetzt bestätigt/normal ausgewählt)
 * wählt wie gewohnt ab. Ohne `suggestions` verhält sich die Komponente exakt
 * wie zuvor.
 */
export default function ChipGroup({ options, selected, onChange, name, suggestions, onConfirm, onRefClick }) {
  const isUnconfirmedSuggestion = (option) => Boolean(suggestions?.[option] && !suggestions[option].bestaetigt);

  const toggle = (option) => {
    if (isUnconfirmedSuggestion(option)) {
      onConfirm?.(option);
      return;
    }
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div className="chip-group" role="group" aria-label={name}>
      {options.map((option) => {
        const active = selected.includes(option);
        const suggested = isUnconfirmedSuggestion(option);
        const belege = suggestions?.[option]?.belege;
        const segmentIds = belege?.length ? [...new Set(belege.map((b) => b.segmentId))] : null;

        const classNames = ["chip"];
        if (active) classNames.push("chip-active");
        if (suggested) classNames.push("chip-suggested");

        return (
          <span key={option} className="chip-wrap">
            <button
              type="button"
              className={classNames.join(" ")}
              aria-pressed={active}
              title={suggested ? "Vorschlag — Klick bestätigt, nochmal Klick entfernt" : undefined}
              onClick={() => toggle(option)}
            >
              {option}
            </button>
            {segmentIds && (
              <button
                type="button"
                className="chip-ref"
                aria-label={`Belegstellen für ${option} anzeigen`}
                onClick={() => onRefClick?.(segmentIds)}
              >
                ({segmentIds.join(",")})
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
