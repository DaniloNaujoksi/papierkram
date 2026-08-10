/**
 * Priorisierung nach den Regeln der Schuldnerberatung.
 *
 * Die zentrale Einsicht, die fast jeder Überschuldete zu spät lernt: Wer zuerst den
 * lautesten Gläubiger bezahlt, macht es falsch. Bezahlt wird nach Schadenspotenzial,
 * nicht nach Tonfall des Briefs. Ein Inkassobüro schreibt in Großbuchstaben und kann
 * wenig. Das Amtsgericht schreibt höflich und kann dich einsperren.
 *
 * Rangfolge:
 *   1. Schulden, die die Freiheit kosten (Geldstrafe → Ersatzfreiheitsstrafe)
 *   2. Schulden, die das Dach kosten (Miete, Energie)
 *   3. Schulden, die die Gesundheitsversorgung kosten (Krankenkasse)
 *   4. Schulden, die strafbar werden (Unterhalt, vorenthaltene Sozialbeiträge)
 *   5. Schulden, bei denen gerade vollstreckt wird
 *   6. Alles andere, nach Kostenwachstum sortiert
 */

import type { Dokumenttyp, Forderung, Forderungstyp } from './types';
import type { Verjaehrungsergebnis } from './verjaehrung';
import { summe } from './betraege';

export type Dringlichkeit = 'sofort' | 'hoch' | 'mittel' | 'niedrig' | 'nicht_zahlen';

export interface Prioritaet {
  rangwert: number;
  dringlichkeit: Dringlichkeit;
  /** Warum diese Forderung dort steht, wo sie steht. */
  begruendung: string;
  /** Der eine nächste Schritt. Kein Katalog, eine Handlung. */
  naechsterSchritt: string;
  /** Was schiefgeht, wenn nichts passiert. */
  risiko: string | null;
}

/** Forderungen, bei denen Nichtzahlung die Existenzgrundlage angreift. */
const EXISTENZSICHERND: Record<string, { rang: number; risiko: string }> = {
  geldstrafe: {
    rang: 1000,
    risiko:
      'Bei Nichtzahlung wird die Geldstrafe in eine Ersatzfreiheitsstrafe umgewandelt. Das ist die einzige Schuld, die dich ins Gefängnis bringt. Ein Antrag auf Ratenzahlung oder gemeinnützige Arbeit bei der Staatsanwaltschaft wird fast immer bewilligt, wenn er rechtzeitig kommt.',
  },
  miete: {
    rang: 900,
    risiko:
      'Zwei Monatsmieten Rückstand berechtigen zur fristlosen Kündigung (§ 543 BGB). Wohnungsverlust macht alles andere schlimmer: ohne Adresse keine Arbeit, ohne Arbeit keine Tilgung. Wenn Wohnungslosigkeit droht, übernimmt das Jobcenter oder Sozialamt die Mietschulden oft als Darlehen (§ 22 Abs. 8 SGB II).',
  },
  energie: {
    rang: 880,
    risiko:
      'Ab 100 Euro Rückstand darf der Versorger nach Ankündigung sperren. Die Wiederinbetriebnahme kostet zusätzlich. Vor einer Sperre ist der Versorger zu einer Abwendungsvereinbarung mit Ratenzahlung verpflichtet — die musst du aber selbst verlangen.',
  },
  unterhalt: {
    rang: 860,
    risiko:
      'Unterhaltspflichtverletzung ist strafbar (§ 170 StGB). Unterhaltsschulden bleiben außerdem in der Privatinsolvenz bestehen, wenn sie vorsätzlich pflichtwidrig nicht gezahlt wurden — sie verschwinden also nicht durch die Restschuldbefreiung.',
  },
  krankenkasse: {
    rang: 840,
    risiko:
      'Bei mehr als zwei Monatsbeiträgen Rückstand ruht der Leistungsanspruch (§ 16 Abs. 3a SGB V): Es werden nur noch Notfälle, Schmerzzustände und Schwangerschaft bezahlt. Dazu laufen Säumniszuschläge von 1 Prozent pro Monat auf — 12 Prozent im Jahr, teurer als jeder Dispo.',
  },
  sozialversicherung: {
    rang: 830,
    risiko:
      'Vorenthaltene Arbeitnehmerbeiträge sind strafbar (§ 266a StGB) und bleiben von der Restschuldbefreiung ausgenommen. Diese Forderung wirst du auch durch eine Insolvenz nicht los.',
  },
  finanzamt: {
    rang: 800,
    risiko:
      'Das Finanzamt braucht kein Gericht. Es vollstreckt aus dem eigenen Bescheid heraus — Kontopfändung ohne Vorwarnung durch einen Richter ist möglich. Dafür ist es bei Stundung und Ratenzahlung gesprächsbereit, wenn man von sich aus kommt.',
  },
};

/** Schreiben, die anzeigen: Die Zwangsvollstreckung ist im Gange oder steht unmittelbar bevor. */
const VOLLSTRECKUNGSNAH: Dokumenttyp[] = [
  'kontopfaendung',
  'lohnpfaendung',
  'pfaendungsankuendigung',
  'vollstreckungsankuendigung',
  'vermoegensauskunft',
];

/** Schreiben mit laufender Frist, nach deren Ablauf ein Titel entsteht. */
const TITULIERUNGSDROHUNG: Dokumenttyp[] = ['mahnbescheid', 'vollstreckungsbescheid'];

export interface PrioritaetsEingabe {
  forderung: Forderung;
  verjaehrung: Verjaehrungsergebnis;
  /** Typ des jüngsten Schreibens zu dieser Forderung. */
  letzterDokumenttyp: Dokumenttyp | null;
  /** Tage bis zur Frist aus dem jüngsten Schreiben; negativ heißt abgelaufen. */
  tageBisFrist: number | null;
}

export function berechnePrioritaet(eingabe: PrioritaetsEingabe): Prioritaet {
  const { forderung, verjaehrung, letzterDokumenttyp, tageBisFrist } = eingabe;

  // Verjährt schlägt alles andere. Hier ist Zahlen der teuerste denkbare Fehler:
  // eine einzige Rate lässt die Frist neu beginnen und macht die Forderung wieder
  // vollwertig durchsetzbar.
  if (verjaehrung.ampel === 'verjaehrt' && !forderung.istTituliert) {
    return {
      rangwert: -100,
      dringlichkeit: 'nicht_zahlen',
      begruendung: `Vermutlich verjährt seit ${verjaehrung.verjaehrtAm}. ${verjaehrung.regel.paragraph}.`,
      naechsterSchritt:
        'Verjährungseinrede schriftlich erheben, per Einschreiben, ohne jede Zahlungszusage. Die App erstellt dir den Brief. Vorher einmal von einer Schuldnerberatung gegenlesen lassen.',
      risiko:
        'Nicht antworten ist keine Lösung: Kommt ein Mahnbescheid und du legst nicht binnen zwei Wochen Widerspruch ein, wird aus der verjährten Forderung ein 30 Jahre gültiger Titel.',
    };
  }

  const existenz = EXISTENZSICHERND[forderung.typ as Forderungstyp];
  const vollstreckungLaeuft = letzterDokumenttyp !== null && VOLLSTRECKUNGSNAH.includes(letzterDokumenttyp);
  const titulierungDroht = letzterDokumenttyp !== null && TITULIERUNGSDROHUNG.includes(letzterDokumenttyp);
  const fristKnapp = tageBisFrist !== null && tageBisFrist <= 14;

  let rangwert = 0;
  const gruende: string[] = [];
  let risiko: string | null = null;
  let naechsterSchritt: string;

  if (existenz) {
    rangwert += existenz.rang;
    gruende.push('Existenzsichernde Schuld');
    risiko = existenz.risiko;
  }

  if (vollstreckungLaeuft) {
    rangwert += 950;
    gruende.push('Zwangsvollstreckung läuft oder steht unmittelbar bevor');
    risiko =
      'Bei einer Kontopfändung ist dein Guthaben sofort blockiert — auch Miete und Lebensmittel. Schutz gibt nur ein P-Konto, und das wirkt erst ab Einrichtung, nicht rückwirkend.';
  }

  if (titulierungDroht) {
    rangwert += 700;
    gruende.push('Aus diesem Schreiben entsteht ein 30 Jahre gültiger Titel, wenn die Frist verstreicht');
    risiko =
      'Gegen einen Mahnbescheid hast du zwei Wochen Zeit für den Widerspruch, gegen einen Vollstreckungsbescheid zwei Wochen für den Einspruch. Danach ist die Forderung unangreifbar — auch wenn sie sachlich falsch war.';
  }

  if (forderung.istTituliert) {
    rangwert += 400;
    gruende.push('Bereits tituliert, jederzeit vollstreckbar');
  }

  if (fristKnapp) {
    rangwert += 300;
    gruende.push(
      tageBisFrist !== null && tageBisFrist < 0
        ? 'Frist ist bereits abgelaufen'
        : `Frist läuft in ${tageBisFrist} Tagen ab`
    );
  }

  // Säumniszuschläge und Verzugszinsen lassen die Schuld wachsen, während man wartet.
  // Je schneller eine Forderung wächst, desto eher gehört sie bedient.
  const gesamt = summe(forderung.betraege);
  if (forderung.typ === 'krankenkasse' || forderung.typ === 'sozialversicherung') {
    rangwert += 150;
    gruende.push('Säumniszuschläge von 1 Prozent pro Monat lassen die Schuld weiter wachsen');
  }
  rangwert += Math.min(100, Math.floor(gesamt / 100_00));

  const dringlichkeit: Dringlichkeit =
    rangwert >= 900 ? 'sofort' : rangwert >= 500 ? 'hoch' : rangwert >= 200 ? 'mittel' : 'niedrig';

  if (vollstreckungLaeuft) {
    naechsterSchritt =
      'Heute ein P-Konto einrichten lassen — deine Bank muss ein bestehendes Girokonto auf Antrag binnen vier Geschäftstagen umwandeln. Danach beim Gläubiger anrufen und eine Ratenzahlung anbieten.';
  } else if (titulierungDroht) {
    naechsterSchritt =
      'Frist im Kalender markieren und binnen zwei Wochen reagieren. Ist die Forderung ganz oder teilweise unberechtigt: Widerspruch einlegen. Ist sie berechtigt: trotzdem Widerspruch prüfen und parallel Ratenzahlung anbieten.';
  } else if (existenz && forderung.typ === 'krankenkasse') {
    naechsterSchritt =
      'Bei der Krankenkasse eine Ratenzahlungsvereinbarung beantragen und gleichzeitig den Erlass der Säumniszuschläge nach § 76 Abs. 2 SGB IV verlangen. Kassen lassen bei den Zuschlägen regelmäßig mit sich reden, wenn die Hauptforderung verlässlich bedient wird.';
  } else if (existenz) {
    naechsterSchritt =
      'Vor jeder anderen Zahlung bedienen. Wenn das Geld nicht reicht: sofort selbst beim Gläubiger melden und eine Ratenzahlung vorschlagen, bevor er die nächste Stufe zündet.';
  } else if (verjaehrung.ampel === 'laeuft_bald_ab') {
    naechsterSchritt =
      'Nichts zahlen, nichts unterschreiben, nicht anerkennen. Die Frist läuft bald ab. Nur reagieren, wenn ein Mahnbescheid kommt — dann aber sofort.';
  } else {
    naechsterSchritt =
      'Nachrangig. Erst bedienen, wenn die existenzsichernden Schulden und die titulierten Forderungen geregelt sind. Bis dahin genügt ein kurzes Schreiben, dass du zahlungsunfähig bist und dich meldest, sobald sich das ändert.';
  }

  return {
    rangwert,
    dringlichkeit,
    begruendung: gruende.length > 0 ? gruende.join('. ') + '.' : 'Keine besonderen Risikofaktoren erkannt.',
    naechsterSchritt,
    risiko,
  };
}
