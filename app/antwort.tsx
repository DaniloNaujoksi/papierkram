import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as MailComposer from 'expo-mail-composer';
import {
  alleGlaeubiger,
  dokumenteZuForderung,
  forderung as ladeForderung,
  schreibenZuForderung,
  speichereSchreiben,
  vermerkeVersand,
  type Schreiben,
} from '../src/db/repo';
import { berechneVerjaehrung } from '../src/domain/verjaehrung';
import { pruefeInkassokosten } from '../src/domain/inkassokosten';
import { formatEuro, parseEuroZuCent } from '../src/domain/betraege';
import type { Forderung, Glaeubiger } from '../src/domain/types';
import {
  ABSICHTEN,
  erstelleAntwort,
  personalisiere,
  pruefeAbsicht,
  type Absicht,
  type AntwortEingabe,
} from '../src/services/antwort';
import { ClaudeFehler } from '../src/services/claude';
import { Feld } from '../src/ui/components/Feld';
import { Knopf } from '../src/ui/components/Knopf';
import { abstand, radius, schrift, useFarben } from '../src/ui/theme';

/** Absichten, die einen Betrag brauchen. */
const BRAUCHT_BETRAG: Absicht[] = ['ratenzahlung', 'vergleich'];

function briefAlsHtml(text: string): string {
  const sicher = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Bewusst nüchtern gesetzt: Ein Brief an einen Gläubiger soll wie ein Brief
  // aussehen, nicht wie ein App-Export.
  return `<html><head><meta charset="utf-8"><style>
    @page { margin: 25mm 20mm; }
    body { font-family: Georgia, "Times New Roman", serif; font-size: 11.5pt; line-height: 1.6; color: #000; }
    pre { font-family: inherit; font-size: inherit; white-space: pre-wrap; margin: 0; }
  </style></head><body><pre>${sicher}</pre></body></html>`;
}

export default function AntwortScreen() {
  const farben = useFarben();
  const { forderungId } = useLocalSearchParams<{ forderungId: string }>();

  const [forderung, setForderung] = useState<Forderung | null>(null);
  const [glaeubiger, setGlaeubiger] = useState<Glaeubiger | undefined>();
  const [eingabe, setEingabe] = useState<Omit<AntwortEingabe, 'absicht' | 'betragVorschlag'> | null>(null);
  const [frueher, setFrueher] = useState<Schreiben[]>([]);

  const [absicht, setAbsicht] = useState<Absicht | null>(null);
  const [betrag, setBetrag] = useState('');
  const [brief, setBrief] = useState<string | null>(null);
  const [schreibenId, setSchreibenId] = useState<number | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const id = Number(forderungId);
      void (async () => {
        const [f, liste, dokumente, alte] = await Promise.all([
          ladeForderung(id),
          alleGlaeubiger(),
          dokumenteZuForderung(id),
          schreibenZuForderung(id),
        ]);
        if (!f) return;
        const g = liste.find((x) => x.id === f.glaeubigerId);
        const verjaehrung = berechneVerjaehrung(f, new Date());
        const inkasso =
          g?.istInkasso && f.betraege.inkassokosten > 0
            ? pruefeInkassokosten({
                hauptforderung: f.betraege.hauptforderung,
                verlangteInkassokosten: f.betraege.inkassokosten,
                forderungBestritten: f.status === 'bestritten',
                ersteZahlungsaufforderung: dokumente.length <= 1,
                glaeubigerVorsteuerabzugsberechtigt: true,
              })
            : null;
        setForderung(f);
        setGlaeubiger(g);
        setEingabe({ forderung: f, glaeubiger: g, verjaehrung, inkasso });
        setFrueher(alte);
      })();
    }, [forderungId])
  );

  const warnung =
    eingabe && absicht
      ? pruefeAbsicht({ ...eingabe, absicht, betragVorschlag: parseEuroZuCent(betrag) })
      : null;

  async function schreiben() {
    if (!eingabe || !absicht || !forderung) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const roh = await erstelleAntwort({
        ...eingabe,
        absicht,
        betragVorschlag: parseEuroZuCent(betrag),
      });
      const fertig = await personalisiere(roh);
      const id = await speichereSchreiben({
        forderungId: forderung.id,
        absicht,
        text: fertig,
      });
      setBrief(fertig);
      setSchreibenId(id);
      setFrueher(await schreibenZuForderung(forderung.id));
    } catch (e) {
      setFehler(e instanceof ClaudeFehler ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setLaeuft(false);
    }
  }

  async function drucken() {
    if (!brief) return;
    await Print.printAsync({ html: briefAlsHtml(brief) });
    if (schreibenId) {
      await vermerkeVersand(schreibenId, 'gedruckt');
      setFrueher(await schreibenZuForderung(Number(forderungId)));
    }
  }

  async function alsPdf() {
    if (!brief) return;
    const { uri } = await Print.printToFileAsync({ html: briefAlsHtml(brief) });
    await MailComposer.composeAsync({
      recipients: glaeubiger?.email ? [glaeubiger.email] : [],
      subject: `${forderung?.aktenzeichen ? `Aktenzeichen ${forderung.aktenzeichen}` : 'Ihre Forderung'}`,
      body: brief,
      attachments: [uri],
    });
    if (schreibenId) {
      await vermerkeVersand(schreibenId, 'per E-Mail');
      setFrueher(await schreibenZuForderung(Number(forderungId)));
    }
  }

  if (!forderung || !eingabe) {
    return (
      <View style={[stil.mitte, { backgroundColor: farben.hintergrund }]}>
        <ActivityIndicator color={farben.akzent} />
      </View>
    );
  }

  // Gegen einen Mahnbescheid ist ein frei formulierter Brief das falsche Werkzeug:
  // Der Widerspruch läuft über das amtliche Formular, das dem Bescheid beiliegt.
  const istMahnbescheid = forderung.istTituliert;

  return (
    <ScrollView
      style={{ backgroundColor: farben.hintergrund }}
      contentContainerStyle={stil.inhalt}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
        <Text style={[schrift.winzig, { color: farben.akzent }]}>EMPFÄNGER</Text>
        <Text style={[schrift.betont, { color: farben.text, marginTop: abstand.s }]}>
          {glaeubiger?.name ?? 'Unbekannter Gläubiger'}
        </Text>
        {forderung.aktenzeichen && (
          <Text style={[schrift.klein, { color: farben.textGedaempft }]}>
            Aktenzeichen {forderung.aktenzeichen}
          </Text>
        )}
        {!glaeubiger?.adresse && (
          <Text style={[schrift.klein, { color: farben.hoch, marginTop: abstand.s, lineHeight: 20 }]}>
            Zu diesem Gläubiger ist keine Anschrift gespeichert. Der Brief bekommt dann keinen
            Empfängerblock — trag sie beim Bearbeiten der Forderung nach, sonst musst du sie beim
            Ausdrucken selbst ergänzen.
          </Text>
        )}
      </View>

      {istMahnbescheid && (
        <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.sofort }]}>
          <Text style={[schrift.winzig, { color: farben.sofort }]}>ACHTUNG</Text>
          <Text style={[schrift.klein, { color: farben.text, marginTop: abstand.s, lineHeight: 21 }]}>
            Diese Forderung ist tituliert. Gegen einen Mahnbescheid oder Vollstreckungsbescheid
            wirkt kein frei formulierter Brief — Widerspruch und Einspruch laufen ausschließlich
            über das amtliche Formular, das dem Bescheid beiliegt, und sind an kurze Fristen
            gebunden. Ein Schreiben hier ersetzt das nicht. Für Ratenzahlung oder Vergleich mit dem
            Gläubiger ist es dagegen der richtige Weg.
          </Text>
        </View>
      )}

      <Text style={[schrift.ueberschrift, { color: farben.text }]}>Was willst du erreichen?</Text>

      {ABSICHTEN.map((a) => {
        const gewaehlt = absicht === a.id;
        return (
          <Pressable
            key={a.id}
            onPress={() => {
              setAbsicht(a.id);
              setBrief(null);
              setFehler(null);
            }}
            style={({ pressed }) => [
              stil.wahl,
              {
                backgroundColor: farben.flaeche,
                borderColor: gewaehlt ? farben.akzent : farben.rand,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[schrift.betont, { color: gewaehlt ? farben.akzent : farben.text }]}>
              {a.titel}
            </Text>
            <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: 2, lineHeight: 20 }]}>
              {a.wirkung}
            </Text>
          </Pressable>
        );
      })}

      {warnung && (
        <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.sofort }]}>
          <Text style={[schrift.winzig, { color: farben.sofort }]}>DAS WÜRDE DIR SCHADEN</Text>
          <Text style={[schrift.klein, { color: farben.text, marginTop: abstand.s, lineHeight: 21 }]}>
            {warnung}
          </Text>
        </View>
      )}

      {absicht && BRAUCHT_BETRAG.includes(absicht) && (
        <Feld
          label={absicht === 'ratenzahlung' ? 'Monatliche Rate' : 'Einmalzahlung'}
          wert={betrag}
          onChange={setBetrag}
          tastatur="numeric"
          platzhalter="0,00"
          hinweis={
            absicht === 'ratenzahlung'
              ? 'Nimm einen Betrag, den du sicher jeden Monat aufbringst. Eine gerissene Rate schadet mehr als eine niedrige.'
              : 'Üblich sind 30 bis 50 Prozent der Gesamtforderung, wenn du sofort zahlen kannst.'
          }
        />
      )}

      {laeuft ? (
        <View style={stil.laden}>
          <ActivityIndicator color={farben.akzent} />
          <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.s }]}>
            Brief wird geschrieben…
          </Text>
        </View>
      ) : (
        <Knopf
          titel={brief ? 'Neu schreiben' : 'Brief erstellen'}
          onPress={() => void schreiben()}
          deaktiviert={!absicht}
        />
      )}

      {fehler && (
        <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.sofort }]}>
          <Text style={[schrift.klein, { color: farben.sofort, lineHeight: 21 }]}>{fehler}</Text>
        </View>
      )}

      {brief && (
        <>
          <View style={[stil.karte, { backgroundColor: farben.flaecheGedaempft, borderColor: farben.rand }]}>
            <Text style={[schrift.winzig, { color: farben.akzent }]}>ENTWURF</Text>
            <Text style={[stil.brieftext, { color: farben.text }]}>{brief}</Text>
          </View>

          <Text style={[schrift.klein, { color: farben.textGedaempft, lineHeight: 21 }]}>
            Lies ihn einmal durch, bevor er rausgeht. Es ist dein Brief, nicht meiner — und was
            drinsteht, gilt.
          </Text>

          <Knopf titel="Drucken" onPress={() => void drucken()} />
          <Knopf titel="Als PDF per E-Mail" art="tertiaer" onPress={() => void alsPdf()} />
        </>
      )}

      {frueher.length > 0 && (
        <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
          <Text style={[schrift.winzig, { color: farben.textGedaempft }]}>BISHER GESCHRIEBEN</Text>
          {frueher.map((s) => (
            <Text
              key={s.id}
              style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.s, lineHeight: 20 }]}
            >
              {new Date(s.erstelltAm).toLocaleDateString('de-DE')} —{' '}
              {ABSICHTEN.find((a) => a.id === s.absicht)?.titel ?? s.absicht}
              {s.versendetAm
                ? `, ${s.versandart} am ${new Date(s.versendetAm).toLocaleDateString('de-DE')}`
                : ', noch nicht verschickt'}
            </Text>
          ))}
        </View>
      )}

      <Knopf titel="Zurück zur Forderung" art="tertiaer" onPress={() => router.back()} />

      <Text style={[schrift.klein, { color: farben.niedrig, lineHeight: 20 }]}>
        Schick den Brief bei wichtigen Sachen als Einwurf-Einschreiben. Im Streit zählt nicht, was
        du geschrieben hast, sondern was du beweisen kannst.
      </Text>
    </ScrollView>
  );
}

const stil = StyleSheet.create({
  inhalt: { padding: abstand.m, paddingBottom: abstand.xxl, gap: abstand.s },
  mitte: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  karte: { padding: abstand.m, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth },
  wahl: { padding: abstand.m, borderRadius: radius.m, borderWidth: 1 },
  laden: { alignItems: 'center', paddingVertical: abstand.l },
  brieftext: { marginTop: abstand.m, fontSize: 13, lineHeight: 20 },
});
