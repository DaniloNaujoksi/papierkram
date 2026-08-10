import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { formatEuro } from '../../src/domain/betraege';
import type { Dringlichkeit } from '../../src/domain/prioritaet';
import { useUebersicht, type Eintrag } from '../../src/ui/useUebersicht';
import { abstand, radius, schrift, useFarben, type Farben } from '../../src/ui/theme';

const DRINGLICHKEIT_TEXT: Record<Dringlichkeit, string> = {
  sofort: 'Sofort',
  hoch: 'Hoch',
  mittel: 'Mittel',
  niedrig: 'Nachrangig',
  nicht_zahlen: 'Nicht zahlen',
};

function dringlichkeitsFarbe(d: Dringlichkeit, farben: Farben): string {
  switch (d) {
    case 'sofort': return farben.sofort;
    case 'hoch': return farben.hoch;
    case 'mittel': return farben.mittel;
    case 'niedrig': return farben.niedrig;
    case 'nicht_zahlen': return farben.nichtZahlen;
  }
}

function Kennzahl({ wert, beschriftung, farbe }: { wert: string; beschriftung: string; farbe: string }) {
  const farben = useFarben();
  return (
    <View style={[stil.kennzahl, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
      <Text style={[schrift.ueberschrift, { color: farbe }]}>{wert}</Text>
      <Text style={[schrift.winzig, { color: farben.textGedaempft, marginTop: 2 }]}>
        {beschriftung}
      </Text>
    </View>
  );
}

function Kopf({ gesamtOffen, gesamtNebenkosten, anzahl, dringend, verjaehrt }: {
  gesamtOffen: number;
  gesamtNebenkosten: number;
  anzahl: number;
  dringend: number;
  verjaehrt: number;
}) {
  const farben = useFarben();
  return (
    <View style={{ gap: abstand.s }}>
      <View style={[stil.kopf, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
        <Text style={[schrift.winzig, { color: farben.akzent }]}>OFFEN INSGESAMT</Text>
        <Text style={[schrift.titel, { color: farben.text, marginTop: abstand.s }]}>
          {formatEuro(gesamtOffen)}
        </Text>
        {gesamtNebenkosten > 0 && (
          <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.s }]}>
            Davon {formatEuro(gesamtNebenkosten)} Zinsen und aufgeschlagene Kosten — genau der Teil,
            über den sich verhandeln lässt.
          </Text>
        )}
      </View>

      <View style={stil.kennzahlen}>
        <Kennzahl wert={String(anzahl)} beschriftung="FORDERUNGEN" farbe={farben.text} />
        <Kennzahl wert={String(dringend)} beschriftung="SOFORT" farbe={farben.sofort} />
        <Kennzahl wert={String(verjaehrt)} beschriftung="VERJÄHRT" farbe={farben.akzent} />
      </View>
    </View>
  );
}

function Zeile({ eintrag }: { eintrag: Eintrag }) {
  const farben = useFarben();
  const { forderung, glaeubiger, prioritaet, verjaehrung, tageBisFrist } = eintrag;
  const farbe = dringlichkeitsFarbe(prioritaet.dringlichkeit, farben);

  return (
    <Link href={{ pathname: '/forderung/[id]', params: { id: String(forderung.id) } }} asChild>
      <Pressable
        style={({ pressed }) => [
          stil.zeile,
          { backgroundColor: farben.flaeche, borderColor: farben.rand, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <View style={[stil.balken, { backgroundColor: farbe }]} />
        <View style={stil.zeileInhalt}>
          <View style={stil.zeileKopf}>
            <Text style={[schrift.winzig, { color: farbe, textTransform: 'uppercase' }]}>
              {DRINGLICHKEIT_TEXT[prioritaet.dringlichkeit]}
            </Text>
            <Text style={[schrift.betont, { color: farben.text }]}>{formatEuro(eintrag.offen)}</Text>
          </View>

          <Text style={[schrift.betont, { color: farben.text, marginTop: abstand.xs }]} numberOfLines={1}>
            {glaeubiger?.name ?? 'Unbekannter Gläubiger'}
          </Text>
          <Text style={[schrift.klein, { color: farben.textGedaempft }]} numberOfLines={2}>
            {forderung.titel}
          </Text>

          {tageBisFrist !== null && tageBisFrist <= 30 && (
            <Text style={[schrift.klein, { color: farbe, marginTop: abstand.xs }]}>
              {tageBisFrist < 0
                ? `Frist seit ${Math.abs(tageBisFrist)} Tagen abgelaufen`
                : tageBisFrist === 0
                  ? 'Frist läuft heute ab'
                  : `Noch ${tageBisFrist} Tage Frist`}
            </Text>
          )}

          {verjaehrung.ampel === 'verjaehrt' && !forderung.istTituliert && (
            <Text style={[schrift.klein, { color: farben.nichtZahlen, marginTop: abstand.xs }]}>
              Vermutlich verjährt seit {verjaehrung.verjaehrtAm}
            </Text>
          )}

          {/* Die Handlungsanweisung ist der eigentliche Zweck der App und gehört
              deshalb in die Liste, nicht erst in die Detailansicht. Hier steht der
              erste Satz; der Rest samt Begründung und Risiko folgt beim Antippen. */}
          <View style={[stil.schritt, { borderTopColor: farben.rand }]}>
            <Text style={[schrift.winzig, { color: farben.textGedaempft, textTransform: 'uppercase' }]}>
              Nächster Schritt
            </Text>
            <Text
              style={[schrift.klein, { color: farben.text, marginTop: 2, lineHeight: 20 }]}
              numberOfLines={3}
            >
              {prioritaet.naechsterSchritt}
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function Leer() {
  const farben = useFarben();
  return (
    <View style={stil.leer}>
      <Text style={[schrift.titel, { color: farben.text, textAlign: 'center' }]}>
        Noch nichts{'\n'}erfasst
      </Text>
      <View style={[stil.leerStreifen, { backgroundColor: farben.akzent }]}>
        <Text style={[schrift.betont, { color: farben.akzentText }]}>Fang mit dem schlimmsten an</Text>
      </View>
      <Text
        style={[
          schrift.standard,
          { color: farben.textGedaempft, textAlign: 'center', marginTop: abstand.m, lineHeight: 24 },
        ]}
      >
        Nimm den Brief, vor dem dir am meisten graut. Sobald er erfasst ist, siehst du schwarz auf
        weiß, worum es geht — das ist fast immer weniger schlimm als der Stapel.
      </Text>
    </View>
  );
}

export default function Uebersicht() {
  const farben = useFarben();
  const { eintraege, gesamtOffen, gesamtNebenkosten, laedt } = useUebersicht();

  if (!laedt && eintraege.length === 0) return <Leer />;

  return (
    <FlatList
      style={{ backgroundColor: farben.hintergrund }}
      contentContainerStyle={stil.liste}
      data={eintraege}
      keyExtractor={(e) => String(e.forderung.id)}
      ListHeaderComponent={
        <Kopf
          gesamtOffen={gesamtOffen}
          gesamtNebenkosten={gesamtNebenkosten}
          anzahl={eintraege.length}
          dringend={eintraege.filter((e) => e.prioritaet.dringlichkeit === 'sofort').length}
          verjaehrt={eintraege.filter((e) => e.prioritaet.dringlichkeit === 'nicht_zahlen').length}
        />
      }
      renderItem={({ item }) => <Zeile eintrag={item} />}
    />
  );
}

const stil = StyleSheet.create({
  liste: { padding: abstand.m, gap: abstand.s },
  kopf: { padding: abstand.m, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth },
  kennzahlen: { flexDirection: 'row', gap: abstand.s },
  kennzahl: {
    flex: 1,
    padding: abstand.m,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
  },
  zeile: {
    flexDirection: 'row',
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  balken: { width: 4 },
  zeileInhalt: { flex: 1, padding: abstand.m },
  zeileKopf: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  schritt: {
    marginTop: abstand.m,
    paddingTop: abstand.s,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  leer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: abstand.l },
  leerStreifen: {
    marginTop: abstand.m,
    paddingHorizontal: abstand.m,
    paddingVertical: abstand.s,
    borderRadius: radius.s,
  },
});
