import { leseEinstellung, schreibeEinstellung } from '../db/repo';
import type { Haushaltszahlen } from '../domain/strategie';

const SCHLUESSEL = 'haushalt';

/**
 * Die Pfändungsfreigrenze wird jedes Jahr zum 1. Juli angepasst. Ein fest
 * einprogrammierter Wert wäre nach spätestens zwölf Monaten falsch — und ein
 * falscher Freibetrag führt hier zur genau gegenteiligen Empfehlung. Deshalb
 * pflegt ihn der Benutzer, mit sichtbarem Hinweis auf die Quelle.
 */
export const LEERER_HAUSHALT: Haushaltszahlen = {
  nettoeinkommenMonat: 0,
  fixkostenMonat: 0,
  lebenshaltungMonat: 0,
  unterhaltspflichtigePersonen: 0,
  pfaendungsfreibetragMonat: null,
  erhoehungJePersonMonat: null,
};

export async function leseHaushalt(): Promise<Haushaltszahlen> {
  const roh = await leseEinstellung(SCHLUESSEL);
  if (!roh) return LEERER_HAUSHALT;
  try {
    return { ...LEERER_HAUSHALT, ...(JSON.parse(roh) as Partial<Haushaltszahlen>) };
  } catch {
    return LEERER_HAUSHALT;
  }
}

export async function speichereHaushalt(h: Haushaltszahlen): Promise<void> {
  await schreibeEinstellung(SCHLUESSEL, JSON.stringify(h));
}
