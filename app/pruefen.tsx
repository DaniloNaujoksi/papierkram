import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  dokument as ladeDokument,
  findeOderLegeGlaeubigerAn,
  speichereForderung,
  verknuepfeDokument,
} from '../src/db/repo';
import { LEERE_BETRAEGE, formatEuro, parseEuroZuCent, summe } from '../src/domain/betraege';
import type { Extraktion } from '../src/services/claude';
import { Feld, Schalter } from '../src/ui/components/Feld';
import { abstand, radius, schrift, useFarben } from '../src/ui/theme';

/**
 * Nichts aus der automatischen Auswertung wird ungeprüft gespeichert. Diese Ansicht
 * zeigt jeden extrahierten Wert einzeln und editierbar; unsichere Felder sind markiert.
 * Erst dein Bestätigen legt die Forderung an.
 */
export default function PruefenScreen() {
  const farben = useFarben();
  const { dokumentId } = useLocalSearchParams<{ dokumentId: string }>();

  const [extraktion, setExtraktion] = useState<Extraktion | null>(null);
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
    const id = Number(dokumentId);
    if (!Number.isFinite(id)) {
      setFehler('Kein Beleg angegeben.');
      return;
    }
    void ladeDokument(id).then((dok) => {
      if (!dok?.extraktionJson) {
        setFehler('Zu diesem Beleg liegt keine Auswertung vor.');
        return;
      }
      const e = JSON.parse(dok.extraktionJson) as Extraktion;
      setExtraktion(e);
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
    });
  }, [dokumentId]);

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

  async function uebernehmen() {
    if (!extraktion) return;
    if (!glaeubiger.trim()) {
      setFehler('Ohne Gläubiger lässt sich die Forderung nicht zuordnen. Trage den Absender ein.');
      return;
    }
    setSpeichert(true);
    setFehler(null);
    try {
      const glaeubigerId = await findeOderLegeGlaeubigerAn(glaeubiger, {
        vertrittFuer: vertrittFuer.trim() || null,
        adresse: extraktion.glaeubigerAdresse,
        istInkasso,
      });

      const forderungId = await speichereForderung({
        glaeubigerId,
        titel: titel.trim() || 'Forderung',
        typ: extraktion.forderungstyp,
        status: 'offen',
        betraege,
        aktenzeichen: aktenzeichen.trim() || null,
        entstandenAm: entstandenAm.trim() || null,
        faelligAm: faelligAm.trim() || null,
        fristBis: fristBis.trim() || null,
        istTituliert,
        tituliertAm: istTituliert ? (extraktion.briefdatum ?? null) : null,
        verjaehrungNeubeginnAm: null,
        verjaehrungGehemmtSeit: null,
        vorsatzVorgeworfen: false,
        notizen: null,
      });

      await verknuepfeDokument(Number(dokumentId), forderungId);
      router.back();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
    } finally {
      setSpeichert(false);
    }
  }

  if (fehler && !extraktion) {
    return (
      <View style={[stil.mitte, { backgroundColor: farben.hintergrund }]}>
        <Text style={[schrift.standard, { color: farben.text, textAlign: 'center' }]}>{fehler}</Text>
      </View>
    );
  }

  if (!extraktion) {
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
      {extraktion.auffaelligkeiten.length > 0 && (
        <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.hoch }]}>
          <Text style={[schrift.betont, { color: farben.hoch }]}>Aufgefallen beim Lesen</Text>
          {extraktion.auffaelligkeiten.map((a) => (
            <Text key={a} style={[schrift.klein, { color: farben.text, marginTop: abstand.s, lineHeight: 20 }]}>
              {a}
            </Text>
          ))}
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
