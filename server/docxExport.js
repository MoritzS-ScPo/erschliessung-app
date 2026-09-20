import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, HeadingLevel, AlignmentType, BorderStyle, Footer,
} from "docx";

const LABEL_WIDTH = 30;
const VALUE_WIDTH = 70;

function cell(text, { width, bold = false, shading } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: shading ? { fill: shading } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text: text ?? "", bold })],
      }),
    ],
  });
}

function row(label, value) {
  return new TableRow({
    children: [
      cell(label, { width: LABEL_WIDTH, bold: true, shading: "F2F2F2" }),
      cell(value || "–", { width: VALUE_WIDTH }),
    ],
  });
}

function table(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
    },
    rows,
  });
}

function heading(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } });
}

function chipList(arr) {
  return Array.isArray(arr) && arr.length ? arr.join(", ") : "–";
}

function enthaeltText(enthaeltWeiteres) {
  const parts = Object.entries(enthaeltWeiteres || {})
    .filter(([, count]) => Number(count) > 0)
    .map(([k, count]) => `${k}: ${count}`);
  return parts.length ? parts.join(", ") : "–";
}

function personenRows(personen) {
  if (!Array.isArray(personen) || !personen.length) return [row("Personen", "–")];
  return personen.map((p) => {
    const beziehung = p.beziehung ? ` (${p.beziehung})` : "";
    const seite = p.seite ? `, S. ${p.seite}` : "";
    const unsicher = p.unsicher ? " (?)" : "";
    return row("Person", `${p.name || "–"}${beziehung}${seite}${unsicher}`);
  });
}

export async function generateDocx({ form, volltext, segments, inhaltsangaben }) {
  const f = form;
  const autorName = [f.autor?.vorname, f.autor?.nachname].filter(Boolean).join(" ") || "Unbekannt";
  const geschlechtLabel = { m: "männlich", w: "weiblich", d: "divers" }[f.autor?.geschlecht] || "–";

  const children = [
    new Paragraph({ text: "Groberschließung", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({
      children: [new TextRun({ text: `${f.dokument?.gattung || "Dokument"} · Signatur ${f.signatur || "–"}`, italics: true })],
      spacing: { after: 200 },
    }),

    heading("Signatur"),
    table([
      row("Signatur", f.signatur),
      row("Verweis auf weitere Signaturen", f.verweisSignaturen),
    ]),

    heading("Angaben zum Autor"),
    table([
      row("Vorname", f.autor?.vorname),
      row("Nachname", f.autor?.nachname),
      row("Geburtsdatum", f.autor?.geburtsdatum),
      row("Geburtsort", f.autor?.geburtsort),
      row("Sterbedatum", f.autor?.sterbedatum),
      row("Sterbeort", f.autor?.sterbeort),
      row("Geschlecht", geschlechtLabel),
      row("Alter zur Zeit der Niederschrift", f.altersgruppe),
      row("Beruf", f.weitereAngaben?.beruf),
      row("Wohnort", f.weitereAngaben?.wohnort),
      row("Region", f.weitereAngaben?.region),
    ]),

    heading("Personen"),
    table(personenRows(f.personen)),

    heading("Angaben zum Dokument"),
    table([
      row("Gattung", f.dokument?.gattung),
      row("Geschrieben von", f.dokument?.geschriebenVon),
      row("Geschrieben bis", f.dokument?.geschriebenBis),
      row("Davon hauptsächlich von", f.dokument?.hauptsaechlichVon),
      row("Davon hauptsächlich bis", f.dokument?.hauptsaechlichBis),
      row("Anzahl Seiten", f.dokument?.anzahlSeiten),
      row("Anzahl Briefe", f.dokument?.anzahlBriefe),
      row("Anzahl Karten", f.dokument?.anzahlKarten),
      row("Titel", f.dokument?.titel),
      row("Beschriebene Zeit von", f.dokument?.beschriebeneZeitVon),
      row("Beschriebene Zeit bis", f.dokument?.beschriebeneZeitBis),
      row("Art des Dokuments", chipList(f.art)),
      row("Enthält außerdem", enthaeltText(f.enthaeltWeiteres)),
      row("Geschrieben in", chipList(f.geschriebenIn)),
      row("Sprachen außer Deutsch", f.sprachenAusserDeutsch),
      row("Dialekt", f.dialekt),
      row("Lesbarkeit", chipList(f.lesbarkeit)),
    ]),

    heading("Angaben zum Inhalt"),
    table([
      row("Themen", chipList(f.themen)),
      row("Zeitliche Einordnung", chipList(f.zeitlicheEinordnung)),
    ]),

    heading("Recherche"),
    table([
      row("Recherche nötig?", f.rechercheNoetig ? "ja" : "nein"),
      row("Notizen zu offenen Fragen", f.rechercheNotizen),
    ]),

    heading("Anregungen / Hinweise"),
    new Paragraph({ text: f.anregungen || "–", spacing: { after: 200 } }),

    heading("Inhaltsangaben"),
    ...(Array.isArray(inhaltsangaben) && inhaltsangaben.length
      ? inhaltsangaben.map(
          (ia) =>
            new Paragraph({
              bullet: { level: 0 },
              children: [
                new TextRun(ia.text || ""),
                new TextRun({ text: `  (${(ia.refs || []).join(", ")})`, italics: true, color: "3B6FD4" }),
              ],
              spacing: { after: 80 },
            })
        )
      : [new Paragraph({ text: "–" })]),

    heading("Volltext (nummerierte Segmente)"),
    ...(Array.isArray(segments) && segments.length
      ? segments.flatMap((seg) => [
          new Paragraph({
            children: [new TextRun({ text: `[${seg.id}] `, bold: true, color: "3B6FD4" }), new TextRun(seg.text)],
            spacing: { after: 120 },
          }),
        ])
      : [new Paragraph({ text: volltext || "–" })]),
  ];

  const footerDate = f.erschliessungsdatum || new Date().toISOString().slice(0, 10);
  const footerText = `Erschlossen durch ${f.erschlossenDurch || "–"} am ${footerDate}`;

  const doc = new Document({
    sections: [
      {
        properties: {},
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: footerText, size: 18, color: "888888" })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
