/**
 * Platzhalter für Node-Module, die React Native nicht kennt.
 *
 * Das Anthropic-SDK kann seinen Schlüssel auch aus Dateien und Umgebungsvariablen
 * lesen und importiert dafür `node:fs`. Auf dem iPhone gibt es das nicht — und wir
 * brauchen es auch nicht, weil der Schlüssel aus dem Schlüsselbund kommt und dem
 * Client direkt übergeben wird. Der Import wird deshalb hierher umgeleitet.
 *
 * Sollte dieser Pfad wider Erwarten doch benutzt werden, gibt es einen klaren
 * Fehler statt eines unverständlichen Absturzes.
 */
const zugriffsfehler = (eigenschaft) => {
  throw new Error(
    `Node-Modul-Zugriff auf "${eigenschaft}" ist in der App nicht verfügbar. ` +
      'Wenn dieser Fehler auftaucht, versucht eine Bibliothek, auf das Dateisystem ' +
      'oder die Prozessumgebung zuzugreifen — das muss im App-Code gelöst werden.'
  );
};

module.exports = new Proxy(
  { __esModule: true },
  {
    get(_ziel, eigenschaft) {
      if (eigenschaft === '__esModule') return true;
      if (eigenschaft === 'default') return module.exports;
      return zugriffsfehler(String(eigenschaft));
    },
  }
);
