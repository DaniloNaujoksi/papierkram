import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { alleGesendetenTexte, letzteAnalyse, speichereAnalyse, type Analyse } from '../src/db/repo';
import { formatEuro } from '../src/domain/betraege';
import { berechneStrategie } from '../src/domain/strategie';
import { leseHaushalt } from '../src/services/haushalt';
import { baueEingabe, erstelleTiefenanalyse } from '../src/services/metaanalyse';
import { ClaudeFehler } from '../src/services/claude';
import { useUebersicht } from '../src/ui/useUebersicht';
import { Knopf } from '../src/ui/components/Knopf';
import { abstand, radius, schrift, useFarben } from '../src/ui/theme';

/**
 * Zeigt die Zeilen aus der Antwort. Überschriften mit Rautenzeichen und
 * Aufzählungspunkte werden erkannt, alles andere bleibt Fließtext — bewusst
 * schlicht statt einer vollen Markdown-Bibliothek für vier Zeichenarten.
 */
function Antworttext({ text }: { text: string }) {
  const farben = useFarben();

  return (
    <View style={{ gap: abstand.s }}>
      {text.split('\n').map((zeile, i) => {
        const roh = zeile.trim();
        if (!roh) return null;

        if (roh.startsWith('###') || roh.startsWith('##') || roh.startsWith('#')) {
          const ohne = roh.replace(/^#+\s*/, '');
          return (
            <Text
              key={i}
              style={[schrift.ueberschrift, { color: farben.akzent, marginTop: abstand.m }]}
            >
              {ohne}
            </Text>
          );
        }

        if (/^(\d+\.|[-*•])\s/.test(roh)) {
          return (
            <View key={i} style={stil.punktZeile}>
              <Text style={[schrift.standard, { color: farben.akzent, width: 20 }]}>
                {/^\d/.test(roh) ? roh.split('.')[0] : '·'}
              </Text>
              <Text style={[schrift.standard, { color: farben.text, flex: 1, lineHeight: 24 }]}>
                {roh.replace(/^(\d+\.|[-*•])\s*/, '').replace(/\*\*/g, '')}
              </Text>
            </View>
          );
        }

        return (
          <Text key={i} style={[schrift.standard, { color: farben.text, lineHeight: 25 }]}>
            {roh.replace(/\*\*/g, '')}
          </Text>
        );
      })}
    </View>
  );
}

export default function AnalyseScreen() {
  const farben = useFarben();
  const { eintraege, gesamtOffen } = useUebersicht();

  const [vorhanden, setVorhanden] = useState<Analyse | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void letzteAnalyse().then(setVorhanden);
    }, [])
  );

  async function sammleEingabe() {
    const [haushalt, briefe] = await Promise.all([leseHaushalt(), alleGesendetenTexte()]);
    const strategie = berechneStrategie(haushalt, gesamtOffen);
    return { eintraege, strategie, briefe };
  }

  async function zeigeVorschau() {
    setFehler(null);
    const eingabe = await sammleEingabe();
    setVorschau(baueEingabe(eingabe));
  }

  async function starten() {
    setLaeuft(true);
    setFehler(null);
    try {
      const eingabe = await sammleEingabe();
      const ergebnis = await erstelleTiefenanalyse(eingabe);
      await speichereAnalyse({
        text: ergebnis.text,
        gesendeterText: ergebnis.gesendeterText,
        anzahlBelege: eingabe.briefe.length,
        summeOffen: gesamtOffen,
      });
      setVorhanden(await letzteAnalyse());
      setVorschau(null);
    } catch (e) {
      setFehler(e instanceof ClaudeFehler ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setLaeuft(false);
    }
  }

  async function teilen() {
    if (!vorhanden) return;
    await Share.share({
      title: 'Papierkram — Tiefenanalyse',
      message: vorhanden.text,
    });
  }

  return (
    <ScrollView style={{ backgroundColor: farben.hintergrund }} contentContainerStyle={stil.inhalt}>
      <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
        <Text style={[schrift.winzig, { color: farben.akzent }]}>ALLES AUF EINMAL</Text>
        <Text style={[schrift.ueberschrift, { color: farben.text, marginTop: abstand.s }]}>
          Das große Ganze
        </Text>
        <Text style={[schrift.standard, { color: farben.textGedaempft, marginTop: abstand.s, lineHeight: 24 }]}>
          Bisher wurde jeder Brief für sich gelesen. Hier gehen alle zusammen raus — mit den
          gerechneten Werten und deiner Haushaltslage. Gesucht wird, was in keinem einzelnen
          Schreiben steht: welche Briefe derselbe Vorgang sind, wo sich etwas wiederholt und was
          bei der Erfassung untergegangen ist.
        </Text>
        <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.m, lineHeight: 21 }]}>
          Es gehen dieselben anonymisierten Texte hinaus wie beim Scannen — Name, Anschrift,
          Geburtsdatum und Bankverbindung sind bereits durch Platzhalter ersetzt. Kein Bild.
        </Text>
      </View>

      <View style={stil.kennzahlen}>
        <View style={[stil.kennzahl, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
          <Text style={[schrift.ueberschrift, { color: farben.text }]}>{eintraege.length}</Text>
          <Text style={[schrift.winzig, { color: farben.textGedaempft }]}>FORDERUNGEN</Text>
        </View>
        <View style={[stil.kennzahl, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
          <Text style={[schrift.ueberschrift, { color: farben.text }]}>{formatEuro(gesamtOffen)}</Text>
          <Text style={[schrift.winzig, { color: farben.textGedaempft }]}>OFFEN</Text>
        </View>
      </View>

      {fehler && (
        <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.sofort }]}>
          <Text style={[schrift.klein, { color: farben.sofort, lineHeight: 21 }]}>{fehler}</Text>
        </View>
      )}

      {laeuft ? (
        <View style={stil.laden}>
          <ActivityIndicator color={farben.akzent} />
          <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.s, textAlign: 'center' }]}>
            Alle Vorgänge werden zusammen gelesen. Das dauert länger als ein einzelner Brief —
            eine bis zwei Minuten sind normal.
          </Text>
        </View>
      ) : (
        <>
          <Knopf
            titel={vorhanden ? 'Neu analysieren' : 'Tiefenanalyse starten'}
            onPress={() => void starten()}
            deaktiviert={eintraege.length === 0}
          />
          <Knopf
            titel={vorschau ? 'Vorschau schließen' : 'Vorher ansehen, was rausgeht'}
            art="tertiaer"
            onPress={() => (vorschau ? setVorschau(null) : void zeigeVorschau())}
            deaktiviert={eintraege.length === 0}
          />
        </>
      )}

      {eintraege.length === 0 && (
        <Text style={[schrift.klein, { color: farben.textGedaempft, lineHeight: 21 }]}>
          Dafür braucht es mindestens eine erfasste Forderung.
        </Text>
      )}

      {vorschau && (
        <View style={[stil.karte, { backgroundColor: farben.flaecheGedaempft, borderColor: farben.rand }]}>
          <Text style={[schrift.winzig, { color: farben.akzent }]}>DAS UND SONST NICHTS</Text>
          <Text style={[stil.rohtext, { color: farben.text }]}>{vorschau}</Text>
        </View>
      )}

      {vorhanden && (
        <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
          <Text style={[schrift.winzig, { color: farben.textGedaempft }]}>
            {new Date(vorhanden.erstelltAm).toLocaleDateString('de-DE', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
            {' · '}
            {vorhanden.anzahlBelege === 1 ? '1 Schreiben' : `${vorhanden.anzahlBelege} Schreiben`}
            {' · '}
            {formatEuro(vorhanden.summeOffen)}
          </Text>
          <View style={{ marginTop: abstand.m }}>
            <Antworttext text={vorhanden.text} />
          </View>
        </View>
      )}

      {vorhanden && (
        <Knopf titel="Als Text teilen" art="tertiaer" onPress={() => void teilen()} />
      )}

      {vorhanden && (
        <Text style={[schrift.klein, { color: farben.niedrig, lineHeight: 20 }]}>
          Diese Einschätzung ist keine Rechtsberatung. Sie eignet sich gut als Grundlage für einen
          Termin bei einer anerkannten Schuldnerberatung — teilen, ausdrucken, mitnehmen.
        </Text>
      )}
    </ScrollView>
  );
}

const stil = StyleSheet.create({
  inhalt: { padding: abstand.m, paddingBottom: abstand.xxl, gap: abstand.s },
  karte: { padding: abstand.m, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth },
  kennzahlen: { flexDirection: 'row', gap: abstand.s },
  kennzahl: { flex: 1, padding: abstand.m, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth },
  laden: { alignItems: 'center', paddingVertical: abstand.xl, paddingHorizontal: abstand.m },
  punktZeile: { flexDirection: 'row', gap: abstand.s },
  rohtext: { marginTop: abstand.m, fontSize: 12, lineHeight: 18 },
});
