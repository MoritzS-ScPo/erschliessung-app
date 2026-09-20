const UMLAUT_MAP = {
  ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss",
};

export function slugifyFilenamePart(input) {
  if (!input) return "Unbekannt";
  let s = String(input).trim();
  s = s.replace(/[äöüÄÖÜß]/g, (ch) => UMLAUT_MAP[ch] ?? ch);
  s = s.replace(/\s+/g, "-");
  s = s.replace(/[^A-Za-z0-9._-]/g, "");
  s = s.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return s || "Unbekannt";
}

export function buildAutorName(vorname, nachname) {
  const v = slugifyFilenamePart(vorname || "");
  const n = slugifyFilenamePart(nachname || "");
  if (!vorname && !nachname) return "Unbekannt";
  if (!nachname) return v;
  if (!vorname) return n;
  return `${n}-${v}`;
}

export function buildBaseFilename({ erschliessungsdatum, autorVorname, autorNachname, dokumentart }) {
  const datum = erschliessungsdatum || new Date().toISOString().slice(0, 10);
  const autor = buildAutorName(autorVorname, autorNachname);
  const art = slugifyFilenamePart(dokumentart || "Dokument");
  return `${datum}_${autor}_${art}`;
}

/** Appends _2, _3, ... if a file with the same name already exists. */
export function resolveUniqueFilename(baseFilename, extension, existsFn) {
  let candidate = `${baseFilename}${extension}`;
  let counter = 2;
  while (existsFn(candidate)) {
    candidate = `${baseFilename}_${counter}${extension}`;
    counter += 1;
  }
  return candidate;
}
