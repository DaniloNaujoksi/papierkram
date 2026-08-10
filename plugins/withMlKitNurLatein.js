const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Beschneidet die ML-Kit-Texterkennung auf lateinische Schrift.
 *
 * Das Paket zieht fünf Schriftmodelle herein — Latein, Chinesisch, Devanagari,
 * Japanisch, Koreanisch. Deutsche Behördenpost braucht davon genau eines. Die
 * übrigen vier landen ungenutzt in der App und blähen sie um mehrere hundert
 * Megabyte auf, was beim Sideloading spürbar ist: die App muss mit kostenloser
 * Apple-ID jede Woche neu übertragen und signiert werden.
 *
 * Zwei Stellen müssen dafür zusammenpassen: die Podspec listet die Abhängigkeiten,
 * der Objective-C-Code importiert die Module und wählt danach die Optionen aus.
 * Nur eine von beiden zu ändern bricht den Build ("Module ... not found"), deshalb
 * wird die Podspec erst gekürzt, wenn der Quelltext nachweislich passt.
 *
 * Beide Dateien liegen in node_modules und werden bei jedem Build neu installiert,
 * deshalb geschieht das hier vor `pod install` statt einmalig von Hand.
 */
const ENTFERNTE_SKRIPTE = ['Chinese', 'Devanagari', 'Japanese', 'Korean'];

/**
 * Entfernt die Importe und die zugehörigen Zweige der Optionen-Auswahl.
 *
 * Die Zweige sehen so aus, jeweils über zwei Zeilen:
 *
 *     } else if ([script isEqualToString:@"Chinese"]) {
 *         options = [[MLKChineseTextRecognizerOptions alloc] init];
 *
 * Beide Zeilen fallen weg. Die schließende Klammer des Latein-Zweigs liefert
 * danach der ohnehin vorhandene `} else {`-Zweig, die Klammerbilanz bleibt also
 * unverändert.
 */
function kuerzeQuelltext(quelle) {
  const zeilen = quelle.split('\n');
  const ergebnis = [];
  let entfernteZweige = 0;
  let entfernteImporte = 0;

  for (let i = 0; i < zeilen.length; i += 1) {
    const zeile = zeilen[i];

    if (ENTFERNTE_SKRIPTE.some((s) => zeile.includes(`@import MLKitTextRecognition${s};`))) {
      entfernteImporte += 1;
      continue;
    }

    const zweig = ENTFERNTE_SKRIPTE.find((s) => zeile.includes(`isEqualToString:@"${s}"`));
    if (zweig) {
      // Diese Zeile und die Zuweisung darunter überspringen.
      i += 1;
      entfernteZweige += 1;
      continue;
    }

    ergebnis.push(zeile);
  }

  return { quelltext: ergebnis.join('\n'), entfernteImporte, entfernteZweige };
}

module.exports = function withMlKitNurLatein(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const paketOrdner = path.join(
        cfg.modRequest.projectRoot,
        'node_modules',
        '@react-native-ml-kit',
        'text-recognition'
      );
      const podspec = path.join(paketOrdner, 'RNMLKitTextRecognition.podspec');
      const quelldatei = path.join(paketOrdner, 'ios', 'TextRecognition.m');

      if (!fs.existsSync(podspec) || !fs.existsSync(quelldatei)) {
        // Kein harter Abbruch: Der Build soll auch laufen, wenn das Paket sich
        // ändert. Dann ist die App nur größer als nötig.
        console.warn('[withMlKitNurLatein] Paketdateien nicht gefunden, überspringe Kürzung.');
        return cfg;
      }

      const { quelltext, entfernteImporte, entfernteZweige } = kuerzeQuelltext(
        fs.readFileSync(quelldatei, 'utf8')
      );

      // Nur wenn der Quelltext vollständig passt, darf die Podspec gekürzt werden.
      // Sonst importiert der Code Module, die es nicht mehr gibt.
      if (entfernteImporte !== ENTFERNTE_SKRIPTE.length || entfernteZweige !== ENTFERNTE_SKRIPTE.length) {
        console.warn(
          `[withMlKitNurLatein] Quelltext sieht anders aus als erwartet ` +
            `(${entfernteImporte} Importe, ${entfernteZweige} Zweige gefunden, je ${ENTFERNTE_SKRIPTE.length} erwartet). ` +
            'Es wird nichts gekürzt — die App wird größer, bleibt aber baubar.'
        );
        return cfg;
      }

      fs.writeFileSync(quelldatei, quelltext);

      const gekuerztePodspec = fs
        .readFileSync(podspec, 'utf8')
        .split('\n')
        .filter((zeile) => !ENTFERNTE_SKRIPTE.some((s) => zeile.includes(`TextRecognition${s}`)))
        .join('\n');
      fs.writeFileSync(podspec, gekuerztePodspec);

      return cfg;
    },
  ]);
};
