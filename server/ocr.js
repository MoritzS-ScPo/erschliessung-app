import { createWorker } from "tesseract.js";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESSDATA_DIR = path.join(__dirname, "tessdata");

// Volltext-Erkennung aus Foto (.jpg/.png) oder gescanntem PDF eines Zeitzeugnisses.
// Läuft vollständig lokal über Tesseract.js (WASM, kein Netzwerkzugriff) mit den
// mitgelieferten Sprachmodellen unter server/tessdata/.
//
// Grenzen: gut geeignet für Maschinenschrift/Druckschrift und klare moderne
// Handschrift. Historische Kurrent-/Sütterlinschrift wird von Tesseract NICHT
// zuverlässig erkannt — dafür bräuchte es ein auf historische Handschriften
// trainiertes Modell (Transkribus, oder offline Kraken/Loghi, siehe README).
let workerPromise = null;
function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(["deu", "eng"], undefined, {
      langPath: TESSDATA_DIR,
      cachePath: TESSDATA_DIR,
      gzip: false,
      cacheMethod: "none",
    });
  }
  return workerPromise;
}

async function recognizeImageBuffer(buffer) {
  const worker = await getWorker();
  const {
    data: { text },
  } = await worker.recognize(buffer);
  return text.trim();
}

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

async function pdfToPageImages(buffer) {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    canvasFactory: new NodeCanvasFactory(),
    isEvalSupported: false,
  }).promise;

  const images = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvasFactory = new NodeCanvasFactory();
    const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);
    await page.render({ canvasContext: context, viewport, canvasFactory }).promise;
    images.push(canvas.toBuffer("image/png"));
  }
  return images;
}

/** Liefert erkannten Volltext + eine Warnung, falls die Erkennung unsicher wirkt. */
export async function ocrFileToText(buffer, ext) {
  let pageTexts = [];

  if (ext === ".pdf") {
    const images = await pdfToPageImages(buffer);
    for (const img of images) {
      pageTexts.push(await recognizeImageBuffer(img));
    }
  } else {
    pageTexts = [await recognizeImageBuffer(buffer)];
  }

  const volltext = pageTexts.filter(Boolean).join("\n\n");
  return {
    volltext,
    warning:
      "Text automatisch per OCR erkannt (Tesseract, lokal). Bitte sorgfältig prüfen und korrigieren — bei Handschrift (Sütterlin/Kurrent) ist die Erkennung unzuverlässig.",
  };
}
