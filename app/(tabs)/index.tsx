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

function Kopf({ gesamtOffen, gesamtNebenkosten, anzahl }: {
  gesamtOffen: number;
  gesamtNebenkosten: number;
  anzahl: number;
}) {
  const farben = useFarben();
  return (
    <View style={[stil.kopf, { backgroundColor: farben.flaeche, borderColor: farben.rand }]}>
      <Text style={[schrift.winzig, { color: farben.textGedaempft, textTransform: 'uppercase' }]}>
        Offen insgesamt
      </Text>
      <Text style={[schrift.titel, { color: farben.text, marginTop: abstand.xs }]}>
        {formatEuro(gesamtOffen)}
      </Text>
      <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.s }]}>
        {anzahl === 1 ? '1 Forderung' : `${anzahl} Forderungen`}
        {gesamtNebenkosten > 0 && `, davon ${formatEuro(gesamtNebenkosten)} Zinsen und Kosten`}
      </Text>
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
        </View>
      </Pressable>
    </Link>
  );
}

function Leer() {
  const farben = useFarben();
  return (
    <View style={stil.leer}>
      <Text style={[schrift.ueberschrift, { color: farben.text, textAlign: 'center' }]}>
        Noch nichts erfasst
      </Text>
      <Text
        style={[
          schrift.standard,
          { color: farben.textGedaempft, textAlign: 'center', marginTop: abstand.m, lineHeight: 24 },
        ]}
      >
        Fang mit dem Brief an, vor dem dir am meisten graut. Sobald er erfasst ist, siehst du
        schwarz auf weiß, worum es geht — das ist fast immer weniger schlimm als der Stapel.
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
        />
      }
      renderItem={({ item }) => <Zeile eintrag={item} />}
    />
  );
}

const stil = StyleSheet.create({
  liste: { padding: abstand.l, gap: abstand.m },
  kopf: { padding: abstand.l, borderRadius: radius.l, borderWidth: StyleSheet.hairlineWidth },
  zeile: {
    flexDirection: 'row',
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  balken: { width: 4 },
  zeileInhalt: { flex: 1, padding: abstand.m },
  zeileKopf: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: abstand.xl },
});
