/**
 * Texterkennung auf dem Gerät.
 *
 * ML Kit läuft komplett offline auf dem iPhone. Das Bild wird nicht hochgeladen,
 * nicht zwischengespeichert und verlässt die App nicht — hier entsteht nur Text.
 */

import TextRecognition from '@react-native-ml-kit/text-recognition';

export interface OcrErgebnis {
  text: string;
  /** Anzahl erkannter Textblöcke — grobe Qualitätsanzeige für den Scan. */
  bloecke: number;
  /** Warnung, wenn der Scan vermutlich unbrauchbar ist. */
  warnung: string | null;
}

/**
 * @param bildPfad Lokaler Dateipfad ("file:///...") aus dem Dokumentenscanner.
 */
export async function erkenneText(bildPfad: string): Promise<OcrErgebnis> {
  const ergebnis = await TextRecognition.recognize(bildPfad);

  const text = ergebnis.text ?? '';
  const bloecke = ergebnis.blocks?.length ?? 0;

  let warnung: string | null = null;
  if (text.trim().length < 80) {
    warnung =
      'Es wurde kaum Text erkannt. Häufigste Ursachen: zu wenig Licht, Schatten quer über dem Blatt, oder das Handy war zu nah dran. Am besten den Brief flach auf einen dunklen Untergrund legen und neu scannen.';
  } else if (bloecke < 3) {
    warnung =
      'Der Scan wirkt unvollständig. Prüfe, ob das ganze Blatt im Bild ist, bevor du die Daten übernimmst.';
  }

  return { text, bloecke, warnung };
}

/**
 * Bereitet den Rohtext für die Auswertung auf: Zeilenumbrüche vereinheitlichen,
 * Mehrfach-Leerzeichen zusammenziehen, offensichtliche OCR-Artefakte entfernen.
 * Beträge und Daten werden bewusst nicht angefasst.
 */
export function bereinigeOcrText(roh: string): string {
  return roh
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((zeile) => zeile.trim())
    .join('\n')
    .trim();
}
