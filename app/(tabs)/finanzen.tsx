import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { formatEuro, parseEuroZuCent } from '../../src/domain/betraege';
import { berechneStrategie, type Lage, type Strategieergebnis } from '../../src/domain/strategie';
import type { Haushaltszahlen } from '../../src/domain/strategie';
import { LEERER_HAUSHALT, leseHaushalt, speichereHaushalt } from '../../src/services/haushalt';
import { useUebersicht } from '../../src/ui/useUebersicht';
import { Feld } from '../../src/ui/components/Feld';
import { Knopf } from '../../src/ui/components/Knopf';
import { abstand, radius, schrift, useFarben, type Farben } from '../../src/ui/theme';

function lagenfarbe(lage: Lage, farben: Farben): string {
  switch (lage) {
    case 'nicht_tragbar': return farben.sofort;
    case 'angespannt': return farben.hoch;
    case 'unpfaendbar': return farben.akzent;
    case 'tragbar': return farben.akzent;
    default: return farben.textGedaempft;
  }
}

function centZuEingabe(cent: number | null): string {
  if (cent === null || cent === 0) return '';
  return (cent / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Ergebnis({ e }: { e: Strategieergebnis }) {
  const farben = useFarben();
  const farbe = lagenfarbe(e.lage, farben);

  return (
    <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farbe }]}>
      <Text style={[schrift.winzig, { color: farbe }]}>DEINE LAGE</Text>
      <Text style={[schrift.ueberschrift, { color: farben.text, marginTop: abstand.s }]}>
        {e.ueberschrift}
      </Text>
      <Text style={[schrift.standard, { color: farben.textGedaempft, marginTop: abstand.s, lineHeight: 24 }]}>
        {e.begruendung}
      </Text>

      <View style={[stil.trenner, { borderTopColor: farben.rand }]}>
        <Text style={[schrift.winzig, { color: farben.textGedaempft }]}>WAS JETZT ZU TUN IST</Text>
        {e.schritte.map((s, i) => (
          <View key={s} style={stil.schrittZeile}>
            <Text style={[schrift.betont, { color: farbe, width: 26 }]}>{i + 1}</Text>
            <Text style={[schrift.klein, { color: farben.text, flex: 1, lineHeight: 21 }]}>{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function FinanzenScreen() {
  const farben = useFarben();
  const { gesamtOffen } = useUebersicht();

  const [h, setH] = useState<Haushaltszahlen>(LEERER_HAUSHALT);
  const [einkommen, setEinkommen] = useState('');
  const [fixkosten, setFixkosten] = useState('');
  const [lebenshaltung, setLebenshaltung] = useState('');
  const [personen, setPersonen] = useState('');
  const [freibetrag, setFreibetrag] = useState('');
  const [erhoehung, setErhoehung] = useState('');
  const [gespeichert, setGespeichert] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void leseHaushalt().then((geladen) => {
        setH(geladen);
        setEinkommen(centZuEingabe(geladen.nettoeinkommenMonat));
        setFixkosten(centZuEingabe(geladen.fixkostenMonat));
        setLebenshaltung(centZuEingabe(geladen.lebenshaltungMonat));
        setPersonen(geladen.unterhaltspflichtigePersonen ? String(geladen.unterhaltspflichtigePersonen) : '');
        setFreibetrag(centZuEingabe(geladen.pfaendungsfreibetragMonat));
        setErhoehung(centZuEingabe(geladen.erhoehungJePersonMonat));
      });
    }, [])
  );

  // Live rechnen, damit man beim Tippen sieht, wie sich die Lage verschiebt.
  const aktuell: Haushaltszahlen = {
    nettoeinkommenMonat: parseEuroZuCent(einkommen) ?? 0,
    fixkostenMonat: parseEuroZuCent(fixkosten) ?? 0,
    lebenshaltungMonat: parseEuroZuCent(lebenshaltung) ?? 0,
    unterhaltspflichtigePersonen: Number.parseInt(personen, 10) || 0,
    pfaendungsfreibetragMonat: parseEuroZuCent(freibetrag),
    erhoehungJePersonMonat: parseEuroZuCent(erhoehung),
  };

  const ergebnis = berechneStrategie(aktuell, gesamtOffen);

  async function sichern() {
    await speichereHaushalt(aktuell);
    setH(aktuell);
    setGespeichert(true);
  }

  return (
    <ScrollView
      style={{ backgroundColor: farben.hintergrund }}
      contentContainerStyle={stil.inhalt}
      keyboardShouldPersistTaps="handled"
    >
      <Ergebnis e={ergebnis} />

      <View style={stil.kennzahlen}>
        <View style={[stil.kennzahl, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
          <Text style={[schrift.winzig, { color: farben.textGedaempft }]}>MONATLICH FREI</Text>
          <Text
            style={[
              schrift.ueberschrift,
              { color: ergebnis.verfuegbarMonat > 0 ? farben.akzent : farben.sofort, marginTop: 2 },
            ]}
          >
            {formatEuro(ergebnis.verfuegbarMonat)}
          </Text>
        </View>
        <View style={[stil.kennzahl, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
          <Text style={[schrift.winzig, { color: farben.textGedaempft }]}>OFFENE SCHULDEN</Text>
          <Text style={[schrift.ueberschrift, { color: farben.text, marginTop: 2 }]}>
            {formatEuro(gesamtOffen)}
          </Text>
        </View>
      </View>

      <Text style={[schrift.ueberschrift, { color: farben.text, marginTop: abstand.m }]}>
        Was reinkommt und rausgeht
      </Text>
      <Feld
        label="Netto im Monat"
        wert={einkommen}
        onChange={(w) => { setEinkommen(w); setGespeichert(false); }}
        tastatur="numeric"
        platzhalter="0,00"
        hinweis="Alles, was tatsächlich ankommt: Lohn, Rente, Bürgergeld, Kindergeld, Unterhalt."
      />
      <Feld
        label="Feste Kosten im Monat"
        wert={fixkosten}
        onChange={(w) => { setFixkosten(w); setGespeichert(false); }}
        tastatur="numeric"
        platzhalter="0,00"
        hinweis="Miete, Strom, Heizung, Versicherungen, Handy, Fahrtkosten, laufender Unterhalt."
      />
      <Feld
        label="Lebenshaltung im Monat"
        wert={lebenshaltung}
        onChange={(w) => { setLebenshaltung(w); setGespeichert(false); }}
        tastatur="numeric"
        platzhalter="0,00"
        hinweis="Essen, Kleidung, Hygiene, alles Alltägliche. Schätz ehrlich statt sparsam — eine Rate, die du nicht hältst, schadet mehr als eine niedrige."
      />

      <Text style={[schrift.ueberschrift, { color: farben.text, marginTop: abstand.m }]}>
        Pfändungsschutz
      </Text>
      <View style={[stil.hinweiskarte, { backgroundColor: farben.flaecheGedaempft, borderColor: farben.rand }]}>
        <Text style={[schrift.klein, { color: farben.textGedaempft, lineHeight: 21 }]}>
          Bis zu einem bestimmten Betrag darf niemand dein Einkommen pfänden — auch mit Titel nicht.
          Diese Grenze wird jedes Jahr zum 1. Juli neu festgesetzt. Sie steht hier nicht fest im
          Programm, weil ein veralteter Wert die Empfehlung ins Gegenteil verkehren würde. Den
          aktuellen Betrag findest du unter dem Stichwort „Pfändungsfreigrenzenbekanntmachung“ oder
          bei jeder Schuldnerberatung.
        </Text>
      </View>
      <Feld
        label="Grundfreibetrag im Monat"
        wert={freibetrag}
        onChange={(w) => { setFreibetrag(w); setGespeichert(false); }}
        tastatur="numeric"
        platzhalter="Leer lassen, wenn unbekannt"
        hinweis="Für Alleinstehende ohne Unterhaltspflichten, nach § 850c ZPO."
      />
      <Feld
        label="Personen, denen du Unterhalt schuldest"
        wert={personen}
        onChange={(w) => { setPersonen(w); setGespeichert(false); }}
        tastatur="numeric"
        platzhalter="0"
      />
      <Feld
        label="Erhöhung je Person im Monat"
        wert={erhoehung}
        onChange={(w) => { setErhoehung(w); setGespeichert(false); }}
        tastatur="numeric"
        platzhalter="Leer lassen, wenn unbekannt"
        hinweis="Steht in derselben Bekanntmachung. Der erste Unterhaltsberechtigte zählt anders als die weiteren — im Zweifel den kleineren Wert nehmen, dann rechnet die App vorsichtiger."
      />

      {ergebnis.unpfaendbarMindestens !== null && (
        <View style={[stil.hinweiskarte, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
          <Text style={[schrift.klein, { color: farben.textGedaempft, lineHeight: 21 }]}>
            Nach deinen Angaben sind mindestens{' '}
            <Text style={{ color: farben.akzent }}>{formatEuro(ergebnis.unpfaendbarMindestens)}</Text>{' '}
            im Monat unpfändbar. Der tatsächliche Schutz ist eher höher: Oberhalb dieser Grenze
            bleibt nach der amtlichen Tabelle ein Teil des Mehrverdienstes ebenfalls unangetastet.
            Die App rechnet hier bewusst vorsichtig.
          </Text>
        </View>
      )}

      <Knopf
        titel={gespeichert ? 'Gespeichert' : 'Speichern'}
        onPress={() => void sichern()}
        style={{ marginTop: abstand.s }}
      />

      {/* Die Lage oben rechnet nur mit Zahlen. Der Schritt darüber — welche Briefe
          zusammengehören, was sich wiederholt, was übersehen wurde — braucht die
          Texte selbst und liegt deshalb auf einem eigenen Schirm. */}
      <View style={[stil.hinweiskarte, { backgroundColor: farben.flaeche, borderColor: farben.akzent, marginTop: abstand.m }]}>
        <Text style={[schrift.winzig, { color: farben.akzent }]}>ALLES AUF EINMAL</Text>
        <Text style={[schrift.betont, { color: farben.text, marginTop: abstand.s }]}>
          Tiefenanalyse über alle Vorgänge
        </Text>
        <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.s, lineHeight: 21 }]}>
          Schickt alle erfassten Schreiben zusammen zur Auswertung — anonymisiert wie beim Scannen.
          Sucht Zusammenhänge zwischen den Briefen, Muster und Übersehenes, und schlägt eine
          Reihenfolge für die nächsten zwei Wochen vor.
        </Text>
        <Knopf
          titel="Tiefenanalyse öffnen"
          art="tertiaer"
          onPress={() => router.push('/analyse')}
          style={{ marginTop: abstand.m }}
        />
      </View>

      <Text style={[schrift.klein, { color: farben.niedrig, lineHeight: 20, marginTop: abstand.s }]}>
        Diese Rechnung ersetzt keine Beratung. Sie zeigt dir, welche Frage du dort stellen musst —
        und mit welchen Zahlen du hingehst.
      </Text>
    </ScrollView>
  );
}

const stil = StyleSheet.create({
  inhalt: { padding: abstand.m, paddingBottom: abstand.xxl, gap: abstand.s },
  karte: { padding: abstand.m, borderRadius: radius.m, borderWidth: 1 },
  trenner: { marginTop: abstand.m, paddingTop: abstand.m, borderTopWidth: StyleSheet.hairlineWidth },
  schrittZeile: { flexDirection: 'row', marginTop: abstand.s },
  kennzahlen: { flexDirection: 'row', gap: abstand.s },
  kennzahl: { flex: 1, padding: abstand.m, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth },
  hinweiskarte: {
    padding: abstand.m,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: abstand.m,
  },
});
