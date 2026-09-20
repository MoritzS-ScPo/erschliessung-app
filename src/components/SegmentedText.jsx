import { useEffect, useRef } from "react";

export default function SegmentedText({ segments, activeSegmentIds, onSegmentClick }) {
  const refs = useRef({});

  useEffect(() => {
    if (activeSegmentIds.length) {
      const el = refs.current[activeSegmentIds[0]];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeSegmentIds]);

  return (
    <section className="segmented-text">
      <h2>Volltext</h2>
      {segments.length === 0 && <p className="muted">Kein Text vorhanden.</p>}
      <ol className="segment-list">
        {segments.map((seg) => {
          const isActive = activeSegmentIds.includes(seg.id);
          return (
            <li
              key={seg.id}
              ref={(el) => (refs.current[seg.id] = el)}
              className={isActive ? "segment segment-active" : "segment"}
              onClick={() => onSegmentClick(seg.id)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSegmentClick(seg.id);
              }}
            >
              <span className="segment-number">{seg.id}</span>
              <span className="segment-text">{seg.text}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
