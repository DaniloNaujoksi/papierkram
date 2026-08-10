import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { abstand, radius, schrift, useFarben } from '../theme';

interface FeldProps {
  label: string;
  wert: string;
  onChange: (wert: string) => void;
  platzhalter?: string;
  /** Markiert Felder, bei denen die automatische Auswertung unsicher war. */
  unsicher?: boolean;
  hinweis?: string;
  tastatur?: 'default' | 'numeric';
  mehrzeilig?: boolean;
}

export function Feld({
  label,
  wert,
  onChange,
  platzhalter,
  unsicher,
  hinweis,
  tastatur = 'default',
  mehrzeilig,
}: FeldProps) {
  const farben = useFarben();

  return (
    <View style={stil.gruppe}>
      <View style={stil.labelZeile}>
        <Text style={[schrift.winzig, { color: farben.textGedaempft, textTransform: 'uppercase' }]}>
          {label}
        </Text>
        {unsicher && (
          <Text style={[schrift.winzig, { color: farben.hoch }]}>bitte prüfen</Text>
        )}
      </View>
      <TextInput
        value={wert}
        onChangeText={onChange}
        placeholder={platzhalter}
        placeholderTextColor={farben.textGedaempft}
        keyboardType={tastatur}
        multiline={mehrzeilig}
        style={[
          stil.eingabe,
          mehrzeilig && stil.eingabeMehrzeilig,
          {
            color: farben.text,
            backgroundColor: farben.flaeche,
            borderColor: unsicher ? farben.hoch : farben.rand,
          },
        ]}
      />
      {hinweis && (
        <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.xs, lineHeight: 19 }]}>
          {hinweis}
        </Text>
      )}
    </View>
  );
}

interface SchalterProps {
  label: string;
  wert: boolean;
  onChange: (wert: boolean) => void;
  hinweis?: string;
}

export function Schalter({ label, wert, onChange, hinweis }: SchalterProps) {
  const farben = useFarben();

  return (
    <View style={stil.gruppe}>
      <View style={stil.schalterZeile}>
        <Text style={[schrift.standard, { color: farben.text, flex: 1, paddingRight: abstand.m }]}>
          {label}
        </Text>
        <Switch
          value={wert}
          onValueChange={onChange}
          trackColor={{ true: farben.akzent, false: farben.rand }}
        />
      </View>
      {hinweis && (
        <Text style={[schrift.klein, { color: farben.textGedaempft, marginTop: abstand.xs, lineHeight: 19 }]}>
          {hinweis}
        </Text>
      )}
    </View>
  );
}

const stil = StyleSheet.create({
  gruppe: { marginBottom: abstand.l },
  labelZeile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: abstand.xs,
  },
  eingabe: {
    paddingHorizontal: abstand.m,
    paddingVertical: abstand.m,
    borderRadius: radius.s,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  eingabeMehrzeilig: { minHeight: 90, textAlignVertical: 'top' },
  schalterZeile: { flexDirection: 'row', alignItems: 'center' },
});
