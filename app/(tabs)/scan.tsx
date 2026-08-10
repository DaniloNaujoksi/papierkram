import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Directory, File, Paths } from 'expo-file-system';
import { Knopf } from '../../src/ui/components/Knopf';
import { bereinigeOcrText, erkenneText, ocrVerfuegbar } from '../../src/services/ocr';
import { scanneSeite, scannerVerfuegbar } from '../../src/services/scanner';
import { anonymisiere, type AnonymisierungsErgebnis } from '../../src/services/anonymizer';
import { lesePersoenlicheDaten } from '../../src/services/persoenlicheDaten';
import { ClaudeFehler, extrahiere } from '../../src/services/claude';
import { speichereDokument } from '../../src/db/repo';
import { abstand, radius, schrift, useFarben } from '../../src/ui/theme';

type Schritt = 'bereit' | 'ocr' | 'vorschau' | 'auswertung';

const BELEG_ORDNER = 'belege';

/** Kennzeichnet Forderungen, die ohne Foto erfasst wurden. */
const OHNE_BELEG = '(ohne Beleg)';

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
  const kameraMoeglich = scannerVerfuegbar() && ocrVerfuegbar();

  const [schritt, setSchritt] = useState<Schritt>('bereit');
  const [bildPfad, setBildPfad] = useState<string | null>(null);
  const [dateiname, setDateiname] = useState<string>(OHNE_BELEG);
  const [rohtext, setRohtext] = useState('');
  const [eingegebenerText, setEingegebenerText] = useState('');
  const [anonym, setAnonym] = useState<AnonymisierungsErgebnis | null>(null);
  const [ocrWarnung, setOcrWarnung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  function zuruecksetzen() {
    setSchritt('bereit');
    setBildPfad(null);
    setDateiname(OHNE_BELEG);
    setRohtext('');
    setEingegebenerText('');
    setAnonym(null);
    setOcrWarnung(null);
    setFehler(null);
  }

  /** Gemeinsamer Schritt beider Wege: Text anonymisieren und zur Freigabe anzeigen. */
  async function zurVorschau(text: string) {
    setRohtext(text);
    const daten = await lesePersoenlicheDaten();
    setAnonym(anonymisiere(text, daten));
    setSchritt('vorschau');
  }

  async function scannen() {
    setFehler(null);
    try {
      const pfad = await scanneSeite();
      if (!pfad) return;

      setBildPfad(pfad);
      setSchritt('ocr');
      setDateiname(sichereScan(pfad));

      const ergebnis = await erkenneText(pfad);
      setOcrWarnung(ergebnis.warnung);
      await zurVorschau(bereinigeOcrText(ergebnis.text));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
      setSchritt('bereit');
    }
  }

  async function textUebernehmen() {
    if (eingegebenerText.trim().length < 30) {
      setFehler('Der Text ist zu kurz für eine sinnvolle Auswertung.');
      return;
    }
    setFehler(null);
    setDateiname(OHNE_BELEG);
    await zurVorschau(bereinigeOcrText(eingegebenerText));
  }

  async function auswerten() {
    if (!anonym) return;
    setSchritt('auswertung');
    setFehler(null);

    // Die Auswertung kann scheitern — der Beleg darf das nicht. Deshalb wird das
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
      keyboardShouldPersistTaps="handled"
    >
      {schritt === 'bereit' && (
        <>
          {kameraMoeglich ? (
            <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
              <Text style={[schrift.winzig, { color: farben.akzent }]}>BRIEF AUFMACHEN</Text>
              <Text style={[schrift.ueberschrift, { color: farben.text, marginTop: abstand.s }]}>
                Er kann dich nicht beißen
              </Text>
              <Text style={[schrift.standard, { color: farben.textGedaempft, marginTop: abstand.s, lineHeight: 23 }]}>
                Flach hinlegen, Licht drauf, Handy parallel drüber. Den Rest macht der Scanner —
                er schneidet das Blatt selbst frei.
              </Text>
              <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.m, lineHeight: 20 }]}>
                Das Foto bleibt hier. Der Text wird auf dem iPhone erkannt, und was zur Auswertung
                rausgeht, liest du vorher Wort für Wort.
              </Text>
            </View>
          ) : (
            <View style={[stil.karte, { backgroundColor: farben.flaecheGedaempft, borderColor: farben.rand }]}>
              <Text style={[schrift.betont, { color: farben.text }]}>Kamera streikt hier</Text>
              <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.s, lineHeight: 21 }]}>
                Scanner und Texterkennung sind native Bestandteile, die es in Expo Go nicht gibt.
                Sie funktionieren erst in der installierten App. Bis dahin kannst du den Brieftext
                hier einfügen — Anonymisierung, Auswertung und Übersicht laufen genauso.
              </Text>
            </View>
          )}

          {kameraMoeglich && <Knopf titel="Brief scannen" onPress={() => void scannen()} />}

          <Text style={[schrift.winzig, { color: farben.textGedaempft, textTransform: 'uppercase', marginTop: abstand.m }]}>
            {kameraMoeglich ? 'Oder Text einfügen' : 'Brieftext'}
          </Text>
          <TextInput
            value={eingegebenerText}
            onChangeText={setEingegebenerText}
            multiline
            placeholder="Text des Schreibens hier einfügen oder abtippen"
            placeholderTextColor={farben.textGedaempft}
            style={[
              stil.eingabe,
              { color: farben.text, backgroundColor: farben.flaeche, borderColor: farben.rand },
            ]}
          />

          {fehler && <Text style={[schrift.klein, { color: farben.sofort, lineHeight: 20 }]}>{fehler}</Text>}

          <Knopf
            titel="Text übernehmen"
            art={kameraMoeglich ? 'tertiaer' : 'primaer'}
            onPress={() => void textUebernehmen()}
          />
        </>
      )}

      {bildPfad && schritt !== 'bereit' && (
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
            Buchstaben werden sortiert…
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
            <Text style={[schrift.winzig, { color: farben.akzent }]}>DAS UND SONST NICHTS</Text>
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

          <Knopf titel="Auswerten" onPress={() => void auswerten()} />
          <Knopf titel="Nochmal von vorn" art="tertiaer" onPress={zuruecksetzen} />
        </>
      )}

      {schritt === 'auswertung' && (
        <View style={stil.laden}>
          <ActivityIndicator color={farben.akzent} />
          <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.s }]}>
            Wird gelesen. Geht schneller als Aufschieben.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const stil = StyleSheet.create({
  inhalt: { padding: abstand.l, paddingBottom: abstand.xxl, gap: abstand.m },
  karte: { padding: abstand.l, borderRadius: radius.l, borderWidth: StyleSheet.hairlineWidth },
  vorschaubild: {
    width: '100%',
    height: 220,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
  },
  eingabe: {
    minHeight: 160,
    padding: abstand.m,
    borderRadius: radius.s,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
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
});
