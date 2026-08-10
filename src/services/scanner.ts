/**
 * Zugriff auf den Dokumentenscanner.
 *
 * Das Modul registriert sich als TurboModule und wirft schon beim Import, wenn es
 * im laufenden Build nicht einkompiliert ist — etwa in Expo Go. Deshalb wird es erst
 * beim Benutzen geladen, damit die App dort startet statt weiß zu bleiben. Ohne
 * Scanner läuft alles außer der Kamera-Erfassung.
 */

let modul: { scanDocument: (o?: unknown) => Promise<{ scannedImages?: string[] }> } | null = null;
let geladen = false;

function ladeModul() {
  if (geladen) return modul;
  geladen = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    modul = require('react-native-document-scanner-plugin').default;
  } catch {
    modul = null;
  }
  return modul;
}

export function scannerVerfuegbar(): boolean {
  return ladeModul() !== null;
}

/**
 * Öffnet den Scanner. Gibt den Pfad der aufgenommenen Seite zurück,
 * oder null, wenn abgebrochen wurde.
 */
export async function scanneSeite(): Promise<string | null> {
  const m = ladeModul();
  if (!m) {
    throw new Error(
      'Der Dokumentenscanner ist in dieser Version nicht enthalten. In Expo Go gibt es keine nativen Module — nimm so lange die Texteingabe.'
    );
  }
  const { scannedImages } = await m.scanDocument({ maxNumDocuments: 1 });
  return scannedImages?.[0] ?? null;
}
