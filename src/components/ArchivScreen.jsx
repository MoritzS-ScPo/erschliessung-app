import { useEffect, useMemo, useState } from "react";
import { fetchArchiv, openDocx, deleteArchivEintrag } from "../lib/api.js";

export default function ArchivScreen({ onOpen }) {
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState("");
  const [artFilter, setArtFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchArchiv()
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const arten = useMemo(() => [...new Set(entries.map((e) => e.dokumentart).filter(Boolean))], [entries]);

  const filtered = entries.filter((e) => {
    const haystack = `${e.autor_vorname} ${e.autor_nachname} ${e.signatur}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query.toLowerCase());
    const matchesArt = !artFilter || e.dokumentart === artFilter;
    return matchesQuery && matchesArt;
  });

  const handleOpenDocx = async (id) => {
    try {
      await openDocx(id);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (entry) => {
    const label = `${entry.autor_vorname} ${entry.autor_nachname}`.trim() || entry.signatur || "diesen Eintrag";
    if (!window.confirm(`"${label}" endgültig aus dem Archiv löschen? Die .docx-Datei wird mitgelöscht.`)) return;
    try {
      await deleteArchivEintrag(entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <section className="archiv-screen">
      <h1>Archiv</h1>

      {entries.length > 0 && (
        <div className="archiv-controls">
          <input
            type="text"
            className="input"
            placeholder="Suche nach Autor oder Signatur …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="input" value={artFilter} onChange={(e) => setArtFilter(e.target.value)}>
            <option value="">Alle Arten</option>
            {arten.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && <p className="muted">Lädt …</p>}
      {error && <p className="banner banner-error">{error}</p>}

      {!loading && entries.length === 0 && (
        <div className="empty-state">
          <p>Noch keine Erschließungen gespeichert.</p>
          <p className="muted">Lade ein Dokument hoch oder nutze „Demo laden“, um den ersten Datensatz anzulegen.</p>
        </div>
      )}

      {!loading && entries.length > 0 && filtered.length === 0 && <p className="muted">Keine Treffer.</p>}

      {filtered.length > 0 && (
        <table className="archiv-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Autor</th>
              <th>Art</th>
              <th>Signatur</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td>{e.erschliessungsdatum}</td>
                <td>
                  {e.autor_vorname} {e.autor_nachname}
                </td>
                <td>{e.dokumentart}</td>
                <td>{e.signatur || "–"}</td>
                <td className="archiv-actions">
                  <button className="btn btn-ghost btn-small" onClick={() => onOpen(e.id)}>
                    Öffnen
                  </button>
                  <button className="btn btn-ghost btn-small" onClick={() => handleOpenDocx(e.id)}>
                    .docx öffnen
                  </button>
                  <button className="btn btn-ghost btn-small btn-danger" onClick={() => handleDelete(e)}>
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
