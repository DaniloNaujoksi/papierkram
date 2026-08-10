import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { alleGlaeubiger, dokumenteZuForderung, forderung as ladeForderung } from '../../src/db/repo';
import { berechneVerjaehrung, type Verjaehrungsergebnis } from '../../src/domain/verjaehrung';
import { berechnePrioritaet, type Prioritaet } from '../../src/domain/prioritaet';
import { pruefeInkassokosten, type InkassoPruefErgebnis } from '../../src/domain/inkassokosten';
import { formatEuro, summe } from '../../src/domain/betraege';
import type { Forderung, Glaeubiger } from '../../src/domain/types';
import { Knopf } from '../../src/ui/components/Knopf';
import { abstand, radius, schrift, useFarben } from '../../src/ui/theme';

interface Daten {
  forderung: Forderung;
  glaeubiger: Glaeubiger | undefined;
  verjaehrung: Verjaehrungsergebnis;
  prioritaet: Prioritaet;
  inkasso: InkassoPruefErgebnis | null;
}

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  const farben = useFarben();
  return (
    <View style={[stil.karte, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
      <Text style={[schrift.winzig, { color: farben.textGedaempft, textTransform: 'uppercase' }]}>
        {titel}
      </Text>
      <View style={{ marginTop: abstand.s }}>{children}</View>
    </View>
  );
}

function Posten({ label, betrag }: { label: string; betrag: number }) {
  const farben = useFarben();
  if (betrag === 0) return null;
  return (
    <View style={stil.postenZeile}>
      <Text style={[schrift.standard, { color: farben.textGedaempft }]}>{label}</Text>
      <Text style={[schrift.standard, { color: farben.text }]}>{formatEuro(betrag)}</Text>
    </View>
  );
}

export default function ForderungDetail() {
  const farben = useFarben();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [daten, setDaten] = useState<Daten | null>(null);

  useFocusEffect(
    useCallback(() => {
      const forderungId = Number(id);
      void (async () => {
        const [f, glaeubigerListe, dokumente] = await Promise.all([
          ladeForderung(forderungId),
          alleGlaeubiger(),
          dokumenteZuForderung(forderungId),
        ]);
        if (!f) return;

        const heute = new Date();
        const verjaehrung = berechneVerjaehrung(f, heute);
        const letzterDokumenttyp = dokumente[0]?.typ ?? null;
        const tageBisFrist = f.fristBis
          ? Math.ceil(
              (new Date(`${f.fristBis}T00:00:00Z`).getTime() - heute.getTime()) / 86_400_000
            )
          : null;

        const glaeubiger = glaeubigerListe.find((g) => g.id === f.glaeubigerId);

        // Die Kostenprüfung lohnt nur, wenn ein Inkassobüro eigene Gebühren berechnet.
        const inkasso =
          glaeubiger?.istInkasso && f.betraege.inkassokosten > 0
            ? pruefeInkassokosten({
                hauptforderung: f.betraege.hauptforderung,
                verlangteInkassokosten: f.betraege.inkassokosten,
                forderungBestritten: f.status === 'bestritten',
                ersteZahlungsaufforderung: dokumente.length <= 1,
                glaeubigerVorsteuerabzugsberechtigt: true,
              })
            : null;

        setDaten({
          forderung: f,
          glaeubiger,
          verjaehrung,
          prioritaet: berechnePrioritaet({ forderung: f, verjaehrung, letzterDokumenttyp, tageBisFrist }),
          inkasso,
        });
      })();
    }, [id])
  );

  if (!daten) {
    return (
      <View style={[stil.mitte, { backgroundColor: farben.hintergrund }]}>
        <ActivityIndicator color={farben.akzent} />
      </View>
    );
  }

  const { forderung, glaeubiger, verjaehrung, prioritaet, inkasso } = daten;
  const b = forderung.betraege;

  return (
    <ScrollView style={{ backgroundColor: farben.hintergrund }} contentContainerStyle={stil.inhalt}>
      <View>
        <Text style={[schrift.titel, { color: farben.text }]}>{formatEuro(summe(b))}</Text>
        <Text style={[schrift.betont, { color: farben.text, marginTop: abstand.xs }]}>
          {glaeubiger?.name ?? 'Unbekannter Gläubiger'}
        </Text>
        {glaeubiger?.vertrittFuer && (
          <Text style={[schrift.klein, { color: farben.textGedaempft }]}>
            treibt ein für {glaeubiger.vertrittFuer}
          </Text>
        )}
        <Text style={[schrift.standard, { color: farben.textGedaempft, marginTop: abstand.s, lineHeight: 23 }]}>
          {forderung.titel}
        </Text>
      </View>

      {/* Die automatische Auswertung liest nicht aus jedem Brief alles heraus.
          Ohne diesen Weg bliebe eine unvollständige Forderung für immer falsch. */}
      {/* Der naechste Schritt oben sagt, was zu tun ist. Hier faengt das Tun an. */}
      <Knopf
        titel="Antwort schreiben"
        onPress={() =>
          router.push({ pathname: '/antwort', params: { forderungId: String(forderung.id) } })
        }
      />
      <Knopf
        titel="Angaben bearbeiten"
        art="tertiaer"
        onPress={() =>
          router.push({ pathname: '/pruefen', params: { forderungId: String(forderung.id) } })
        }
      />

      <Abschnitt titel="Nächster Schritt">
        <Text style={[schrift.standard, { color: farben.text, lineHeight: 24 }]}>
          {prioritaet.naechsterSchritt}
        </Text>
        {prioritaet.risiko && (
          <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.m, lineHeight: 21 }]}>
            {prioritaet.risiko}
          </Text>
        )}
      </Abschnitt>

      <Abschnitt titel="Verjährung">
        <Text style={[schrift.standard, { color: farben.text, lineHeight: 23 }]}>
          {verjaehrung.begruendung}
        </Text>
        {verjaehrung.hinweis && (
          <Text
            style={[
              schrift.klein,
              {
                color: verjaehrung.ampel === 'verjaehrt' ? farben.nichtZahlen : farben.text,
                marginTop: abstand.m,
                lineHeight: 21,
              },
            ]}
          >
            {verjaehrung.hinweis}
          </Text>
        )}
        <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.m, lineHeight: 20 }]}>
          {verjaehrung.regel.erlaeuterung}
        </Text>
      </Abschnitt>

      <Abschnitt titel="Zusammensetzung">
        <Posten label="Hauptforderung" betrag={b.hauptforderung} />
        <Posten label="Zinsen" betrag={b.zinsen} />
        <Posten label="Mahnkosten" betrag={b.mahnkosten} />
        <Posten label="Inkassokosten" betrag={b.inkassokosten} />
        <Posten label="Gerichtskosten" betrag={b.gerichtskosten} />
        <Posten label="Säumniszuschläge" betrag={b.saeumniszuschlaege} />
        <Posten label="Sonstige Kosten" betrag={b.sonstigeKosten} />
        <View style={[stil.postenZeile, stil.summeZeile, { borderTopColor: farben.rand }]}>
          <Text style={[schrift.betont, { color: farben.text }]}>Summe</Text>
          <Text style={[schrift.betont, { color: farben.text }]}>{formatEuro(summe(b))}</Text>
        </View>
      </Abschnitt>

      {inkasso && (
        <Abschnitt titel="Prüfung der Inkassokosten">
          <Text
            style={[
              schrift.standard,
              { color: inkasso.beanstandet ? farben.hoch : farben.text, lineHeight: 23 },
            ]}
          >
            {inkasso.begruendung}
          </Text>
          <View style={{ marginTop: abstand.m }}>
            {inkasso.rechenweg.map((zeile) => (
              <Text
                key={zeile}
                style={[schrift.klein, { color: farben.textGedaempft, lineHeight: 20, marginBottom: 2 }]}
              >
                {zeile}
              </Text>
            ))}
          </View>
        </Abschnitt>
      )}

      {forderung.aktenzeichen && (
        <Abschnitt titel="Aktenzeichen">
          <Text style={[schrift.standard, { color: farben.text }]}>{forderung.aktenzeichen}</Text>
        </Abschnitt>
      )}

      <Text style={[schrift.klein, { color: farben.textGedaempft, lineHeight: 20, marginTop: abstand.s }]}>
        Diese Einschätzungen ersetzen keine Rechtsberatung. Für eine Privatinsolvenz brauchst du die
        Bescheinigung einer anerkannten Schuldnerberatungsstelle — die Beratung dort ist kostenlos,
        und mit den Daten aus dieser App bist du in einem Bruchteil der üblichen Zeit durch.
      </Text>
    </ScrollView>
  );
}

const stil = StyleSheet.create({
  inhalt: { padding: abstand.l, paddingBottom: abstand.xxl, gap: abstand.m },
  mitte: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  karte: { padding: abstand.l, borderRadius: radius.l, borderWidth: StyleSheet.hairlineWidth },
  postenZeile: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: abstand.xs },
  summeZeile: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: abstand.s, paddingTop: abstand.s },
});
