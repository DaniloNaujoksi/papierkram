import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { berechneStrategie, type Haushaltszahlen } from '../src/domain/strategie.ts';

function haushalt(a: Partial<Haushaltszahlen> = {}): Haushaltszahlen {
  return {
    nettoeinkommenMonat: 220000, // 2.200 €
    fixkostenMonat: 110000, // 1.100 €
    lebenshaltungMonat: 60000, // 600 €
    unterhaltspflichtigePersonen: 0,
    pfaendungsfreibetragMonat: 156000, // 1.560 €, vom Benutzer gepflegt
    erhoehungJePersonMonat: 58000, // 580 €
    ...a,
  };
}

describe('Verfügbarer Betrag', () => {
  test('Einkommen minus Fixkosten minus Lebenshaltung', () => {
    const e = berechneStrategie(haushalt(), 500000);
    assert.equal(e.verfuegbarMonat, 50000);
  });
});

describe('Ohne Zahlen wird nichts behauptet', () => {
  test('kein Einkommen ergibt keine Lage', () => {
    const e = berechneStrategie(haushalt({ nettoeinkommenMonat: 0 }), 500000);
    assert.equal(e.lage, 'unbekannt');
    assert.match(e.begruendung, /Ohne dein Einkommen/);
  });
});

describe('Unpfändbares Einkommen', () => {
  test('unter der Freigrenze schlägt alles andere', () => {
    // 1.400 € netto, Freigrenze 1.560 € — es gibt nichts zu pfänden.
    const e = berechneStrategie(
      haushalt({ nettoeinkommenMonat: 140000, fixkostenMonat: 80000, lebenshaltungMonat: 40000 }),
      500000
    );
    assert.equal(e.lage, 'unpfaendbar');
    assert.equal(e.ueberFreigrenze, 0);
  });

  test('warnt vor freiwilligen Zahlungen und dem Neubeginn der Verjährung', () => {
    const e = berechneStrategie(haushalt({ nettoeinkommenMonat: 140000 }), 500000);
    assert.match(e.begruendung, /Verjährung von vorn/);
    assert.ok(e.schritte.some((s) => s.includes('P-Konto')));
  });

  test('Unterhaltspflichten heben die Freigrenze', () => {
    // 2.200 € netto liegen über 1.560 €, aber unter 1.560 + 2 × 580 = 2.720 €.
    const e = berechneStrategie(haushalt({ unterhaltspflichtigePersonen: 2 }), 500000);
    assert.equal(e.lage, 'unpfaendbar');
    assert.equal(e.unpfaendbarMindestens, 272000);
  });

  test('ohne gepflegten Freibetrag wird die Freigrenze nicht erfunden', () => {
    const e = berechneStrategie(
      haushalt({ pfaendungsfreibetragMonat: null, erhoehungJePersonMonat: null }),
      500000
    );
    assert.equal(e.unpfaendbarMindestens, null);
    assert.equal(e.ueberFreigrenze, null);
    assert.notEqual(e.lage, 'unpfaendbar');
  });
});

describe('Tragfähigkeit', () => {
  test('bis drei Jahre gilt als aus eigener Kraft lösbar', () => {
    // 500 € im Monat, 12.000 € Schulden -> 2 Jahre.
    const e = berechneStrategie(haushalt(), 1200000);
    assert.equal(e.lage, 'tragbar');
    assert.equal(Math.round(e.tilgungsjahre! * 10) / 10, 2);
  });

  test('drei bis sechs Jahre gilt als angespannt', () => {
    // 500 € im Monat, 30.000 € -> 5 Jahre.
    const e = berechneStrategie(haushalt(), 3000000);
    assert.equal(e.lage, 'angespannt');
    assert.ok(e.schritte.some((s) => s.includes('Vergleich')));
  });

  test('über sechs Jahre wird auf die Restschuldbefreiung verwiesen', () => {
    // 500 € im Monat, 60.000 € -> 10 Jahre.
    const e = berechneStrategie(haushalt(), 6000000);
    assert.equal(e.lage, 'nicht_tragbar');
    assert.match(e.begruendung, /§ 287 InsO/);
  });

  test('die Aussage bleibt eine Rechnung, keine Anweisung', () => {
    const e = berechneStrategie(haushalt(), 6000000);
    assert.ok(
      !/du musst .*insolvenz/i.test(e.begruendung + e.schritte.join(' ')),
      'darf keine Insolvenz anordnen'
    );
    assert.ok(
      e.schritte.some((s) => s.includes('Schuldnerberatung')),
      'muss auf anerkannte Beratung verweisen'
    );
  });
});

describe('Nichts übrig', () => {
  test('negativer Rest ist nicht tragbar, auch bei kleiner Schuld', () => {
    const e = berechneStrategie(
      haushalt({ fixkostenMonat: 180000, lebenshaltungMonat: 60000 }),
      100000
    );
    assert.equal(e.lage, 'nicht_tragbar');
    assert.ok(e.verfuegbarMonat < 0);
    assert.match(e.begruendung, /Anerkenntnis/);
  });
});

describe('Keine Schulden erfasst', () => {
  test('meldet keine Lage statt einer erfundenen', () => {
    const e = berechneStrategie(haushalt(), 0);
    assert.equal(e.tilgungsjahre, null);
    assert.equal(e.lage, 'tragbar');
  });
});
