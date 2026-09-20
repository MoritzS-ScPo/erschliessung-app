import { useState } from "react";

export default function OcrReviewScreen({ dateiname, initialText, warning, onConfirm, onCancel }) {
  const [text, setText] = useState(initialText);

  return (
    <div className="ocr-review">
      <h1>Texterkennung prüfen</h1>
      <p className="editor-subtitle">{dateiname}</p>

      {warning && <div className="banner banner-warning">{warning}</div>}

      <label className="field">
        <span className="field-label">Erkannter Text (editierbar)</span>
        <textarea
          className="input textarea ocr-textarea"
          rows={18}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      </label>

      <div className="ocr-actions">
        <button className="btn btn-primary" onClick={() => onConfirm(text)}>
          Text übernehmen
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
