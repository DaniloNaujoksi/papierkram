# Papierkram

Private App zum Erfassen und Ordnen offener Forderungen. Brief abfotografieren, Text
wird auf dem Gerät erkannt, anonymisiert ausgewertet — daraus entsteht eine sortierte
Übersicht mit Verjährungsrechnung, Kostenprüfung und dem jeweils nächsten Schritt.

## Datenfluss

```
Scan (VisionKit)  ->  bleibt in App-Documents, verlässt das Gerät nie
      |
   OCR (ML Kit, offline auf dem iPhone)
      |
   Anonymisierer  ->  Name, Adresse, Geburtsdatum, IBAN, Kennnummern raus
      |
   Claude API     ->  nur der anonymisierte Text; zurück kommt strukturiertes JSON
      |
   Prüfansicht    ->  jedes Feld editierbar, unsichere Werte markiert
      |
   SQLite lokal   ->  Regelwerk rechnet Verjährung, Priorität, Inkassokosten
```

Vor jedem Versand zeigt die App den exakten Text, der hinausgeht.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `app/` | Screens (expo-router): Übersicht, Scannen, Einstellungen, Prüfen, Detailansicht |
| `src/domain/` | Rechtslogik ohne UI: Verjährung, Priorisierung, Inkassokosten, Beträge |
| `src/db/` | SQLite-Schema, Migrationen, Repository |
| `src/services/` | OCR, Anonymisierer, Claude-Anbindung, Schlüsselbund |
| `src/ui/` | Farben, Typografie, gemeinsame Bausteine |

Die Rechtslogik in `src/domain/` hängt an keinem React-Import und ist damit unabhängig
von der Oberfläche testbar.

## Bauen und aufs iPhone bringen

Native Module (Dokumentenscanner, ML Kit) laufen nicht in Expo Go — es braucht einen
eigenen Build. Der läuft über GitHub Actions auf einem macOS-Runner und erzeugt eine
unsignierte IPA zum Sideloaden, genau wie bei dan-fishing.

```bash
git push                       # Build startet automatisch auf main
gh run watch --exit-status     # warten, bis grün
gh run download --name papierkram-ipa
```

Der iOS-Ordner liegt bewusst nicht im Repo. Er wird bei jedem Build aus `app.json`
neu erzeugt (`expo prebuild`), damit die Konfiguration nur an einer Stelle steht.

## Zwei Stolperstellen

**Der Config-Plugin-Eintrag des Scanners fehlt absichtlich.** Das npm-Paket
`react-native-document-scanner-plugin` verweist in seiner `app.plugin.js` auf einen
Build-Ordner, der im veröffentlichten Paket nicht enthalten ist — ein Eintrag unter
`plugins` lässt `expo prebuild` mit `MODULE_NOT_FOUND` abbrechen. Das Plugin setzt
ohnehin nur `NSCameraUsageDescription`, und das steht bereits direkt in
`app.json` unter `ios.infoPlist`.

**ML Kit ist für die neue Architektur nicht offiziell getestet.** `expo-doctor`
meldet das, und ab SDK 57 ist die neue Architektur nicht mehr abschaltbar. Der
Interop-Layer sollte das Modul tragen, weil es nur eine Promise-Methode anbietet —
sicher ist das aber erst nach dem ersten Lauf auf dem Gerät. Das ist der Punkt, den
der erste Build zeigen muss.

## Noch offen

- Briefgenerator: Ratenzahlung, Vergleichsangebot, Verjährungseinrede
- Haushaltsrechnung: pfändungsfreies Einkommen, monatlich tragbare Rate
- Fristen-Erinnerungen per lokaler Benachrichtigung
- Zahlungen erfassen, inklusive Warnung vor ungewolltem Anerkenntnis

## Wichtig

Die App rechnet und formuliert, sie berät nicht. Für eine Privatinsolvenz ist die
Bescheinigung einer anerkannten Schuldnerberatungsstelle nötig; die kann kein Programm
ausstellen. Die Beratung dort ist kostenlos — mit den Daten aus dieser App geht sie
deutlich schneller.
