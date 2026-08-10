import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { schreibeEinstellung } from '../src/db/repo';
import { Knopf } from '../src/ui/components/Knopf';
import { abstand, radius, schrift, useFarben } from '../src/ui/theme';

export const SCHLUESSEL_ONBOARDING = 'onboarding_gesehen';

const SCHRITTE: Array<{ nummer: string; titel: string; text: string }> = [
  {
    nummer: '01',
    titel: 'Scannen',
    text: 'Brief abfotografieren. Der Text wird auf dem Gerät gelesen — das Foto verlässt dein iPhone nie.',
  },
  {
    nummer: '02',
    titel: 'Verstehen',
    text: 'Wer will was, wie viel davon ist Hauptforderung und wie viel aufgeschlagene Kosten.',
  },
  {
    nummer: '03',
    titel: 'Priorisieren',
    text: 'Sortiert nach Schadenspotenzial, nicht nach Lautstärke. Inkassobüros schreiben in Großbuchstaben und können wenig. Das Amtsgericht schreibt höflich.',
  },
  {
    nummer: '04',
    titel: 'Handeln',
    text: 'Zu jeder Forderung ein konkreter nächster Schritt — mit Frist, Paragraf und Begründung.',
  },
];

export default function WillkommenScreen() {
  const farben = useFarben();

  async function starten() {
    await schreibeEinstellung(SCHLUESSEL_ONBOARDING, 'ja');
    router.replace('/');
  }

  return (
    <ScrollView
      style={{ backgroundColor: farben.hintergrund }}
      contentContainerStyle={stil.inhalt}
    >
      <View style={stil.kopf}>
        <Text style={[schrift.riesig, { color: farben.text }]}>PAPIERKRAM</Text>
        <Text style={[schrift.riesig, { color: farben.akzent, marginTop: -8 }]}>UNFUCKER</Text>
        <View style={[stil.streifen, { backgroundColor: farben.signal }]}>
          <Text style={[schrift.betont, { color: '#FFFFFF' }]}>Weniger Stress. Mehr Leben.</Text>
        </View>
      </View>

      <Text style={[schrift.standard, { color: farben.textGedaempft, lineHeight: 24 }]}>
        Briefe werden nicht schlimmer, wenn man sie aufmacht. Nur der Stapel wird höher, wenn man
        es lässt. Diese App macht aus dem Stapel eine Liste, aus der Liste eine Reihenfolge — und
        aus der Reihenfolge den einen Schritt, der als Nächstes dran ist.
      </Text>

      <View style={stil.schritte}>
        {SCHRITTE.map((s) => (
          <View
            key={s.nummer}
            style={[stil.schritt, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}
          >
            <Text style={[schrift.winzig, { color: farben.akzent }]}>{s.nummer}</Text>
            <Text style={[schrift.betont, { color: farben.text, marginTop: abstand.xs }]}>
              {s.titel}
            </Text>
            <Text
              style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.xs, lineHeight: 20 }]}
            >
              {s.text}
            </Text>
          </View>
        ))}
      </View>

      <View style={[stil.hinweis, { borderColor: farben.rand }]}>
        <Text style={[schrift.winzig, { color: farben.akzent }]}>WAS DAS GERÄT NICHT VERLÄSST</Text>
        <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.s, lineHeight: 20 }]}>
          Scans, Beträge und Gläubiger bleiben lokal. Zur Auswertung geht ausschließlich der
          Brieftext hinaus, aus dem vorher Name, Anschrift, Geburtsdatum, Bankverbindung und
          Kennnummern entfernt wurden. Was gesendet wird, siehst du vorher im Wortlaut.
        </Text>
      </View>

      <Knopf titel="Los geht's" onPress={() => void starten()} style={{ marginTop: abstand.s }} />

      <Text style={[schrift.klein, { color: farben.niedrig, textAlign: 'center', lineHeight: 19 }]}>
        Keine Rechtsberatung. Für eine Privatinsolvenz brauchst du die Bescheinigung einer
        anerkannten Schuldnerberatung — die ist kostenlos, und mit diesen Daten bist du dort
        in einem Bruchteil der Zeit durch.
      </Text>
    </ScrollView>
  );
}

const stil = StyleSheet.create({
  inhalt: { padding: abstand.l, paddingBottom: abstand.xxl, gap: abstand.m },
  kopf: { marginTop: abstand.l, marginBottom: abstand.s },
  streifen: {
    alignSelf: 'flex-start',
    marginTop: abstand.m,
    paddingHorizontal: abstand.m,
    paddingVertical: abstand.s,
    borderRadius: radius.s,
  },
  schritte: { gap: abstand.s },
  schritt: {
    padding: abstand.m,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hinweis: {
    padding: abstand.m,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
