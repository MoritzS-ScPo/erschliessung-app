import { useCallback, useRef, useState } from "react";

const TEXT_EXTENSIONS = [".txt", ".docx"];
const OCR_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

function extOf(filename) {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i).toLowerCase();
}

export default function UploadScreen({ onUpload, onOcrUpload, onDemo, onArchiv, loadingLabel }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const loading = Boolean(loadingLabel);

  const handleFiles = useCallback(
    (files) => {
      const file = files?.[0];
      if (!file) return;
      const ext = extOf(file.name);
      if (TEXT_EXTENSIONS.includes(ext)) {
        onUpload(file);
      } else if (OCR_EXTENSIONS.includes(ext)) {
        onOcrUpload(file);
      } else {
        onUpload(file); // lässt den Server die passende Fehlermeldung liefern
      }
    },
    [onUpload, onOcrUpload]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div className="upload-screen">
      <div
        className={dragOver ? "dropzone dropzone-active" : "dropzone"}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        aria-label="Dokument hochladen"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.docx,.pdf,.jpg,.jpeg,.png"
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="dropzone-title">{loading ? loadingLabel : "Zeitzeugnis hier ablegen"}</p>
        <p className="dropzone-hint">oder klicken, um eine Datei auszuwählen</p>
      </div>

      <p className="formats-hint">
        Unterstützte Formate: .txt, .docx (direkte Übernahme) sowie .pdf, .jpg/.jpeg, .png
        (Texterkennung/OCR, lokal über Tesseract).
      </p>

      {/* TODO: Transkribus-API — für zuverlässige Erkennung historischer Handschrift
          (Sütterlin, Kurrent) hier andocken; die lokale OCR unten liefert dafür keine
          brauchbaren Ergebnisse, nur für Maschinenschrift/Druckschrift geeignet. */}
      <p className="formats-hint formats-hint-muted">
        Hinweis: Handschrift (Sütterlin/Kurrent) wird von der lokalen Texterkennung nur
        unzuverlässig erkannt — professionelle Handschriftenerkennung über Transkribus ist im
        Prototyp nicht angebunden.
      </p>

      <div className="upload-actions">
        <button className="btn btn-secondary" onClick={onDemo} disabled={loading}>
          Demo laden
        </button>
        <button className="btn btn-ghost" onClick={onArchiv}>
          Archiv öffnen
        </button>
      </div>
    </div>
  );
}
