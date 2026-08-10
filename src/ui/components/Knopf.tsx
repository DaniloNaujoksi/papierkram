import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { abstand, radius, schrift, useFarben } from '../theme';

type Art = 'primaer' | 'sekundaer' | 'tertiaer';

interface Props {
  titel: string;
  onPress: () => void;
  art?: Art;
  deaktiviert?: boolean;
  style?: ViewStyle;
}

/**
 * Drei Stufen aus dem Entwurf. Magenta ist der Warnfarbe vorbehalten und steht
 * deshalb nur auf Handlungen, die etwas Unumkehrbares auslösen oder eine Frist
 * betreffen — nicht als zweite Grundfarbe für beliebige Knöpfe.
 */
export function Knopf({ titel, onPress, art = 'primaer', deaktiviert, style }: Props) {
  const farben = useFarben();

  const flaeche =
    art === 'primaer' ? farben.akzent : art === 'sekundaer' ? farben.signal : 'transparent';
  const schriftfarbe =
    art === 'primaer' ? farben.akzentText : art === 'sekundaer' ? '#FFFFFF' : farben.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={deaktiviert}
      style={({ pressed }) => [
        stil.knopf,
        {
          backgroundColor: flaeche,
          borderColor: art === 'tertiaer' ? farben.rand : 'transparent',
          borderWidth: art === 'tertiaer' ? StyleSheet.hairlineWidth : 0,
          opacity: deaktiviert ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text style={[schrift.betont, { color: schriftfarbe, letterSpacing: 0.5 }]}>
        {titel.toUpperCase()}
      </Text>
    </Pressable>
  );
}

const stil = StyleSheet.create({
  knopf: {
    paddingVertical: abstand.m,
    paddingHorizontal: abstand.l,
    borderRadius: radius.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
