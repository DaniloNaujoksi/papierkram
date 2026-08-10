import type { Betraege, Cent } from './types';

export const LEERE_BETRAEGE: Betraege = {
  hauptforderung: 0,
  zinsen: 0,
  mahnkosten: 0,
  inkassokosten: 0,
  gerichtskosten: 0,
  saeumniszuschlaege: 0,
  sonstigeKosten: 0,
  gefordertGesamt: null,
};

/** Summe aller Einzelpositionen — nicht der vom Gläubiger genannte Gesamtbetrag. */
export function summe(b: Betraege): Cent {
  return (
    b.hauptforderung +
    b.zinsen +
    b.mahnkosten +
    b.inkassokosten +
    b.gerichtskosten +
    b.saeumniszuschlaege +
    b.sonstigeKosten
  );
}

/** Alles, was über die eigentliche Schuld hinaus verlangt wird. Hier sitzt das Sparpotenzial. */
export function nebenkosten(b: Betraege): Cent {
  return summe(b) - b.hauptforderung;
}

/**
 * Weicht die vom Gläubiger genannte Gesamtsumme von der Summe seiner eigenen
 * Einzelposten ab? Das kommt öfter vor als man denkt und ist ein guter Anlass,
 * eine detaillierte Forderungsaufstellung zu verlangen.
 */
export function summendifferenz(b: Betraege): Cent | null {
  if (b.gefordertGesamt === null) return null;
  return b.gefordertGesamt - summe(b);
}

export function formatEuro(cent: Cent): string {
  return (cent / 100).toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });
}

/** Nimmt "1.234,56", "1234.56", "1234,56 €" und macht Cent daraus. */
export function parseEuroZuCent(eingabe: string): Cent | null {
  const bereinigt = eingabe.replace(/[^\d,.-]/g, '').trim();
  if (!bereinigt) return null;

  // Deutsches Format: Punkt ist Tausendertrenner, Komma ist Dezimaltrenner.
  const hatKomma = bereinigt.includes(',');
  const normalisiert = hatKomma
    ? bereinigt.replace(/\./g, '').replace(',', '.')
    : bereinigt;

  const zahl = Number.parseFloat(normalisiert);
  if (Number.isNaN(zahl)) return null;
  return Math.round(zahl * 100);
}
