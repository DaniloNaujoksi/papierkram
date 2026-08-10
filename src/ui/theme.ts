/**
 * Gestaltung nach dem Papierkram-Unfucker-Design.
 *
 * Bewusst nur dunkel: Der Entwurf lebt vom schwarzen Grund, auf dem das Neongrün
 * trägt. Auf hellem Untergrund verliert es seine Wirkung und wird auf einem Handy
 * in der Sonne sogar schlechter lesbar.
 *
 * Die Farbrollen sind streng verteilt: Grün heißt "hier geht es weiter", Magenta
 * heißt "hier brennt es". Beides niemals dekorativ einsetzen — sonst stumpft die
 * Warnfarbe ab, und genau die muss in dieser App zuverlässig funktionieren.
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
  signal: string;

  sofort: string;
  hoch: string;
  mittel: string;
  niedrig: string;
  nichtZahlen: string;
}

const dunkel: Farben = {
  hintergrund: '#0D0D0D',
  flaeche: '#1A1A1A',
  flaecheGedaempft: '#242424',
  rand: '#333333',
  text: '#FFFFFF',
  textGedaempft: '#999999',
  akzent: '#C6FF00',
  akzentText: '#0D0D0D',
  signal: '#FF0080',

  sofort: '#FF0080',
  hoch: '#FFA800',
  mittel: '#999999',
  niedrig: '#555555',
  nichtZahlen: '#C6FF00',
};

export function useFarben(): Farben {
  return dunkel;
}

/** Achterraster aus den Design-Tokens. */
export const abstand = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  s: 8,
  m: 16,
  l: 16,
  rund: 999,
} as const;

/**
 * Schriftskala 1,25 aus den Tokens. Versalien und weite Laufweite nur für kurze
 * Auszeichnungen — in Fließtext kosten sie Lesbarkeit, und hier steht Text, den
 * man wirklich verstehen muss.
 */
export const schrift = {
  riesig: { fontSize: 40, fontWeight: '900' as const, letterSpacing: -1 },
  titel: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.8 },
  ueberschrift: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  betont: { fontSize: 16, fontWeight: '700' as const },
  standard: { fontSize: 16, fontWeight: '400' as const },
  klein: { fontSize: 14, fontWeight: '400' as const },
  winzig: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.2 },
} as const;
