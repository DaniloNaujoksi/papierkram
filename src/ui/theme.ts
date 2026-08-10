import { useColorScheme } from 'react-native';

/**
 * Ruhiges, sachliches Farbschema. Bewusst kein Alarmrot als Grundton:
 * Wer die App öffnet, hat mit dem Thema ohnehin genug Stress. Farbe markiert
 * hier Dringlichkeit, nicht Stimmung.
 */
export interface Farben {
  hintergrund: string;
  flaeche: string;
  flaecheGedaempft: string;
  rand: string;
  text: string;
  textGedaempft: string;
  akzent: string;
  akzentText: string;
  sofort: string;
  hoch: string;
  mittel: string;
  niedrig: string;
  nichtZahlen: string;
}

const hell: Farben = {
  hintergrund: '#F7F6F3',
  flaeche: '#FFFFFF',
  flaecheGedaempft: '#EFEDE8',
  rand: '#E0DDD6',
  text: '#1C1B19',
  textGedaempft: '#6B6862',
  akzent: '#2E5E4E',
  akzentText: '#FFFFFF',

  sofort: '#A33A2B',
  hoch: '#B5722A',
  mittel: '#6B6862',
  niedrig: '#8A867E',
  nichtZahlen: '#2E5E4E',
};

const dunkel: Farben = {
  hintergrund: '#141412',
  flaeche: '#1E1D1B',
  flaecheGedaempft: '#282725',
  rand: '#38352F',
  text: '#F2F0EC',
  textGedaempft: '#9C978E',
  akzent: '#6FA48D',
  akzentText: '#101210',

  sofort: '#E08273',
  hoch: '#DCA765',
  mittel: '#9C978E',
  niedrig: '#7C776F',
  nichtZahlen: '#6FA48D',
};

export function useFarben(): Farben {
  return useColorScheme() === 'dark' ? dunkel : hell;
}

export const abstand = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  s: 8,
  m: 12,
  l: 16,
} as const;

export const schrift = {
  titel: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  ueberschrift: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.3 },
  betont: { fontSize: 16, fontWeight: '600' as const },
  standard: { fontSize: 16, fontWeight: '400' as const },
  klein: { fontSize: 14, fontWeight: '400' as const },
  winzig: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.3 },
} as const;
