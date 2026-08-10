import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { berechneVerjaehrung, regelFuer } from '../src/domain/verjaehrung.ts';
import { LEERE_BETRAEGE } from '../src/domain/betraege.ts';
import type { Forderung, Forderungstyp } from '../src/domain/types.ts';

function forderung(anpassung: Partial<Forderung> = {}): Forderung {
  return {
    id: 1,
    glaeubigerId: 1,
    titel: 'Testforderung',
    typ: 'sonstige',
    status: 'offen',
    betraege: { ...LEERE_BETRAEGE, hauptforderung: 50000 },
    aktenzeichen: null,
    entstandenAm: null,
    faelligAm: null,
    fristBis: null,
    istTituliert: false,
    tituliertAm: null,
    verjaehrungNeubeginnAm: null,
    verjaehrungGehemmtSeit: null,
    vorsatzVorgeworfen: false,
    notizen: null,
    erstelltAm: '2026-01-01T00:00:00Z',
    geaendertAm: '2026-01-01T00:00:00Z',
    ...anpassung,
  };
}

const HEUTE = new Date('2026-08-10T00:00:00Z');

describe('Fristen je Forderungsart', () => {
  const erwartet: Array<[Forderungstyp, number]> = [
    ['sonstige', 3],
    ['inkasso', 3],
    ['rundfunkbeitrag', 3],
    ['krankenkasse', 4],
    ['sozialversicherung', 4],
    ['finanzamt', 5],
    ['geldstrafe', 5],
  ];

  for (const [typ, jahre] of erwartet) {
    test(`${typ} verjährt in ${jahre} Jahren`, () => {
      assert.equal(regelFuer(typ, false).jahre, jahre);
    });
  }

  test('bei Vorsatz verjähren Sozialbeiträge erst nach 30 Jahren', () => {
    assert.equal(regelFuer('krankenkasse', true).jahre, 30);
    assert.match(regelFuer('krankenkasse', true).paragraph, /SGB IV/);
  });
});

describe('Regelverjährung nach BGB', () => {
  test('Frist läuft ab Jahresende, nicht ab Entstehungstag', () => {
    // Entstanden Februar 2022 -> Frist beginnt 31.12.2022 -> Ende 31.12.2025.
    // Am 10.08.2026 ist sie damit abgelaufen.
    const e = berechneVerjaehrung(forderung({ entstandenAm: '2022-02-15' }), HEUTE);
    assert.equal(e.ampel, 'verjaehrt');
    assert.equal(e.verjaehrtAm, '2025-12-31');
  });

  test('eine im Vorjahr entstandene Forderung ist offen', () => {
    const e = berechneVerjaehrung(forderung({ entstandenAm: '2024-06-01' }), HEUTE);
    assert.equal(e.ampel, 'offen');
    assert.equal(e.verjaehrtAm, '2027-12-31');
  });

  test('Fälligkeitsdatum springt ein, wenn das Entstehungsdatum fehlt', () => {
    const e = berechneVerjaehrung(forderung({ faelligAm: '2022-03-01' }), HEUTE);
    assert.equal(e.verjaehrtAm, '2025-12-31');
  });

  test('ohne jedes Datum wird nichts behauptet', () => {
    const e = berechneVerjaehrung(forderung(), HEUTE);
    assert.equal(e.ampel, 'unbekannt');
    assert.equal(e.verjaehrtAm, null);
    assert.match(e.hinweis ?? '', /Forderungsaufstellung/);
  });
});

describe('Krankenkasse rechnet vier Jahre', () => {
  test('eine Forderung von 2022 ist 2026 noch nicht verjährt', () => {
    // Genau der Fall, in dem die BGB-Frist ein falsches Ergebnis liefern würde.
    const e = berechneVerjaehrung(
      forderung({ typ: 'krankenkasse', entstandenAm: '2022-05-01' }),
      HEUTE
    );
    assert.equal(e.verjaehrtAm, '2026-12-31');
    assert.notEqual(e.ampel, 'verjaehrt');
  });
});

describe('Titulierte Forderungen', () => {
  test('30 Jahre ab Titulierung, nicht ab Jahresende', () => {
    const e = berechneVerjaehrung(
      forderung({ istTituliert: true, tituliertAm: '2020-03-15' }),
      HEUTE
    );
    assert.equal(e.verjaehrtAm, '2050-03-15');
    assert.equal(e.ampel, 'offen');
    assert.match(e.hinweis ?? '', /P-Konto/);
  });

  test('ohne Titulierungsdatum wird nicht geraten', () => {
    const e = berechneVerjaehrung(forderung({ istTituliert: true }), HEUTE);
    assert.equal(e.verjaehrtAm, null);
    assert.match(e.begruendung, /Datum der Titulierung fehlt/);
  });
});

describe('Neubeginn und Hemmung', () => {
  test('eine Zahlung setzt die Frist komplett zurück', () => {
    // Ohne Neubeginn wäre die Forderung längst verjährt. Das ist die teuerste
    // Falle überhaupt, deshalb muss die Rechnung hier stimmen.
    const e = berechneVerjaehrung(
      forderung({ entstandenAm: '2018-01-01', verjaehrungNeubeginnAm: '2024-09-01' }),
      HEUTE
    );
    assert.equal(e.ampel, 'offen');
    assert.equal(e.verjaehrtAm, '2027-12-31');
    assert.match(e.begruendung, /§ 212 BGB/);
  });

  test('Hemmung schiebt das Fristende nach hinten', () => {
    const ohne = berechneVerjaehrung(forderung({ entstandenAm: '2024-01-01' }), HEUTE);
    const mit = berechneVerjaehrung(
      forderung({ entstandenAm: '2024-01-01', verjaehrungGehemmtSeit: '2026-01-01' }),
      HEUTE
    );
    assert.ok(
      new Date(mit.verjaehrtAm!) > new Date(ohne.verjaehrtAm!),
      'gehemmte Frist muss später enden als ungehemmte'
    );
  });
});

describe('Ampel', () => {
  test('warnt, bevor die Frist abläuft', () => {
    // Ende 31.12.2026, heute 10.08.2026 -> 143 Tage, also innerhalb der 180.
    const e = berechneVerjaehrung(forderung({ entstandenAm: '2023-04-01' }), HEUTE);
    assert.equal(e.ampel, 'laeuft_bald_ab');
    assert.match(e.hinweis ?? '', /Mahnbescheid/);
  });

  test('verjährt heißt: nicht zahlen, aber Einrede erheben', () => {
    const e = berechneVerjaehrung(forderung({ entstandenAm: '2020-01-01' }), HEUTE);
    assert.equal(e.ampel, 'verjaehrt');
    assert.match(e.hinweis ?? '', /Verjährungseinrede/);
  });
});
