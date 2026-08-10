import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Directory, File, Paths } from 'expo-file-system';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { bereinigeOcrText, erkenneText } from '../../src/services/ocr';
import { anonymisiere, type AnonymisierungsErgebnis } from '../../src/services/anonymizer';
import { lesePersoenlicheDaten } from '../../src/services/persoenlicheDaten';
import { ClaudeFehler, extrahiere } from '../../src/services/claude';
import { speichereDokument } from '../../src/db/repo';
import { abstand, radius, schrift, useFarben } from '../../src/ui/theme';

type Schritt = 'bereit' | 'ocr' | 'vorschau' | 'auswertung';

const BELEG_ORDNER = 'belege';

/** Legt den Scan dauerhaft im App-Ordner ab. Von dort wird er nie hochgeladen. */
function sichereScan(temporaerePfad: string): string {
  const ordner = new Directory(Paths.document, BELEG_ORDNER);
  if (!ordner.exists) ordner.create();

  const endung = temporaerePfad.split('.').pop() ?? 'jpg';
  const dateiname = `beleg-${Date.now()}.${endung}`;

  new File(temporaerePfad).copy(new File(ordner, dateiname));
  return dateiname;
}

export default function ScanScreen() {
  const farben = useFarben();
  const [schritt, setSchritt] = useState<Schritt>('bereit');
  const [bildPfad, setBildPfad] = useState<string | null>(null);
  const [dateiname, setDateiname] = useState<string | null>(null);
  const [rohtext, setRohtext] = useState('');
  const [anonym, setAnonym] = useState<AnonymisierungsErgebnis | null>(null);
  const [ocrWarnung, setOcrWarnung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  function zuruecksetzen() {
    setSchritt('bereit');
    setBildPfad(null);
    setDateiname(null);
    setRohtext('');
    setAnonym(null);
    setOcrWarnung(null);
    setFehler(null);
  }

  async function scannen() {
    setFehler(null);
    try {
      const { scannedImages } = await DocumentScanner.scanDocument({ maxNumDocuments: 1 });
      const pfad = scannedImages?.[0];
      if (!pfad) return;

      setBildPfad(pfad);
      setSchritt('ocr');

      const gespeichert = sichereScan(pfad);
      setDateiname(gespeichert);

      const ergebnis = await erkenneText(pfad);
      const text = bereinigeOcrText(ergebnis.text);
      setRohtext(text);
      setOcrWarnung(ergebnis.warnung);

      const daten = await lesePersoenlicheDaten();
      setAnonym(anonymisiere(text, daten));
      setSchritt('vorschau');
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
      setSchritt('bereit');
    }
  }

  async function auswerten() {
    if (!anonym || !dateiname) return;
    setSchritt('auswertung');
    setFehler(null);

    // Die Auswertung kann scheitern — der Scan darf das nicht. Deshalb wird das
    // Dokument in beiden Fällen genau einmal gespeichert, nur mit oder ohne Ergebnis.
    let extraktion: Awaited<ReturnType<typeof extrahiere>> | null = null;
    let auswertungsFehler: string | null = null;
    try {
      extraktion = await extrahiere(anonym.text);
    } catch (e) {
      auswertungsFehler =
        e instanceof ClaudeFehler ? e.message : e instanceof Error ? e.message : String(e);
    }

    try {
      const dokumentId = await speichereDokument({
        forderungId: null,
        dateiname,
        typ: extraktion?.dokumenttyp ?? 'sonstiges',
        briefdatum: extraktion?.briefdatum ?? null,
        ocrText: rohtext,
        gesendeterText: anonym.text,
        extraktionJson: extraktion ? JSON.stringify(extraktion) : null,
      });

      if (extraktion) {
        router.push({ pathname: '/pruefen', params: { dokumentId: String(dokumentId) } });
        zuruecksetzen();
        return;
      }
    } catch (e) {
      auswertungsFehler = `Der Beleg konnte nicht gespeichert werden: ${
        e instanceof Error ? e.message : String(e)
      }`;
    }

    setFehler(auswertungsFehler);
    setSchritt('vorschau');
  }

  return (
    <ScrollView
      style={{ backgroundColor: farben.hintergrund }}
      contentContainerStyle={stil.inhalt}
    >
      {schritt === 'bereit' && (
        <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
          <Text style={[schrift.ueberschrift, { color: farben.text }]}>Brief abfotografieren</Text>
          <Text style={[schrift.standard, { color: farben.textGedaempft, marginTop: abstand.s, lineHeight: 23 }]}>
            Der Scanner schneidet das Blatt automatisch frei. Leg den Brief flach hin, sorg für
            gleichmäßiges Licht und halte das Handy parallel über die Seite.
          </Text>
          <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.m, lineHeight: 20 }]}>
            Die Aufnahme bleibt auf diesem Gerät. Erkannt wird der Text hier auf dem iPhone;
            zur Auswertung geht nur der anonymisierte Text hinaus, den du vorher zu sehen bekommst.
          </Text>
        </View>
      )}

      {bildPfad && (
        <Image
          source={{ uri: bildPfad }}
          style={[stil.vorschaubild, { borderColor: farben.rand }]}
          resizeMode="contain"
        />
      )}

      {schritt === 'ocr' && (
        <View style={stil.laden}>
          <ActivityIndicator color={farben.akzent} />
          <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.s }]}>
            Text wird auf dem Gerät erkannt…
          </Text>
        </View>
      )}

      {schritt === 'vorschau' && anonym && (
        <>
          {ocrWarnung && (
            <View style={[stil.karte, { backgroundColor: farben.flaecheGedaempft, borderColor: farben.rand }]}>
              <Text style={[schrift.klein, { color: farben.text, lineHeight: 20 }]}>{ocrWarnung}</Text>
            </View>
          )}

          {anonym.warnungen.length > 0 && (
            <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.sofort }]}>
              <Text style={[schrift.betont, { color: farben.sofort }]}>Achtung vor dem Senden</Text>
              {anonym.warnungen.map((w) => (
                <Text key={w} style={[schrift.klein, { color: farben.text, marginTop: abstand.s, lineHeight: 20 }]}>
                  {w}
                </Text>
              ))}
            </View>
          )}

          <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
            <Text style={[schrift.betont, { color: farben.text }]}>Das geht hinaus</Text>
            {anonym.ersetzungen.length > 0 ? (
              <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.xs }]}>
                Entfernt: {anonym.ersetzungen.map((e) => `${e.kategorie} (${e.anzahl}×)`).join(', ')}
              </Text>
            ) : (
              <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.xs }]}>
                Es wurde nichts entfernt — im Text stand offenbar keine deiner hinterlegten Angaben.
              </Text>
            )}
            <Text
              style={[
                stil.textblock,
                { color: farben.text, backgroundColor: farben.flaecheGedaempft, borderColor: farben.rand },
              ]}
            >
              {anonym.text}
            </Text>
          </View>

          {fehler && (
            <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.sofort }]}>
              <Text style={[schrift.klein, { color: farben.sofort, lineHeight: 20 }]}>{fehler}</Text>
            </View>
          )}

          <Pressable
            onPress={() => void auswerten()}
            style={({ pressed }) => [stil.knopf, { backgroundColor: farben.akzent, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[schrift.betont, { color: farben.akzentText }]}>Auswerten</Text>
          </Pressable>

          <Pressable onPress={zuruecksetzen} style={stil.knopfFlach}>
            <Text style={[schrift.standard, { color: farben.textGedaempft }]}>Verwerfen und neu scannen</Text>
          </Pressable>
        </>
      )}

      {schritt === 'auswertung' && (
        <View style={stil.laden}>
          <ActivityIndicator color={farben.akzent} />
          <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.s }]}>
            Brief wird ausgewertet…
          </Text>
        </View>
      )}

      {schritt === 'bereit' && (
        <>
          {fehler && (
            <Text style={[schrift.klein, { color: farben.sofort, lineHeight: 20 }]}>{fehler}</Text>
          )}
          <Pressable
            onPress={() => void scannen()}
            style={({ pressed }) => [stil.knopf, { backgroundColor: farben.akzent, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[schrift.betont, { color: farben.akzentText }]}>Scanner öffnen</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const stil = StyleSheet.create({
  inhalt: { padding: abstand.l, gap: abstand.m },
  karte: { padding: abstand.l, borderRadius: radius.l, borderWidth: StyleSheet.hairlineWidth },
  vorschaubild: {
    width: '100%',
    height: 220,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
  },
  textblock: {
    marginTop: abstand.m,
    padding: abstand.m,
    borderRadius: radius.s,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 13,
    lineHeight: 19,
  },
  laden: { alignItems: 'center', paddingVertical: abstand.xl },
  knopf: { paddingVertical: abstand.l, borderRadius: radius.m, alignItems: 'center' },
  knopfFlach: { paddingVertical: abstand.m, alignItems: 'center' },
});
