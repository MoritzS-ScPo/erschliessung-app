export function createEmptyForm() {
  return {
    signatur: "",
    verweisSignaturen: "",
    autor: {
      vorname: "",
      nachname: "",
      geburtsdatum: "",
      geburtsort: "",
      sterbedatum: "",
      sterbeort: "",
      geschlecht: "",
    },
    altersgruppe: "",
    weitereAngaben: { beruf: "", wohnort: "", region: "" },
    dokument: {
      gattung: "Brief",
      geschriebenVon: "",
      geschriebenBis: "",
      hauptsaechlichVon: "",
      hauptsaechlichBis: "",
      anzahlSeiten: "",
      anzahlBriefe: "",
      anzahlKarten: "",
      titel: "",
      beschriebeneZeitVon: "",
      beschriebeneZeitBis: "",
    },
    art: [],
    enthaeltWeiteres: { Fotos: 0, Zeichnungen: 0, Zeitungsausschnitte: 0, Karten: 0, Geschichten: 0, Gedichte: 0 },
    geschriebenIn: [],
    sprachenAusserDeutsch: "",
    dialekt: "",
    lesbarkeit: [],
    themen: [],
    zeitlicheEinordnung: [],
    personen: [],
    rechercheNoetig: false,
    rechercheNotizen: "",
    anregungen: "",
    erschlossenDurch: "",
    erschliessungsdatum: new Date().toISOString().slice(0, 10),
    // Herkunft/Konfidenz/Belege je automatisch gefülltem Feld — siehe
    // src/lib/classify.js und README (Abschnitt "Automatische Groberschließung").
    // Rein additiv: kein anderes Feld hängt hiervon ab, docx-Export und
    // Archiv-Rundlauf funktionieren unverändert ohne dieses Objekt.
    automatik: createEmptyAutomatik(),
  };
}

export function createEmptyAutomatik() {
  return {
    seiten: null,
    geschriebenVon: null,
    geschriebenBis: null,
    themen: {},
    zeitlicheEinordnung: {},
    modellVerfuegbar: false,
    hinweise: [],
  };
}
