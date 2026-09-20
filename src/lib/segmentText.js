/**
 * Zerlegt einen Volltext in nummerierte Segmente (Absätze).
 * Ein Segment = ein durch Leerzeile getrennter Absatz.
 */
export function segmentText(volltext) {
  if (!volltext) return [];
  const raw = volltext.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  return raw
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: i + 1, text }));
}
