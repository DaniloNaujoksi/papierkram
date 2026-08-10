import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LEERE_PERSOENLICHE_DATEN, type PersoenlicheDaten } from '../../src/services/anonymizer';
import { lesePersoenlicheDaten, speicherePersoenlicheDaten } from '../../src/services/persoenlicheDaten';
import { leseApiKey, speichereApiKey } from '../../src/services/claude';
import { Feld } from '../../src/ui/components/Feld';
import { abstand, radius, schrift, useFarben } from '../../src/ui/theme';

export default function EinstellungenScreen() {
  const farben = useFarben();
  const [daten, setDaten] = useState<PersoenlicheDaten>(LEERE_PERSOENLICHE_DATEN);
  const [apiKey, setApiKey] = useState('');
  const [keyVorhanden, setKeyVorhanden] = useState(false);
  const [gespeichert, setGespeichert] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void lesePersoenlicheDaten().then(setDaten);
      void leseApiKey().then((k) => setKeyVorhanden(Boolean(k)));
    }, [])
  );

  function aendere<K extends keyof PersoenlicheDaten>(feld: K, wert: PersoenlicheDaten[K]) {
    setDaten((alt) => ({ ...alt, [feld]: wert }));
    setGespeichert(false);
  }

  async function speichern() {
    await speicherePersoenlicheDaten(daten);
    if (apiKey.trim()) {
      await speichereApiKey(apiKey);
      setApiKey('');
      setKeyVorhanden(true);
    }
    setGespeichert(true);
  }

  return (
    <ScrollView
      style={{ backgroundColor: farben.hintergrund }}
      contentContainerStyle={stil.inhalt}
      keyboardShouldPersistTaps="handled"
    >
      {/* Der Schlüssel steht bewusst ganz oben: ohne ihn tut die App nichts, und er
          wird genau einmal eingetragen. Die Stammdaten darunter ändert man später
          höchstens noch bei einem Umzug. */}
      <Text style={[schrift.ueberschrift, { color: farben.text }]}>Auswertung</Text>
      <Feld
        label={keyVorhanden ? 'API-Schlüssel ersetzen' : 'API-Schlüssel'}
        wert={apiKey}
        onChange={setApiKey}
        platzhalter={keyVorhanden ? 'Ein Schlüssel ist hinterlegt' : 'sk-ant-…'}
        hinweis="Wird für die Auswertung der Brieftexte gebraucht und im Schlüsselbund gespeichert. Da die App nur auf deinem eigenen Gerät läuft, ist das hier vertretbar — auf einem fremden Telefon wäre es das nicht."
      />

      <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
        <Text style={[schrift.betont, { color: farben.text }]}>Wozu die Angaben unten dienen</Text>
        <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.s, lineHeight: 21 }]}>
          Genau diese Daten werden aus dem erkannten Brieftext entfernt, bevor er zur Auswertung
          das Gerät verlässt. Was hier nicht steht, kann auch nicht herausgefiltert werden. Die
          Angaben liegen im verschlüsselten Schlüsselbund des iPhones, nicht in der Datenbank.
        </Text>
      </View>

      <Text style={[schrift.ueberschrift, { color: farben.text }]}>Deine Daten</Text>
      <Feld label="Vorname" wert={daten.vorname} onChange={(w) => aendere('vorname', w)} />
      <Feld label="Nachname" wert={daten.nachname} onChange={(w) => aendere('nachname', w)} />
      <Feld
        label="Weitere Schreibweisen"
        wert={daten.weitereNamen.join(', ')}
        onChange={(w) => aendere('weitereNamen', w.split(',').map((s) => s.trim()).filter(Boolean))}
        hinweis="Geburtsname, Doppelnamen, häufige Tippfehler der Gläubiger — mit Komma getrennt."
      />
      <Feld
        label="Straße und Hausnummer"
        wert={daten.strasse}
        onChange={(w) => aendere('strasse', w)}
      />
      <Feld label="Postleitzahl" wert={daten.plz} onChange={(w) => aendere('plz', w)} tastatur="numeric" />
      <Feld label="Ort" wert={daten.ort} onChange={(w) => aendere('ort', w)} />
      <Feld
        label="Geburtsdatum"
        wert={daten.geburtsdatum}
        onChange={(w) => aendere('geburtsdatum', w)}
        platzhalter="TT.MM.JJJJ"
      />
      <Feld
        label="Kennnummern"
        wert={daten.kennnummern.join(', ')}
        onChange={(w) => aendere('kennnummern', w.split(',').map((s) => s.trim()).filter(Boolean))}
        mehrzeilig
        hinweis="Versichertennummer, Steuer-ID, Rentenversicherungsnummer, Kundennummern — mit Komma getrennt."
      />

      <Pressable
        onPress={() => void speichern()}
        style={({ pressed }) => [stil.knopf, { backgroundColor: farben.akzent, opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={[schrift.betont, { color: farben.akzentText }]}>
          {gespeichert ? 'Gespeichert' : 'Speichern'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const stil = StyleSheet.create({
  inhalt: { padding: abstand.l, paddingBottom: abstand.xxl, gap: abstand.s },
  karte: {
    padding: abstand.l,
    borderRadius: radius.l,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: abstand.s,
  },
  knopf: { paddingVertical: abstand.l, borderRadius: radius.m, alignItems: 'center', marginTop: abstand.m },
});
