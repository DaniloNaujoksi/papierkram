import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  alleGlaeubiger,
  dokument as ladeDokument,
  findeOderLegeGlaeubigerAn,
  forderung as ladeForderung,
  speichereForderung,
  verknuepfeDokument,
} from '../src/db/repo';
import { LEERE_BETRAEGE, formatEuro, parseEuroZuCent, summe } from '../src/domain/betraege';
import type { Extraktion } from '../src/services/claude';
import type { Cent, Forderungstyp } from '../src/domain/types';
import { Feld, Schalter } from '../src/ui/components/Feld';
import { abstand, radius, schrift, useFarben } from '../src/ui/theme';

/** Cent zurück in eine tippbare Eingabe. Null bleibt leer statt "0,00". */
function centZuEingabe(cent: Cent): string {
  if (!cent) return '';
  return (cent / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Nichts aus der automatischen Auswertung wird ungeprüft gespeichert. Diese Ansicht
 * zeigt jeden extrahierten Wert einzeln und editierbar; unsichere Felder sind markiert.
 * Erst dein Bestätigen legt die Forderung an.
 *
 * Dieselbe Maske dient zum Nachbearbeiten: mit `forderungId` statt `dokumentId`
 * werden die gespeicherten Werte geladen und beim Sichern überschrieben. Die
 * automatische Auswertung liest Beträge und Daten nicht immer aus jedem Brief —
 * ohne diesen Weg bliebe eine Forderung für immer unvollständig.
 */
export default function PruefenScreen() {
  const farben = useFarben();
  const { dokumentId, forderungId } = useLocalSearchParams<{
    dokumentId?: string;
    forderungId?: string;
  }>();
  const bearbeitet = Boolean(forderungId);

  const [extraktion, setExtraktion] = useState<Extraktion | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [typ, setTyp] = useState<Forderungstyp>('sonstige');
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);

  // Formularzustand: alles als Text, damit Tippen nicht durch Formatierung gestört wird.
  const [glaeubiger, setGlaeubiger] = useState('');
  const [vertrittFuer, setVertrittFuer] = useState('');
  const [istInkasso, setIstInkasso] = useState(false);
  const [titel, setTitel] = useState('');
  const [aktenzeichen, setAktenzeichen] = useState('');
  const [entstandenAm, setEntstandenAm] = useState('');
  const [faelligAm, setFaelligAm] = useState('');
  const [fristBis, setFristBis] = useState('');
  const [istTituliert, setIstTituliert] = useState(false);
  const [hauptforderung, setHauptforderung] = useState('');
  const [zinsen, setZinsen] = useState('');
  const [mahnkosten, setMahnkosten] = useState('');
  const [inkassokosten, setInkassokosten] = useState('');
  const [gerichtskosten, setGerichtskosten] = useState('');
  const [saeumniszuschlaege, setSaeumniszuschlaege] = useState('');
  const [sonstigeKosten, setSonstigeKosten] = useState('');
  const [gefordertGesamt, setGefordertGesamt] = useState('');

  useEffect(() => {
    // Weg 1: bestehende Forderung nachbearbeiten.
    if (forderungId) {
      const id = Number(forderungId);
      void (async () => {
        const [f, glaeubigerListe] = await Promise.all([ladeForderung(id), alleGlaeubiger()]);
        if (!f) {
          setFehler('Diese Forderung gibt es nicht mehr.');
          setGeladen(true);
          return;
        }
        const g = glaeubigerListe.find((x) => x.id === f.glaeubigerId);
        setTyp(f.typ);
        setGlaeubiger(g?.name ?? '');
        setVertrittFuer(g?.vertrittFuer ?? '');
        setIstInkasso(g?.istInkasso ?? false);
        setTitel(f.titel);
        setAktenzeichen(f.aktenzeichen ?? '');
        setEntstandenAm(f.entstandenAm ?? '');
        setFaelligAm(f.faelligAm ?? '');
        setFristBis(f.fristBis ?? '');
        setIstTituliert(f.istTituliert);
        setHauptforderung(centZuEingabe(f.betraege.hauptforderung));
        setZinsen(centZuEingabe(f.betraege.zinsen));
        setMahnkosten(centZuEingabe(f.betraege.mahnkosten));
        setInkassokosten(centZuEingabe(f.betraege.inkassokosten));
        setGerichtskosten(centZuEingabe(f.betraege.gerichtskosten));
        setSaeumniszuschlaege(centZuEingabe(f.betraege.saeumniszuschlaege));
        setSonstigeKosten(centZuEingabe(f.betraege.sonstigeKosten));
        setGefordertGesamt(f.betraege.gefordertGesamt ? centZuEingabe(f.betraege.gefordertGesamt) : '');
        setGeladen(true);
      })();
      return;
    }

    // Weg 2: frisch gescannten Beleg prüfen.
    const id = Number(dokumentId);
    if (!Number.isFinite(id)) {
      setFehler('Kein Beleg angegeben.');
      setGeladen(true);
      return;
    }
    void ladeDokument(id).then((dok) => {
      if (!dok?.extraktionJson) {
        setFehler('Zu diesem Beleg liegt keine Auswertung vor.');
        setGeladen(true);
        return;
      }
      const e = JSON.parse(dok.extraktionJson) as Extraktion;
      setExtraktion(e);
      setTyp(e.forderungstyp);
      setGlaeubiger(e.glaeubigerName ?? '');
      setVertrittFuer(e.glaeubigerVertrittFuer ?? '');
      setIstInkasso(e.glaeubigerIstInkasso);
      setTitel(e.kurzfassung);
      setAktenzeichen(e.aktenzeichen ?? '');
      setEntstandenAm(e.entstandenAm ?? '');
      setFaelligAm(e.faelligAm ?? '');
      setFristBis(e.fristBis ?? '');
      setIstTituliert(e.istTituliert);
      setHauptforderung(e.hauptforderung ?? '');
      setZinsen(e.zinsen ?? '');
      setMahnkosten(e.mahnkosten ?? '');
      setInkassokosten(e.inkassokosten ?? '');
      setGerichtskosten(e.gerichtskosten ?? '');
      setSaeumniszuschlaege(e.saeumniszuschlaege ?? '');
      setSonstigeKosten(e.sonstigeKosten ?? '');
      setGefordertGesamt(e.gefordertGesamt ?? '');
      setGeladen(true);
    });
  }, [dokumentId, forderungId]);

  function unsicher(feld: string): boolean {
    return extraktion?.unsichereFelder.includes(feld) ?? false;
  }

  const betraege = {
    ...LEERE_BETRAEGE,
    hauptforderung: parseEuroZuCent(hauptforderung) ?? 0,
    zinsen: parseEuroZuCent(zinsen) ?? 0,
    mahnkosten: parseEuroZuCent(mahnkosten) ?? 0,
    inkassokosten: parseEuroZuCent(inkassokosten) ?? 0,
    gerichtskosten: parseEuroZuCent(gerichtskosten) ?? 0,
    saeumniszuschlaege: parseEuroZuCent(saeumniszuschlaege) ?? 0,
    sonstigeKosten: parseEuroZuCent(sonstigeKosten) ?? 0,
    gefordertGesamt: parseEuroZuCent(gefordertGesamt),
  };

  const berechneteSumme = summe(betraege);
  const differenz =
    betraege.gefordertGesamt !== null ? betraege.gefordertGesamt - berechneteSumme : null;

  const luecken: string[] = [];
  if (berechneteSumme === 0) {
    luecken.push(
      'Es ist kein Betrag erfasst. Ohne Betrag taucht die Forderung mit 0,00 € in der Übersicht auf und wird bei der Priorisierung falsch eingeordnet.'
    );
  }
  if (!entstandenAm.trim() && !faelligAm.trim()) {
    luecken.push(
      'Es fehlt das Entstehungs- oder Fälligkeitsdatum. Ohne eines von beiden kann die Verjährung nicht gerechnet werden — und die ist bei alten Forderungen dein stärkster Hebel.'
    );
  }

  async function uebernehmen() {
    if (!glaeubiger.trim()) {
      setFehler('Ohne Gläubiger lässt sich die Forderung nicht zuordnen. Trage den Absender ein.');
      return;
    }
    setSpeichert(true);
    setFehler(null);
    try {
      const glaeubigerId = await findeOderLegeGlaeubigerAn(glaeubiger, {
        vertrittFuer: vertrittFuer.trim() || null,
        adresse: extraktion?.glaeubigerAdresse ?? null,
        istInkasso,
      });

      const gespeicherteId = await speichereForderung(
        {
          glaeubigerId,
          titel: titel.trim() || 'Forderung',
          typ,
          status: 'offen',
          betraege,
          aktenzeichen: aktenzeichen.trim() || null,
          entstandenAm: entstandenAm.trim() || null,
          faelligAm: faelligAm.trim() || null,
          fristBis: fristBis.trim() || null,
          istTituliert,
          tituliertAm: istTituliert ? (extraktion?.briefdatum ?? null) : null,
          verjaehrungNeubeginnAm: null,
          verjaehrungGehemmtSeit: null,
          vorsatzVorgeworfen: false,
          notizen: null,
        },
        forderungId ? Number(forderungId) : undefined
      );

      if (dokumentId) {
        await verknuepfeDokument(Number(dokumentId), gespeicherteId);
      }

      // Zurück in die Übersicht statt in den Scan-Tab: Wer gerade eine Forderung
      // erfasst oder korrigiert hat, will sehen, was jetzt zu tun ist.
      router.replace('/');
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
    } finally {
      setSpeichert(false);
    }
  }

  if (fehler && !geladen) {
    return (
      <View style={[stil.mitte, { backgroundColor: farben.hintergrund }]}>
        <Text style={[schrift.standard, { color: farben.text, textAlign: 'center' }]}>{fehler}</Text>
      </View>
    );
  }

  if (!geladen) {
    return (
      <View style={[stil.mitte, { backgroundColor: farben.hintergrund }]}>
        <ActivityIndicator color={farben.akzent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: farben.hintergrund }}
      contentContainerStyle={stil.inhalt}
      keyboardShouldPersistTaps="handled"
    >
      {extraktion && extraktion.auffaelligkeiten.length > 0 && (
        <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.hoch }]}>
          <Text style={[schrift.betont, { color: farben.hoch }]}>Aufgefallen beim Lesen</Text>
          {extraktion.auffaelligkeiten.map((a) => (
            <Text key={a} style={[schrift.klein, { color: farben.text, marginTop: abstand.s, lineHeight: 20 }]}>
              {a}
            </Text>
          ))}
        </View>
      )}

      {/* Ohne Betrag und ohne Entstehungsdatum ist die Forderung zwar speicherbar,
          aber die App kann dann weder priorisieren noch die Verjährung rechnen.
          Deshalb steht die Lücke oben und nicht als stiller Nullwert im Formular. */}
      {(luecken.length > 0) && (
        <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.hoch }]}>
          <Text style={[schrift.betont, { color: farben.hoch }]}>Das fehlt noch</Text>
          {luecken.map((l) => (
            <Text key={l} style={[schrift.klein, { color: farben.text, marginTop: abstand.s, lineHeight: 20 }]}>
              {l}
            </Text>
          ))}
          <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.m, lineHeight: 20 }]}>
            Beides steht meist im Brief. Wenn die Texterkennung es überlesen hat, trag es unten von
            Hand nach — du kannst das auch später jederzeit über „Bearbeiten" tun.
          </Text>
        </View>
      )}

      <Text style={[schrift.ueberschrift, { color: farben.text }]}>Gläubiger</Text>
      <Feld
        label="Wer fordert das Geld"
        wert={glaeubiger}
        onChange={setGlaeubiger}
        unsicher={unsicher('glaeubigerName')}
        platzhalter="Name aus dem Briefkopf"
      />
      <Schalter
        label="Das ist ein Inkassobüro"
        wert={istInkasso}
        onChange={setIstInkasso}
        hinweis="Inkassobüros treiben fremde Forderungen ein. Ihre eigenen Kosten sind gesetzlich gedeckelt und lassen sich prüfen."
      />
      {istInkasso && (
        <Feld
          label="Treibt ein für"
          wert={vertrittFuer}
          onChange={setVertrittFuer}
          platzhalter="Ursprünglicher Gläubiger"
        />
      )}

      <Text style={[schrift.ueberschrift, { color: farben.text, marginTop: abstand.s }]}>Die Forderung</Text>
      <Feld label="Kurzbeschreibung" wert={titel} onChange={setTitel} mehrzeilig />
      <Feld
        label="Aktenzeichen"
        wert={aktenzeichen}
        onChange={setAktenzeichen}
        unsicher={unsicher('aktenzeichen')}
      />
      <Feld
        label="Forderung entstanden am"
        wert={entstandenAm}
        onChange={setEntstandenAm}
        platzhalter="JJJJ-MM-TT"
        unsicher={unsicher('entstandenAm')}
        hinweis="Rechnungs- oder Leistungsdatum. Von diesem Datum aus wird die Verjährung gerechnet — das wichtigste Feld auf dieser Seite."
      />
      <Feld
        label="Ursprünglich fällig am"
        wert={faelligAm}
        onChange={setFaelligAm}
        platzhalter="JJJJ-MM-TT"
        unsicher={unsicher('faelligAm')}
      />
      <Feld
        label="Frist aus diesem Schreiben"
        wert={fristBis}
        onChange={setFristBis}
        platzhalter="JJJJ-MM-TT"
        unsicher={unsicher('fristBis')}
      />
      <Schalter
        label="Es liegt ein Titel vor"
        wert={istTituliert}
        onChange={setIstTituliert}
        hinweis="Nur bei Vollstreckungsbescheid, Urteil, Prozessvergleich oder notarieller Urkunde. Ein Mahnbescheid allein ist noch kein Titel, und die Drohung mit dem Anwalt erst recht nicht."
      />

      <Text style={[schrift.ueberschrift, { color: farben.text, marginTop: abstand.s }]}>Beträge</Text>
      <Feld
        label="Hauptforderung"
        wert={hauptforderung}
        onChange={setHauptforderung}
        tastatur="numeric"
        platzhalter="0,00"
        unsicher={unsicher('hauptforderung')}
        hinweis="Nur die eigentliche Schuld, ohne Zinsen und Kosten."
      />
      <Feld label="Zinsen" wert={zinsen} onChange={setZinsen} tastatur="numeric" platzhalter="0,00" />
      <Feld label="Mahnkosten" wert={mahnkosten} onChange={setMahnkosten} tastatur="numeric" platzhalter="0,00" />
      <Feld
        label="Inkassokosten"
        wert={inkassokosten}
        onChange={setInkassokosten}
        tastatur="numeric"
        platzhalter="0,00"
        unsicher={unsicher('inkassokosten')}
      />
      <Feld
        label="Gerichtskosten"
        wert={gerichtskosten}
        onChange={setGerichtskosten}
        tastatur="numeric"
        platzhalter="0,00"
      />
      <Feld
        label="Säumniszuschläge"
        wert={saeumniszuschlaege}
        onChange={setSaeumniszuschlaege}
        tastatur="numeric"
        platzhalter="0,00"
      />
      <Feld
        label="Sonstige Kosten"
        wert={sonstigeKosten}
        onChange={setSonstigeKosten}
        tastatur="numeric"
        platzhalter="0,00"
      />
      <Feld
        label="Im Brief genannte Gesamtsumme"
        wert={gefordertGesamt}
        onChange={setGefordertGesamt}
        tastatur="numeric"
        platzhalter="0,00"
      />

      <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
        <View style={stil.summenZeile}>
          <Text style={[schrift.standard, { color: farben.textGedaempft }]}>Summe der Einzelposten</Text>
          <Text style={[schrift.betont, { color: farben.text }]}>{formatEuro(berechneteSumme)}</Text>
        </View>
        {differenz !== null && differenz !== 0 && (
          <Text style={[schrift.klein, { color: farben.hoch, marginTop: abstand.s, lineHeight: 20 }]}>
            Die genannte Gesamtsumme weicht um {formatEuro(Math.abs(differenz))} von der Summe der
            Einzelposten ab. Das ist ein guter Anlass, schriftlich eine detaillierte
            Forderungsaufstellung zu verlangen, bevor du irgendetwas zahlst.
          </Text>
        )}
      </View>

      {fehler && (
        <Text style={[schrift.klein, { color: farben.sofort, lineHeight: 20 }]}>{fehler}</Text>
      )}

      <Pressable
        onPress={() => void uebernehmen()}
        disabled={speichert}
        style={({ pressed }) => [
          stil.knopf,
          { backgroundColor: farben.akzent, opacity: pressed || speichert ? 0.7 : 1 },
        ]}
      >
        <Text style={[schrift.betont, { color: farben.akzentText }]}>
          {speichert ? 'Wird gespeichert…' : 'Forderung übernehmen'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const stil = StyleSheet.create({
  inhalt: { padding: abstand.l, paddingBottom: abstand.xxl, gap: abstand.s },
  mitte: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: abstand.xl },
  karte: {
    padding: abstand.l,
    borderRadius: radius.l,
    borderWidth: StyleSheet.hairlineWidth,
    marginVertical: abstand.s,
  },
  summenZeile: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  knopf: {
    paddingVertical: abstand.l,
    borderRadius: radius.m,
    alignItems: 'center',
    marginTop: abstand.m,
  },
});
