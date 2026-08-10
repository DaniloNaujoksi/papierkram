const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Beschneidet die ML-Kit-Texterkennung auf lateinische Schrift.
 *
 * Die Podspec des Pakets zieht fünf Schriftmodelle herein — Latein, Chinesisch,
 * Devanagari, Japanisch, Koreanisch. Deutsche Behördenpost braucht davon genau eines.
 * Die übrigen vier landen ungenutzt in der App und blähen sie um mehrere hundert
 * Megabyte auf. Das ist beim Sideloading spürbar, weil die App regelmäßig neu
 * übertragen und signiert werden muss.
 *
 * Die Podspec liegt in node_modules und wird bei jedem Build neu installiert, deshalb
 * wird sie hier vor `pod install` angepasst statt einmalig von Hand.
 */
const NICHT_LATEINISCH = [
  'TextRecognitionChinese',
  'TextRecognitionDevanagari',
  'TextRecognitionJapanese',
  'TextRecognitionKorean',
];

module.exports = function withMlKitNurLatein(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podspec = path.join(
        cfg.modRequest.projectRoot,
        'node_modules',
        '@react-native-ml-kit',
        'text-recognition',
        'RNMLKitTextRecognition.podspec'
      );

      if (!fs.existsSync(podspec)) {
        // Kein harter Abbruch: Der Build soll auch dann laufen, wenn das Paket
        // umbenannt wurde. Dann ist die App nur größer als nötig.
        console.warn('[withMlKitNurLatein] Podspec nicht gefunden, überspringe Kürzung.');
        return cfg;
      }

      const original = fs.readFileSync(podspec, 'utf8');
      const gekuerzt = original
        .split('\n')
        .filter((zeile) => !NICHT_LATEINISCH.some((skript) => zeile.includes(skript)))
        .join('\n');

      if (gekuerzt !== original) {
        fs.writeFileSync(podspec, gekuerzt);
      }

      return cfg;
    },
  ]);
};
