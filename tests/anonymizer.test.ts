import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEERE_PERSOENLICHE_DATEN,
  anonymisiere,
  type PersoenlicheDaten,
} from '../src/services/anonymizer.ts';

/**
 * Diese Tests sind das Sicherheitsnetz für das einzige Versprechen der App, das
 * wirklich zählt: dass keine Angabe zur Person das Gerät verlässt. Jeder Treffer,
 * der hier durchrutscht, geht in echt an eine fremde Schnittstelle.
 */
const DANIEL: PersoenlicheDaten = {
  vorname: 'Daniel',
  nachname: 'Naujocks',
  weitereNamen: ['Naujoks'],
  strasse: 'Musterstraße 12',
  plz: '10115',
  ort: 'Berlin',
  geburtsdatum: '07.03.1985',
  kennnummern: ['A123456789'],
};

const BRIEF = `AOK Nordost
Kundencenter Berlin

Herrn
Daniel Naujocks
Musterstraße 12
10115 Berlin

Versichertennummer: A123456789
Geburtsdatum: 07.03.1985

Sehr geehrter Herr Naujocks,

unser Aktenzeichen: BEI-2024-88231
für den Zeitraum 01.01.2023 bis 31.12.2023 sind Beiträge in Höhe von
1.847,20 EUR offen. Hinzu kommen Säumniszuschläge von 221,60 EUR.

Bitte überweisen Sie bis zum 25.08.2026 auf
IBAN DE02 1203 0000 0000 2020 51.`;

describe('Was entfernt werden muss', () => {
  const { text } = anonymisiere(BRIEF, DANIEL);

  test('Nachname verschwindet, auch in der Anrede', () => {
    assert.ok(!text.includes('Naujocks'), 'Nachname steht noch im Text');
  });

  test('Vorname verschwindet', () => {
    assert.ok(!text.includes('Daniel'), 'Vorname steht noch im Text');
  });

  test('abweichende Schreibweise verschwindet ebenfalls', () => {
    assert.ok(!text.includes('Naujoks'), 'Variante des Nachnamens steht noch im Text');
  });

  test('Straße mit Hausnummer verschwindet', () => {
    assert.ok(!text.includes('Musterstraße 12'), 'Anschrift steht noch im Text');
  });

  test('Postleitzahl und Ort verschwinden', () => {
    assert.ok(!text.includes('10115'), 'Postleitzahl steht noch im Text');
  });

  test('Geburtsdatum verschwindet', () => {
    assert.ok(!text.includes('07.03.1985'), 'Geburtsdatum steht noch im Text');
  });

  test('Versichertennummer verschwindet', () => {
    assert.ok(!text.includes('A123456789'), 'Kennnummer steht noch im Text');
  });

  test('IBAN verschwindet', () => {
    assert.ok(!text.includes('DE02'), 'IBAN steht noch im Text');
    assert.ok(text.includes('[IBAN]'), 'IBAN wurde nicht durch Platzhalter ersetzt');
  });
});

describe('Was erhalten bleiben muss', () => {
  const { text } = anonymisiere(BRIEF, DANIEL);

  test('Gläubiger bleibt lesbar', () => {
    assert.ok(text.includes('AOK Nordost'), 'Gläubigername fehlt');
  });

  test('Aktenzeichen bleibt erhalten', () => {
    // Ohne Aktenzeichen ist die Auswertung wertlos, und ohne die Datenbank des
    // Gläubigers sagt es niemandem etwas.
    assert.ok(text.includes('BEI-2024-88231'), 'Aktenzeichen wurde zerstört');
  });

  test('Beträge bleiben unangetastet', () => {
    assert.ok(text.includes('1.847,20'), 'Hauptforderung fehlt');
    assert.ok(text.includes('221,60'), 'Säumniszuschläge fehlen');
  });

  test('Fristen und Zeiträume bleiben stehen', () => {
    assert.ok(text.includes('25.08.2026'), 'Zahlungsfrist fehlt');
    assert.ok(text.includes('01.01.2023'), 'Zeitraumbeginn fehlt');
    assert.ok(text.includes('31.12.2023'), 'Zeitraumende fehlt');
  });
});

describe('Rückmeldung an den Benutzer', () => {
  test('entfernte Kategorien werden gemeldet', () => {
    const { ersetzungen } = anonymisiere(BRIEF, DANIEL);
    const kategorien = ersetzungen.map((e) => e.kategorie);
    assert.ok(kategorien.includes('Name'));
    assert.ok(kategorien.includes('Anschrift'));
    assert.ok(kategorien.includes('Bankverbindung (IBAN)'));
    assert.ok(ersetzungen.every((e) => e.anzahl > 0));
  });

  test('ohne hinterlegte Daten wird laut gewarnt statt still gesendet', () => {
    const { warnungen, text } = anonymisiere(BRIEF, LEERE_PERSOENLICHE_DATEN);
    assert.ok(warnungen.length >= 2, 'zu wenige Warnungen bei leeren Stammdaten');
    assert.ok(
      warnungen.some((w) => w.includes('Nachname')),
      'fehlender Nachname wird nicht gemeldet'
    );
    // Die IBAN muss trotzdem raus — sie wird am Muster erkannt, nicht am Abgleich.
    assert.ok(!text.includes('DE02'), 'IBAN blieb trotz Mustererkennung stehen');
  });

  test('sehr kurzer Nachname wird nicht blind ersetzt, sondern gemeldet', () => {
    // Ein Nachname wie "Li" würde sonst in normalen Wörtern Treffer erzeugen.
    const { warnungen } = anonymisiere('Sehr geehrter Herr Li, die Lieferung...', {
      ...LEERE_PERSOENLICHE_DATEN,
      nachname: 'Li',
    });
    assert.ok(
      warnungen.some((w) => w.includes('kurz')),
      'kurzer Nachname wird nicht als Risiko gemeldet'
    );
  });
});

describe('Schreibweisen des Geburtsdatums', () => {
  const daten = { ...LEERE_PERSOENLICHE_DATEN, nachname: 'Muster', geburtsdatum: '07.03.1985' };

  test('führende Nullen weggelassen', () => {
    const { text } = anonymisiere('geboren am 7.3.1985 in Berlin', daten);
    assert.ok(!text.includes('7.3.1985'));
  });

  test('ISO-Schreibweise', () => {
    const { text } = anonymisiere('Geburtsdatum 1985-03-07', daten);
    assert.ok(!text.includes('1985-03-07'));
  });

  test('ISO-Eingabe findet die deutsche Schreibweise im Brief', () => {
    const { text } = anonymisiere('geboren am 07.03.1985', {
      ...daten,
      geburtsdatum: '1985-03-07',
    });
    assert.ok(!text.includes('07.03.1985'));
  });
});
