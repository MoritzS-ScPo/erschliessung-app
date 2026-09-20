import vocab from "../../shared/vocab.json";
import ChipGroup from "./ChipGroup.jsx";
import AutoField from "./AutoField.jsx";
import PersonenListe from "./PersonenListe.jsx";

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props) {
  return <input type="text" className="input" {...props} />;
}

export default function ErschliessungForm({ form, setForm, segments, onSegmentRefClick }) {
  const update = (patch) => setForm({ ...form, ...patch });
  const updateNested = (key, patch) => setForm({ ...form, [key]: { ...form[key], ...patch } });
  const automatik = form.automatik;

  const confirmAutomatikFeld = (feld) => {
    setForm({ ...form, automatik: { ...form.automatik, [feld]: { ...form.automatik[feld], bestaetigt: true } } });
  };

  const confirmThema = (thema) => {
    setForm({
      ...form,
      automatik: {
        ...form.automatik,
        themen: { ...form.automatik.themen, [thema]: { ...form.automatik.themen[thema], bestaetigt: true } },
      },
    });
  };

  const confirmZeitlicheEinordnung = (label) => {
    setForm({
      ...form,
      automatik: {
        ...form.automatik,
        zeitlicheEinordnung: {
          ...form.automatik.zeitlicheEinordnung,
          [label]: { ...form.automatik.zeitlicheEinordnung[label], bestaetigt: true },
        },
      },
    });
  };

  const setPersonen = (personen) => update({ personen });

  const gattung = form.dokument.gattung;
  const artOptions = vocab.artNachGattung[gattung] || [];

  return (
    <section className="form">
      <div className="form-section">
        <h2>Signatur</h2>
        <div className="field-row">
          <Field label="Signatur">
            <TextInput value={form.signatur} onChange={(e) => update({ signatur: e.target.value })} />
          </Field>
          <Field label="Verweis auf weitere Signaturen">
            <TextInput value={form.verweisSignaturen} onChange={(e) => update({ verweisSignaturen: e.target.value })} />
          </Field>
        </div>
      </div>

      <div className="form-section">
        <h2>Angaben zum Autor</h2>
        <div className="field-row">
          <Field label="Vorname">
            <TextInput value={form.autor.vorname} onChange={(e) => updateNested("autor", { vorname: e.target.value })} />
          </Field>
          <Field label="Nachname">
            <TextInput value={form.autor.nachname} onChange={(e) => updateNested("autor", { nachname: e.target.value })} />
          </Field>
          <Field label="Geschlecht">
            <select
              className="input"
              value={form.autor.geschlecht}
              onChange={(e) => updateNested("autor", { geschlecht: e.target.value })}
            >
              <option value="">–</option>
              {vocab.geschlecht.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="field-row">
          <Field label="Geburtsdatum">
            <TextInput
              placeholder="TT.MM.JJJJ"
              value={form.autor.geburtsdatum}
              onChange={(e) => updateNested("autor", { geburtsdatum: e.target.value })}
            />
          </Field>
          <Field label="Geburtsort">
            <TextInput value={form.autor.geburtsort} onChange={(e) => updateNested("autor", { geburtsort: e.target.value })} />
          </Field>
          <Field label="Sterbedatum">
            <TextInput
              placeholder="TT.MM.JJJJ"
              value={form.autor.sterbedatum}
              onChange={(e) => updateNested("autor", { sterbedatum: e.target.value })}
            />
          </Field>
          <Field label="Sterbeort">
            <TextInput value={form.autor.sterbeort} onChange={(e) => updateNested("autor", { sterbeort: e.target.value })} />
          </Field>
        </div>

        <Field label="Alter zur Zeit der Niederschrift">
          <select className="input" value={form.altersgruppe} onChange={(e) => update({ altersgruppe: e.target.value })}>
            <option value="">–</option>
            {vocab.altersgruppen.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>

        <div className="field-row">
          <Field label="Beruf">
            <TextInput
              value={form.weitereAngaben.beruf}
              onChange={(e) => updateNested("weitereAngaben", { beruf: e.target.value })}
            />
          </Field>
          <Field label="Wohnort">
            <TextInput
              value={form.weitereAngaben.wohnort}
              onChange={(e) => updateNested("weitereAngaben", { wohnort: e.target.value })}
            />
          </Field>
          <Field label="Region">
            <TextInput
              value={form.weitereAngaben.region}
              onChange={(e) => updateNested("weitereAngaben", { region: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="form-section">
        <h2>Angaben zum Dokument</h2>
        <Field label="Gattung">
          <select
            className="input"
            value={gattung}
            onChange={(e) => updateNested("dokument", { gattung: e.target.value })}
          >
            {vocab.gattungen.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>

        <div className="field-row">
          <AutoField
            label="Geschrieben von"
            placeholder="JJJJ-MM-TT"
            value={form.dokument.geschriebenVon}
            automatik={automatik?.geschriebenVon}
            onConfirm={() => confirmAutomatikFeld("geschriebenVon")}
            onRefClick={onSegmentRefClick}
            onChange={(e) => updateNested("dokument", { geschriebenVon: e.target.value })}
          />
          <AutoField
            label="Geschrieben bis"
            placeholder="JJJJ-MM-TT"
            value={form.dokument.geschriebenBis}
            automatik={automatik?.geschriebenBis}
            onConfirm={() => confirmAutomatikFeld("geschriebenBis")}
            onRefClick={onSegmentRefClick}
            onChange={(e) => updateNested("dokument", { geschriebenBis: e.target.value })}
          />
          <Field label="Davon hauptsächlich von">
            <TextInput
              placeholder="JJJJ-MM-TT"
              value={form.dokument.hauptsaechlichVon}
              onChange={(e) => updateNested("dokument", { hauptsaechlichVon: e.target.value })}
            />
          </Field>
          <Field label="Davon hauptsächlich bis">
            <TextInput
              placeholder="JJJJ-MM-TT"
              value={form.dokument.hauptsaechlichBis}
              onChange={(e) => updateNested("dokument", { hauptsaechlichBis: e.target.value })}
            />
          </Field>
        </div>

        <div className="field-row">
          <AutoField
            label="Anzahl Seiten"
            value={form.dokument.anzahlSeiten}
            automatik={automatik?.seiten}
            onConfirm={() => confirmAutomatikFeld("seiten")}
            onRefClick={onSegmentRefClick}
            onChange={(e) => updateNested("dokument", { anzahlSeiten: e.target.value })}
          />
          {gattung === "Brief" && (
            <>
              <Field label="Anzahl Briefe">
                <TextInput
                  value={form.dokument.anzahlBriefe}
                  onChange={(e) => updateNested("dokument", { anzahlBriefe: e.target.value })}
                />
              </Field>
              <Field label="Anzahl Karten">
                <TextInput
                  value={form.dokument.anzahlKarten}
                  onChange={(e) => updateNested("dokument", { anzahlKarten: e.target.value })}
                />
              </Field>
            </>
          )}
          {gattung === "Erinnerungstext" && (
            <Field label="Titel des Erinnerungstextes">
              <TextInput
                value={form.dokument.titel}
                onChange={(e) => updateNested("dokument", { titel: e.target.value })}
              />
            </Field>
          )}
        </div>

        {gattung === "Erinnerungstext" && (
          <div className="field-row">
            <Field label="Beschriebene Zeit von">
              <TextInput
                placeholder="JJJJ-MM-TT"
                value={form.dokument.beschriebeneZeitVon}
                onChange={(e) => updateNested("dokument", { beschriebeneZeitVon: e.target.value })}
              />
            </Field>
            <Field label="Beschriebene Zeit bis">
              <TextInput
                placeholder="JJJJ-MM-TT"
                value={form.dokument.beschriebeneZeitBis}
                onChange={(e) => updateNested("dokument", { beschriebeneZeitBis: e.target.value })}
              />
            </Field>
          </div>
        )}

        <Field label={`Art des Dokuments (${gattung})`}>
          <ChipGroup options={artOptions} selected={form.art} onChange={(art) => update({ art })} name="Art des Dokuments" />
        </Field>

        <div className="field-label enthaelt-label">Enthält außerdem</div>
        <div className="field-row enthaelt-row">
          {vocab.enthaeltWeiteres.map((item) => (
            <Field key={item} label={item}>
              <input
                type="number"
                min="0"
                className="input input-number"
                value={form.enthaeltWeiteres[item]}
                onChange={(e) =>
                  updateNested("enthaeltWeiteres", { [item]: Number(e.target.value) || 0 })
                }
              />
            </Field>
          ))}
        </div>

        <Field label="Geschrieben in">
          <ChipGroup
            options={vocab.geschriebenIn}
            selected={form.geschriebenIn}
            onChange={(geschriebenIn) => update({ geschriebenIn })}
            name="Geschrieben in"
          />
        </Field>

        <div className="field-row">
          <Field label="Sprachen (außer Deutsch)">
            <TextInput value={form.sprachenAusserDeutsch} onChange={(e) => update({ sprachenAusserDeutsch: e.target.value })} />
          </Field>
          <Field label="Dialekt">
            <TextInput value={form.dialekt} onChange={(e) => update({ dialekt: e.target.value })} />
          </Field>
        </div>

        <Field label="Lesbarkeit">
          <ChipGroup
            options={vocab.lesbarkeit}
            selected={form.lesbarkeit}
            onChange={(lesbarkeit) => update({ lesbarkeit })}
            name="Lesbarkeit"
          />
        </Field>
      </div>

      <div className="form-section">
        <h2>Angaben zum Inhalt</h2>
        <Field label="Themen">
          <ChipGroup
            options={vocab.themen}
            selected={form.themen}
            onChange={(themen) => update({ themen })}
            name="Themen"
            suggestions={automatik?.themen}
            onConfirm={confirmThema}
            onRefClick={onSegmentRefClick}
          />
        </Field>
        <Field label="Zeitliche Einordnung">
          <ChipGroup
            options={vocab.zeitlicheEinordnung}
            selected={form.zeitlicheEinordnung}
            onChange={(zeitlicheEinordnung) => update({ zeitlicheEinordnung })}
            name="Zeitliche Einordnung"
            suggestions={automatik?.zeitlicheEinordnung}
            onConfirm={confirmZeitlicheEinordnung}
            onRefClick={onSegmentRefClick}
          />
        </Field>
      </div>

      <PersonenListe
        personen={form.personen}
        setPersonen={setPersonen}
        segments={segments || []}
        modellVerfuegbar={Boolean(automatik?.modellVerfuegbar)}
        onRefClick={onSegmentRefClick}
      />

      <div className="form-section">
        <h2>Recherche</h2>
        <div className="field-row">
          <Field label="Recherche nötig?">
            <select
              className="input"
              value={form.rechercheNoetig ? "ja" : "nein"}
              onChange={(e) => update({ rechercheNoetig: e.target.value === "ja" })}
            >
              <option value="nein">nein</option>
              <option value="ja">ja</option>
            </select>
          </Field>
        </div>
        <Field label="Notizen zu offenen Fragen">
          <textarea
            className="input textarea"
            rows={2}
            value={form.rechercheNotizen}
            onChange={(e) => update({ rechercheNotizen: e.target.value })}
          />
        </Field>
      </div>

      <div className="form-section">
        <h2>Anregungen / Hinweise</h2>
        <Field label="Für Veranstaltungen geeignet? Detailerschließung sinnvoll?">
          <textarea
            className="input textarea"
            rows={2}
            value={form.anregungen}
            onChange={(e) => update({ anregungen: e.target.value })}
          />
        </Field>
      </div>

      <div className="form-section">
        <h2>Fußzeile</h2>
        <div className="field-row">
          <Field label="Erschlossen durch">
            <TextInput value={form.erschlossenDurch} onChange={(e) => update({ erschlossenDurch: e.target.value })} />
          </Field>
          <Field label="Erschließungsdatum">
            <input
              type="date"
              className="input"
              value={form.erschliessungsdatum}
              onChange={(e) => update({ erschliessungsdatum: e.target.value })}
            />
          </Field>
        </div>
      </div>
    </section>
  );
}
