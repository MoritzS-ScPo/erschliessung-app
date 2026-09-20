const BASE = "/api";

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Anfrage fehlgeschlagen (${res.status})`);
  }
  return res.json();
}

export async function fetchVocab() {
  return handle(await fetch(`${BASE}/vocab`));
}

export async function fetchDemo() {
  return handle(await fetch(`${BASE}/demo`));
}

export async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  return handle(await fetch(`${BASE}/parse`, { method: "POST", body: fd }));
}

export async function ocrFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  return handle(await fetch(`${BASE}/ocr`, { method: "POST", body: fd }));
}

export async function analyseText(volltext) {
  return handle(
    await fetch(`${BASE}/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volltext }),
    })
  );
}

export async function saveErschliessung(payload) {
  return handle(
    await fetch(`${BASE}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}

export async function fetchArchiv() {
  return handle(await fetch(`${BASE}/archiv`));
}

export async function fetchArchivEintrag(id) {
  return handle(await fetch(`${BASE}/archiv/${id}`));
}

export async function openDocx(id) {
  return handle(await fetch(`${BASE}/archiv/${id}/open`, { method: "POST" }));
}

export async function deleteArchivEintrag(id) {
  return handle(await fetch(`${BASE}/archiv/${id}`, { method: "DELETE" }));
}
