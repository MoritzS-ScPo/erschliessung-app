/**
 * Optionaler Adapter für ein lokales Sprachmodell über Ollama
 * (http://localhost:11434). Die App muss ohne laufendes Ollama vollständig
 * funktionieren — jede Funktion hier degradiert sauber (liefert false/leer
 * statt zu werfen), nie eine Vermutung statt einer fehlenden Angabe.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "qwen3:14b";
const AVAILABILITY_TIMEOUT_MS = 1500;
// Ganze Tagebuchbände können mehrere zehntausend Zeichen haben; ein 14B-Modell
// auf CPU/lokaler GPU braucht dafür Zeit — großzügiges Timeout statt Abbruch.
const GENERATE_TIMEOUT_MS = 300000;

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function isOllamaAvailable() {
  try {
    const res = await fetchWithTimeout(`${OLLAMA_URL}/api/tags`, {}, AVAILABILITY_TIMEOUT_MS);
    return res.ok;
  } catch {
    return false;
  }
}

const PERSONEN_SCHEMA = {
  type: "object",
  properties: {
    personen: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          beziehung: { type: "string" },
          seite: { type: "string" },
          unsicher: { type: "boolean" },
        },
        required: ["name"],
      },
    },
  },
  required: ["personen"],
};

function buildPersonenPrompt({ text, beziehungen }) {
  return `Du liest ein Transkript aus einem privaten Zeitzeugnis (Tagebuch/Brief/Erinnerungstext) \
für ein Archiv. Liste alle im Text genannten PERSONEN auf (nicht der Autor/die Autorin selbst, \
außer eindeutig als eigenständige Erwähnung relevant).

Für jede Person:
- "name": genau wie im Text geschrieben.
- "beziehung": eine der folgenden Kategorien, die am besten passt, sonst "Sonstige": \
${beziehungen.join(", ")}.
- "seite": die Seitenzahl der ersten Erwähnung, falls im Text als Seitenmarke erkennbar \
angegeben (sonst leer lassen).
- "unsicher": true, wenn Name oder Zuordnung nicht eindeutig aus dem Text hervorgehen.

WICHTIG: Erfinde NIEMALS Lebensdaten, Berufe oder andere Angaben, die nicht wörtlich im \
Text stehen. Steht etwas nicht im Text, lass das Feld leer. Bei jeder Unsicherheit setze \
"unsicher" auf true, statt zu raten.

Text:
"""
${text}
"""`;
}

/**
 * Extrahiert Personen aus dem Text über das lokale Modell. Gibt bei jedem
 * Fehler (Modell nicht erreichbar, Timeout, kaputte Antwort) eine leere Liste
 * zurück statt zu werfen — der Aufrufer prüft `isOllamaAvailable()` separat,
 * um dem UI mitzuteilen, ob überhaupt versucht wurde.
 */
export async function extractPersonen({ text, beziehungen, model = MODEL }) {
  try {
    const prompt = buildPersonenPrompt({ text, beziehungen });
    const res = await fetchWithTimeout(
      `${OLLAMA_URL}/api/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          format: PERSONEN_SCHEMA,
          stream: false,
          options: { temperature: 0.1 },
        }),
      },
      GENERATE_TIMEOUT_MS
    );
    if (!res.ok) return [];

    const data = await res.json();
    const parsed = JSON.parse(data.response || "{}");
    const personen = Array.isArray(parsed.personen) ? parsed.personen : [];

    return personen
      .filter((p) => p && typeof p.name === "string" && p.name.trim())
      .map((p) => ({
        name: p.name.trim(),
        beziehung: beziehungen.includes(p.beziehung) ? p.beziehung : "Sonstige",
        seite: typeof p.seite === "string" || typeof p.seite === "number" ? String(p.seite) : "",
        unsicher: Boolean(p.unsicher),
      }));
  } catch (err) {
    console.error("[llm] Personen-Extraktion fehlgeschlagen:", err.message);
    return [];
  }
}
