import * as SecureStore from 'expo-secure-store';
import { LEERE_PERSOENLICHE_DATEN, type PersoenlicheDaten } from './anonymizer';

/**
 * Deine Identitätsdaten liegen im verschlüsselten Schlüsselbund des Geräts, nicht in
 * der Datenbank. Sie werden ausschließlich dafür benutzt, genau diese Angaben aus dem
 * Text zu entfernen, bevor er das Gerät verlässt.
 */
const SCHLUESSEL = 'persoenliche_daten';

export async function lesePersoenlicheDaten(): Promise<PersoenlicheDaten> {
  const roh = await SecureStore.getItemAsync(SCHLUESSEL);
  if (!roh) return LEERE_PERSOENLICHE_DATEN;
  try {
    return { ...LEERE_PERSOENLICHE_DATEN, ...(JSON.parse(roh) as Partial<PersoenlicheDaten>) };
  } catch {
    // Beschädigter Eintrag darf die App nicht blockieren — lieber leer starten,
    // der Anonymisierer warnt dann sichtbar, dass nichts entfernt wird.
    return LEERE_PERSOENLICHE_DATEN;
  }
}

export async function speicherePersoenlicheDaten(daten: PersoenlicheDaten): Promise<void> {
  await SecureStore.setItemAsync(SCHLUESSEL, JSON.stringify(daten));
}
