/**
 * Prüfung von Inkassokosten.
 *
 * Seit dem 1. Oktober 2021 sind die Gebühren, die ein Inkassobüro einem Verbraucher
 * in Rechnung stellen darf, deutlich gedeckelt. Viele Büros rechnen trotzdem nach
 * altem Muster ab, weil kaum jemand nachrechnet. Das ist bares Geld: bei einer
 * Forderung von 400 Euro liegen zwischen zulässiger und typisch verlangter Gebühr
 * schnell 50 bis 80 Euro.
 *
 * Die Rechnung hier ist eine Plausibilitätsprüfung, kein Gutachten. Sie liefert dir
 * das Argument und die Zahl, mit der du den Posten schriftlich bestreitest.
 */

import type { Cent } from './types';
import { formatEuro } from './betraege';

/**
 * Gebührentabelle nach § 13 Abs. 1 RVG (Fassung seit dem KostRÄG 2021).
 * Werte in Cent für eine 1,0-Gebühr, gestaffelt nach Gegenstandswert.
 */
const RVG_TABELLE: Array<{ bisWert: Cent; gebuehr: Cent }> = [
  { bisWert: 500_00, gebuehr: 49_00 },
  { bisWert: 1_000_00, gebuehr: 88_00 },
  { bisWert: 1_500_00, gebuehr: 127_00 },
  { bisWert: 2_000_00, gebuehr: 166_00 },
  { bisWert: 3_000_00, gebuehr: 222_00 },
  { bisWert: 4_000_00, gebuehr: 278_00 },
  { bisWert: 5_000_00, gebuehr: 334_00 },
  { bisWert: 6_000_00, gebuehr: 390_00 },
  { bisWert: 7_000_00, gebuehr: 446_00 },
  { bisWert: 8_000_00, gebuehr: 502_00 },
  { bisWert: 9_000_00, gebuehr: 558_00 },
  { bisWert: 10_000_00, gebuehr: 614_00 },
  { bisWert: 13_000_00, gebuehr: 666_00 },
  { bisWert: 16_000_00, gebuehr: 718_00 },
  { bisWert: 19_000_00, gebuehr: 770_00 },
  { bisWert: 22_000_00, gebuehr: 822_00 },
  { bisWert: 25_000_00, gebuehr: 874_00 },
  { bisWert: 30_000_00, gebuehr: 955_00 },
  { bisWert: 35_000_00, gebuehr: 1_036_00 },
  { bisWert: 40_000_00, gebuehr: 1_117_00 },
  { bisWert: 45_000_00, gebuehr: 1_198_00 },
  { bisWert: 50_000_00, gebuehr: 1_279_00 },
];

export interface InkassoPruefEingabe {
  hauptforderung: Cent;
  /** Was das Inkassobüro an eigenen Kosten verlangt. */
  verlangteInkassokosten: Cent;
  /** Bestreitest du die Forderung inhaltlich? Unbestritten heißt: niedrigerer Gebührendeckel. */
  forderungBestritten: boolean;
  /** Ist dies das erste Schreiben des Inkassobüros in dieser Sache? */
  ersteZahlungsaufforderung: boolean;
  /**
   * Ist der ursprüngliche Gläubiger vorsteuerabzugsberechtigt? Bei Unternehmen fast immer ja.
   * Dann darf die Umsatzsteuer auf die Inkassokosten NICHT an dich weitergegeben werden.
   */
  glaeubigerVorsteuerabzugsberechtigt: boolean;
}

export interface InkassoPruefErgebnis {
  /** Höchstbetrag, den das Büro nach unserer Rechnung verlangen darf. */
  zulaessigMax: Cent;
  gebuehrensatz: number;
  differenz: Cent;
  beanstandet: boolean;
  /** Rechenweg, Position für Position, zum Zitieren im Widerspruchsbrief. */
  rechenweg: string[];
  begruendung: string;
}

function grundgebuehr(gegenstandswert: Cent): Cent {
  for (const stufe of RVG_TABELLE) {
    if (gegenstandswert <= stufe.bisWert) return stufe.gebuehr;
  }
  // Über 50.000 Euro ist Inkasso gegen Privatpersonen so selten, dass eine
  // Schätzung mehr schadet als nützt. Wir geben die höchste bekannte Stufe zurück
  // und markieren das Ergebnis später als nicht belastbar.
  return RVG_TABELLE[RVG_TABELLE.length - 1].gebuehr;
}

export function pruefeInkassokosten(eingabe: InkassoPruefEingabe): InkassoPruefErgebnis {
  const {
    hauptforderung,
    verlangteInkassokosten,
    forderungBestritten,
    ersteZahlungsaufforderung,
    glaeubigerVorsteuerabzugsberechtigt,
  } = eingabe;

  const rechenweg: string[] = [];

  // Der Gebührensatz nach Nr. 2300 VV RVG. Der Regelfall beim Verbraucherinkasso ist
  // nicht die 1,3-Gebühr, mit der viele Büros rechnen, sondern deutlich weniger.
  let satz: number;
  let satzBegruendung: string;
  if (ersteZahlungsaufforderung && !forderungBestritten) {
    satz = 0.5;
    satzBegruendung =
      'Erste Zahlungsaufforderung an einen Verbraucher bei unbestrittener Forderung: höchstens eine 0,5-Gebühr (Nr. 2300 VV RVG in der Fassung seit dem 1. Oktober 2021).';
  } else if (!forderungBestritten) {
    satz = 0.9;
    satzBegruendung =
      'Unbestrittene Forderung: höchstens eine 0,9-Gebühr (Nr. 2300 VV RVG). Die vielfach abgerechnete 1,3-Gebühr setzt eine umfangreiche oder schwierige Tätigkeit voraus, die beim reinen Mahnen nicht vorliegt.';
  } else {
    satz = 1.3;
    satzBegruendung =
      'Bestrittene Forderung: die Schwellengebühr von 1,3 ist die Obergrenze für den Normalfall (Nr. 2300 VV RVG). Höher geht es nur bei nachweislich umfangreicher oder schwieriger Tätigkeit.';
  }

  const basis = grundgebuehr(hauptforderung);
  const gebuehr = Math.round(basis * satz);
  rechenweg.push(
    `Gegenstandswert ${formatEuro(hauptforderung)} ergibt eine 1,0-Gebühr von ${formatEuro(basis)} (§ 13 RVG).`
  );
  rechenweg.push(`Gebührensatz ${satz.toFixed(1).replace('.', ',')} ergibt ${formatEuro(gebuehr)}.`);

  // Auslagenpauschale nach Nr. 7002 VV RVG: 20 Prozent der Gebühr, höchstens 20 Euro.
  const auslagen = Math.min(20_00, Math.round(gebuehr * 0.2));
  rechenweg.push(`Auslagenpauschale 20 Prozent, gedeckelt auf 20,00 Euro: ${formatEuro(auslagen)} (Nr. 7002 VV RVG).`);

  const zwischensumme = gebuehr + auslagen;

  // Umsatzsteuer darf nur weitergereicht werden, wenn sie beim Gläubiger tatsächlich
  // als Schaden hängen bleibt. Ist er vorsteuerabzugsberechtigt, holt er sie sich vom
  // Finanzamt zurück und darf sie dir nicht zusätzlich berechnen.
  let ust = 0;
  if (glaeubigerVorsteuerabzugsberechtigt) {
    rechenweg.push(
      'Keine Umsatzsteuer: Der Gläubiger ist vorsteuerabzugsberechtigt, ihm entsteht dadurch kein Schaden. Wird sie trotzdem berechnet, ist der Posten zu streichen.'
    );
  } else {
    ust = Math.round(zwischensumme * 0.19);
    rechenweg.push(`Umsatzsteuer 19 Prozent: ${formatEuro(ust)}.`);
  }

  const zulaessigMax = zwischensumme + ust;
  const differenz = verlangteInkassokosten - zulaessigMax;
  const beanstandet = differenz > 0;

  rechenweg.push(`Zulässiger Höchstbetrag: ${formatEuro(zulaessigMax)}.`);
  rechenweg.push(`Tatsächlich verlangt: ${formatEuro(verlangteInkassokosten)}.`);

  const begruendung = beanstandet
    ? `${satzBegruendung} Danach sind höchstens ${formatEuro(zulaessigMax)} zu erstatten. Verlangt werden ${formatEuro(verlangteInkassokosten)} — ${formatEuro(differenz)} zu viel. Diesen Teilbetrag kannst du schriftlich bestreiten und dabei eine nachvollziehbare Aufschlüsselung der Gebühren verlangen; dazu ist das Inkassounternehmen nach § 13a RDG ohnehin verpflichtet.`
    : `${satzBegruendung} Die verlangten ${formatEuro(verlangteInkassokosten)} liegen innerhalb des zulässigen Rahmens von ${formatEuro(zulaessigMax)}. Hier lohnt der Streit nicht.`;

  return { zulaessigMax, gebuehrensatz: satz, differenz, beanstandet, rechenweg, begruendung };
}
