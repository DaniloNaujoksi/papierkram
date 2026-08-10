/**
 * Gesamtstrategie.
 *
 * Die Reihenfolge einzelner Forderungen steht in prioritaet.ts. Hier geht es um die
 * Frage darüber: Ist die Gesamtlage überhaupt durch Zahlen zu lösen — und wenn nicht,
 * was ist dann der richtige Weg?
 *
 * Diese Einschätzung wird gerechnet, nicht formuliert. Sie muss reproduzierbar sein
 * und einer Schuldnerberatung standhalten; eine Textvorhersage darf darüber nicht
 * entscheiden.
 */

import type { Cent } from './types';
import { formatEuro } from './betraege.ts';

export type Lage = 'unbekannt' | 'tragbar' | 'angespannt' | 'nicht_tragbar' | 'unpfaendbar';

export interface Haushaltszahlen {
  nettoeinkommenMonat: Cent;
  fixkostenMonat: Cent;
  lebenshaltungMonat: Cent;
  /** Zahl der Personen mit gesetzlichem Unterhaltsanspruch. Erhöht die Freigrenze. */
  unterhaltspflichtigePersonen: number;
  /**
   * Grundfreibetrag nach § 850c ZPO für Alleinstehende, in Cent.
   * Wird jedes Jahr zum 1. Juli angepasst und deshalb vom Benutzer gepflegt statt
   * fest einprogrammiert — ein veralteter Wert im Code wäre schlimmer als keiner.
   */
  pfaendungsfreibetragMonat: Cent | null;
  /** Erhöhungsbetrag je unterhaltsberechtigter Person, in Cent. Ebenfalls gepflegt. */
  erhoehungJePersonMonat: Cent | null;
}

export interface Strategieergebnis {
  lage: Lage;
  /** Was nach Fixkosten und Lebenshaltung monatlich für Schulden übrig bleibt. */
  verfuegbarMonat: Cent;
  /**
   * Betrag, den Gläubiger mindestens nicht anfassen dürfen. Konservativ gerechnet:
   * nur Grundfreibetrag plus Erhöhungen. Die amtliche Tabelle lässt oberhalb davon
   * einen Teil des Mehrverdienstes ebenfalls unpfändbar — der echte Schutz ist also
   * eher höher als hier ausgewiesen, nie niedriger.
   */
  unpfaendbarMindestens: Cent | null;
  /** Einkommen über der Freigrenze. Null bedeutet: Es gibt nichts zu pfänden. */
  ueberFreigrenze: Cent | null;
  /** Rechnerische Dauer bis zur Tilgung. Null, wenn nichts übrig bleibt. */
  tilgungsjahre: number | null;
  ueberschrift: string;
  begruendung: string;
  schritte: string[];
}

/** Drei Jahre Restschuldbefreiung (§ 287 InsO) mal zwei — darüber lohnt die Prüfung. */
const SCHWELLE_NICHT_TRAGBAR = 6;
const SCHWELLE_ANGESPANNT = 3;

export function berechneStrategie(
  h: Haushaltszahlen,
  gesamtschuldenOffen: Cent
): Strategieergebnis {
  const verfuegbarMonat =
    h.nettoeinkommenMonat - h.fixkostenMonat - h.lebenshaltungMonat;

  const unpfaendbarMindestens =
    h.pfaendungsfreibetragMonat === null
      ? null
      : h.pfaendungsfreibetragMonat +
        (h.erhoehungJePersonMonat ?? 0) * Math.max(0, h.unterhaltspflichtigePersonen);

  const ueberFreigrenze =
    unpfaendbarMindestens === null
      ? null
      : Math.max(0, h.nettoeinkommenMonat - unpfaendbarMindestens);

  const tilgungsjahre =
    verfuegbarMonat > 0 && gesamtschuldenOffen > 0
      ? gesamtschuldenOffen / (verfuegbarMonat * 12)
      : null;

  // Ohne Einkommensangabe wird nichts behauptet.
  if (h.nettoeinkommenMonat <= 0) {
    return {
      lage: 'unbekannt',
      verfuegbarMonat,
      unpfaendbarMindestens,
      ueberFreigrenze,
      tilgungsjahre,
      ueberschrift: 'Zahlen fehlen',
      begruendung:
        'Ohne dein Einkommen und deine laufenden Kosten lässt sich keine Reihenfolge und keine tragbare Rate berechnen. Die Forderungen sind erfasst, aber die Strategie fehlt noch.',
      schritte: ['Einkommen, Fixkosten und Lebenshaltung eintragen.'],
    };
  }

  // Der wichtigste und unbekannteste Fall: Wer unterhalb der Pfändungsfreigrenze
  // lebt, hat rechtlich nichts, was ein Gläubiger holen könnte. Freiwillige
  // Zahlungen verschlechtern die Lage — und starten obendrein die Verjährung neu.
  if (ueberFreigrenze !== null && ueberFreigrenze === 0) {
    return {
      lage: 'unpfaendbar',
      verfuegbarMonat,
      unpfaendbarMindestens,
      ueberFreigrenze,
      tilgungsjahre,
      ueberschrift: 'Dein Einkommen ist unpfändbar',
      begruendung: `Dein Nettoeinkommen liegt unterhalb der Pfändungsfreigrenze von ${formatEuro(
        unpfaendbarMindestens ?? 0
      )}. Ein Gläubiger kann davon nichts pfänden — auch mit Titel nicht. Das ändert die Lage grundlegend: Zahlungen, die du jetzt freiwillig leistest, verschlechtern deine Situation, und jede Teilzahlung lässt die Verjährung von vorn beginnen.`,
      schritte: [
        'Existenzsichernde Zahlungen weiter leisten: Miete, Strom, Unterhalt, Geldstrafen. Die gehören nicht in diese Rechnung.',
        'Ein P-Konto einrichten, bevor eine Kontopfändung kommt — es wirkt erst ab Einrichtung, nicht rückwirkend.',
        'An nachrangige Gläubiger nichts zahlen und nichts unterschreiben.',
        'Termin bei einer anerkannten Schuldnerberatung machen. Die Beratung ist kostenlos.',
      ],
    };
  }

  if (verfuegbarMonat <= 0) {
    return {
      lage: 'nicht_tragbar',
      verfuegbarMonat,
      unpfaendbarMindestens,
      ueberFreigrenze,
      tilgungsjahre,
      ueberschrift: 'Es bleibt nichts übrig',
      begruendung:
        'Nach Fixkosten und Lebenshaltung bleibt kein Geld für Schulden. Eine Ratenzahlung, die du zusagst, würdest du nicht durchhalten — und ein gebrochener Ratenplan ist schlechter als gar keiner, weil er als Anerkenntnis die Verjährung neu startet.',
      schritte: [
        'Prüfen, ob laufende Kosten sinken können — das ist der einzige Hebel, der die Rechnung ändert.',
        'Ansprüche prüfen lassen: Wohngeld, Bürgergeld, Kinderzuschlag. Viele lassen hier Geld liegen.',
        'Termin bei einer anerkannten Schuldnerberatung machen.',
        'Bis dahin nichts unterschreiben, was eine Rate zusagt.',
      ],
    };
  }

  if (tilgungsjahre === null) {
    return {
      lage: 'tragbar',
      verfuegbarMonat,
      unpfaendbarMindestens,
      ueberFreigrenze,
      tilgungsjahre,
      ueberschrift: 'Keine offenen Forderungen',
      begruendung: `Es sind keine offenen Beträge erfasst. Rechnerisch stünden dir ${formatEuro(
        verfuegbarMonat
      )} im Monat zur Verfügung.`,
      schritte: ['Weiter jeden Brief erfassen, bevor er zur Mahnung wird.'],
    };
  }

  const jahre = Math.round(tilgungsjahre * 10) / 10;

  if (tilgungsjahre <= SCHWELLE_ANGESPANNT) {
    return {
      lage: 'tragbar',
      verfuegbarMonat,
      unpfaendbarMindestens,
      ueberFreigrenze,
      tilgungsjahre,
      ueberschrift: 'Aus eigener Kraft lösbar',
      begruendung: `Mit ${formatEuro(
        verfuegbarMonat
      )} im Monat wärst du rechnerisch in ${jahre} Jahren durch. Das ist ein Zeitraum, den Gläubiger in einer Ratenvereinbarung akzeptieren.`,
      schritte: [
        'Zuerst die existenzsichernden Forderungen bedienen — Miete, Energie, Unterhalt, Geldstrafen, Krankenkasse.',
        'Bei den übrigen Gläubigern schriftlich Ratenzahlung anbieten, mit einer Rate, die du sicher hältst.',
        'Nichts zusagen, was knapp wird. Ein gebrochener Plan kostet mehr als eine niedrigere Rate.',
      ],
    };
  }

  if (tilgungsjahre <= SCHWELLE_NICHT_TRAGBAR) {
    return {
      lage: 'angespannt',
      verfuegbarMonat,
      unpfaendbarMindestens,
      ueberFreigrenze,
      tilgungsjahre,
      ueberschrift: 'Knapp, aber noch zu drehen',
      begruendung: `Rechnerisch brauchst du ${jahre} Jahre. Das ist lang genug, dass eine reine Ratenzahlung riskant wird — ein einziger Ausfall, und die Vereinbarungen platzen.`,
      schritte: [
        'Laufende Kosten prüfen: Jeder Euro hier verkürzt die Laufzeit stärker als jede Verhandlung.',
        'Bei älteren Forderungen die Verjährung prüfen, bevor du zahlst.',
        'Vergleich anbieten statt Ratenzahlung. Gläubiger nehmen häufig einen Teilbetrag als Einmalzahlung, wenn das Geld sicher ist.',
        'Beratungstermin machen, solange du noch verhandeln kannst — nicht erst, wenn vollstreckt wird.',
      ],
    };
  }

  return {
    lage: 'nicht_tragbar',
    verfuegbarMonat,
    unpfaendbarMindestens,
    ueberFreigrenze,
    tilgungsjahre,
    ueberschrift: 'Rechnerisch nicht zu schaffen',
    begruendung: `Mit ${formatEuro(
      verfuegbarMonat
    )} im Monat bräuchtest du ${jahre} Jahre. Ein Insolvenzverfahren endet nach drei Jahren mit der Restschuldbefreiung (§ 287 InsO). Du würdest also über Jahre gegen ein Verfahren antilgen, das schneller wäre. Das ist eine Rechnung, keine Empfehlung — prüfen lassen musst du sie bei einer anerkannten Stelle.`,
    schritte: [
      'Existenz sichern: Miete, Energie, Unterhalt und Geldstrafen weiter bedienen.',
      'An nachrangige Gläubiger keine neuen Ratenzusagen geben.',
      'Termin bei einer anerkannten Schuldnerberatung machen — nur die darf die Bescheinigung für ein Insolvenzverfahren ausstellen, und die Beratung ist kostenlos.',
      'Diese Akte zum Termin mitnehmen, dann geht es dort sofort um die Sache.',
    ],
  };
}
