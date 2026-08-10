import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEERE_BETRAEGE,
  formatEuro,
  nebenkosten,
  parseEuroZuCent,
  summe,
  summendifferenz,
} from '../src/domain/betraege.ts';

describe('Beträge einlesen', () => {
  test('deutsches Format mit Tausenderpunkt', () => {
    assert.equal(parseEuroZuCent('1.234,56'), 123456);
    assert.equal(parseEuroZuCent('12.345,00'), 1234500);
  });

  test('Eurozeichen und Leerzeichen stören nicht', () => {
    assert.equal(parseEuroZuCent('1.234,56 €'), 123456);
    assert.equal(parseEuroZuCent('  89,90  '), 8990);
  });

  test('Betrag ohne Komma', () => {
    assert.equal(parseEuroZuCent('450'), 45000);
  });

  test('englisches Format mit Punkt als Dezimaltrenner', () => {
    assert.equal(parseEuroZuCent('1234.56'), 123456);
  });

  test('leere und unsinnige Eingaben ergeben null statt null Euro', () => {
    // Wichtige Unterscheidung: "nichts eingetragen" ist nicht dasselbe wie
    // "null Euro gefordert". Ein stilles 0 würde eine Forderung verschwinden lassen.
    assert.equal(parseEuroZuCent(''), null);
    assert.equal(parseEuroZuCent('   '), null);
    assert.equal(parseEuroZuCent('keine Angabe'), null);
  });

  test('Rundung auf ganze Cent', () => {
    assert.equal(parseEuroZuCent('0,005'), 1);
    assert.equal(parseEuroZuCent('0,004'), 0);
  });
});

describe('Summen', () => {
  const b = {
    ...LEERE_BETRAEGE,
    hauptforderung: 40000,
    zinsen: 1250,
    mahnkosten: 500,
    inkassokosten: 7000,
    saeumniszuschlaege: 2000,
  };

  test('Summe zählt alle Posten', () => {
    assert.equal(summe(b), 50750);
  });

  test('Nebenkosten sind alles über der Hauptforderung', () => {
    assert.equal(nebenkosten(b), 10750);
  });

  test('Differenz zur genannten Gesamtsumme wird erkannt', () => {
    assert.equal(summendifferenz({ ...b, gefordertGesamt: 52000 }), 1250);
    assert.equal(summendifferenz({ ...b, gefordertGesamt: 50750 }), 0);
  });

  test('ohne genannte Gesamtsumme gibt es keine Differenz', () => {
    assert.equal(summendifferenz(b), null);
  });
});

describe('Anzeige', () => {
  test('Cent werden als Euro dargestellt', () => {
    // Non-breaking space vor dem Eurozeichen normalisieren, damit der Test
    // nicht an der Locale-Formatierung scheitert.
    assert.equal(formatEuro(123456).replace(/ /g, ' '), '1.234,56 €');
    assert.equal(formatEuro(0).replace(/ /g, ' '), '0,00 €');
  });
});
