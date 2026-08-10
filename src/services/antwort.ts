/**
 * Antwortschreiben an Gläubiger.
 *
 * Wichtigste Konstruktion: Das Modell schreibt den Brief mit Platzhaltern —
 * [NAME], [STRASSE], [PLZ ORT]. Deine echten Daten setzt die App erst danach ein,
 * hier auf dem Gerät. Damit gilt für den Antwortgenerator dieselbe Zusage wie fürs
 * Scannen: Name, Anschrift und Kennnummern verlassen das iPhone nicht.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeFehler, leseApiKey } from './claude';
import { lesePersoenlicheDaten } from './persoenlicheDaten';
import { formatEuro, summe } from '../domain/betraege';
import type { Forderung, Glaeubiger } from '../domain/types';
import type { Verjaehrungsergebnis } from '../domain/verjaehrung';
import type { InkassoPruefErgebnis } from '../domain/inkassokosten';

export type Absicht =
  | 'ratenzahlung'
  | 'vergleich'
  | 'stundung'
  | 'verjaehrung'
  | 'forderungsaufstellung'
  | 'kosten_bestreiten'
  | 'saeumniszuschlaege_erlass';

export interface AbsichtsBeschreibung {
  id: Absicht;
  titel: string;
  wirkung: string;
  /** Warnung, wenn diese Absicht in der konkreten Lage schadet. */
  warnung?: string;
}

export const ABSICHTEN: AbsichtsBeschreibung[] = [
  {
    id: 'ratenzahlung',
    titel: 'Ratenzahlung anbieten',
    wirkung:
      'Du schlägst eine feste monatliche Rate vor. Gläubiger nehmen das meistens an, weil eine laufende Zahlung besser ist als eine Vollstreckung ins Leere.',
    warnung:
      'Ein Ratenangebot ist ein Anerkenntnis: Es lässt die Verjährung nach § 212 BGB neu beginnen. Bei einer alten oder bereits verjährten Forderung ist das der teuerste Fehler überhaupt.',
  },
  {
    id: 'vergleich',
    titel: 'Vergleich anbieten',
    wirkung:
      'Du bietest eine Einmalzahlung an, gegen die der Rest erlassen wird. Lohnt sich, wenn du an eine Summe kommst — Gläubiger lassen bei sicherem Geld oft deutlich nach.',
    warnung:
      'Auch das ist ein Anerkenntnis und startet die Verjährung neu, solange kein Erlass unterschrieben ist.',
  },
  {
    id: 'stundung',
    titel: 'Zahlungsaufschub erbitten',
    wirkung: 'Du bittest um Aufschub, ohne die Forderung zu bestreiten. Verschafft Luft, löst nichts.',
    warnung: 'Gilt ebenfalls als Anerkenntnis.',
  },
  {
    id: 'verjaehrung',
    titel: 'Verjährungseinrede erheben',
    wirkung:
      'Du erklärst, dass du wegen Verjährung nicht zahlst. Ohne diese Erklärung hilft die Verjährung nicht — ein Gericht prüft sie nicht von selbst.',
  },
  {
    id: 'forderungsaufstellung',
    titel: 'Forderungsaufstellung verlangen',
    wirkung:
      'Du verlangst eine nachvollziehbare Aufschlüsselung: woraus die Hauptforderung stammt, wie sich Zinsen und Kosten errechnen. Kostet nichts, bindet dich zu nichts und deckt oft überhöhte Posten auf.',
  },
  {
    id: 'kosten_bestreiten',
    titel: 'Überhöhte Kosten bestreiten',
    wirkung:
      'Du bestreitest den Teil der Nebenkosten, der über dem zulässigen Rahmen liegt, und nennst die Rechnung dazu. Die Hauptforderung bleibt davon unberührt.',
  },
  {
    id: 'saeumniszuschlaege_erlass',
    titel: 'Erlass der Säumniszuschläge beantragen',
    wirkung:
      'Bei Sozialversicherungsträgern: Du beantragst, die aufgelaufenen Säumniszuschläge zu erlassen oder zu ermäßigen, und bietest im Gegenzug eine verlässliche Ratenzahlung an.',
  },
];

const SYSTEM_PROMPT = `Du schreibst einen Brief an einen Gläubiger. Der Absender schreibt in eigener Sache.

Der Brief muss:
- sachlich und höflich sein, ohne Unterwürfigkeit und ohne Drohgebärde
- kurz sein: ein Sachverhalt, ein Anliegen, eine Bitte um Rückmeldung
- in ganzen Sätzen geschrieben sein, ohne Aufzählungszeichen, ohne Fettdruck, ohne Überschriften
- das Aktenzeichen nennen, wenn eines bekannt ist
- konkret sein: Beträge, Daten und Fristen ausschreiben statt zu umschreiben

Für die persönlichen Angaben verwendest du ausschließlich diese Platzhalter, wörtlich und unverändert:
[NAME] [STRASSE] [PLZ ORT] [DATUM]
Erfinde keine Namen, keine Adressen und keine Kontonummern.

Aufbau, ohne Zwischenüberschriften:
1. Anschrift des Gläubigers, wie sie dir genannt wird
2. Betreffzeile mit Aktenzeichen
3. Anrede "Sehr geehrte Damen und Herren,"
4. Der Text
5. "Mit freundlichen Grüßen" und darunter [NAME]

Regeln:
- Erfinde keine Paragrafen und keine Fristen. Nenne nur, was dir mitgeteilt wird.
- Behaupte nichts über die Rechtslage, was über das Mitgeteilte hinausgeht.
- Kein Schuldeingeständnis, wenn nicht ausdrücklich verlangt. Formuliere Angebote als Angebote.
- Setze immer eine Rückmeldefrist von zwei Wochen und bitte um schriftliche Bestätigung.
- Gib nur den Brief aus, keine Erklärung davor oder danach.`;

export interface AntwortEingabe {
  forderung: Forderung;
  glaeubiger: Glaeubiger | undefined;
  verjaehrung: Verjaehrungsergebnis;
  inkasso: InkassoPruefErgebnis | null;
  absicht: Absicht;
  /** Vorgeschlagene Monatsrate oder Vergleichssumme in Cent, wenn die Absicht das braucht. */
  betragVorschlag: number | null;
}

/**
 * Warnt, wenn die gewählte Absicht in dieser konkreten Lage schadet. Wichtiger als
 * der Brief selbst: Ein Ratenangebot auf eine verjährte Forderung macht sie wieder
 * durchsetzbar.
 */
export function pruefeAbsicht(eingabe: AntwortEingabe): string | null {
  const { absicht, verjaehrung, forderung } = eingabe;
  const anerkennend = absicht === 'ratenzahlung' || absicht === 'vergleich' || absicht === 'stundung';

  if (anerkennend && verjaehrung.ampel === 'verjaehrt' && !forderung.istTituliert) {
    return 'Diese Forderung ist vermutlich verjährt. Ein Zahlungsangebot würde sie wieder voll durchsetzbar machen — die Verjährung beginnt nach § 212 BGB von vorn. Erhebe stattdessen die Verjährungseinrede.';
  }
  if (anerkennend && verjaehrung.ampel === 'laeuft_bald_ab' && !forderung.istTituliert) {
    return `Die Verjährung läuft am ${verjaehrung.verjaehrtAm} ab. Ein Zahlungsangebot jetzt setzt die Frist zurück und verschenkt diesen Vorteil.`;
  }
  if (absicht === 'verjaehrung' && verjaehrung.ampel !== 'verjaehrt') {
    return 'Nach der Rechnung ist diese Forderung noch nicht verjährt. Eine Einrede wäre unbegründet und schwächt deine Position bei allem Weiteren.';
  }
  if (absicht === 'saeumniszuschlaege_erlass' && forderung.typ !== 'krankenkasse' && forderung.typ !== 'sozialversicherung') {
    return 'Säumniszuschläge in diesem Sinn erheben Sozialversicherungsträger. Bei diesem Gläubiger heißt der entsprechende Posten anders — prüfe, ob die Absicht passt.';
  }
  return null;
}

/** Setzt die Platzhalter mit den lokal gespeicherten Angaben. Passiert nur auf dem Gerät. */
export async function personalisiere(brieftext: string): Promise<string> {
  const d = await lesePersoenlicheDaten();
  const heute = new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return brieftext
    .replace(/\[NAME\]/g, `${d.vorname} ${d.nachname}`.trim() || '[Dein Name]')
    .replace(/\[STRASSE\]/g, d.strasse || '[Deine Straße]')
    .replace(/\[PLZ ORT\]/g, `${d.plz} ${d.ort}`.trim() || '[PLZ Ort]')
    .replace(/\[DATUM\]/g, heute);
}

export async function erstelleAntwort(eingabe: AntwortEingabe): Promise<string> {
  const apiKey = await leseApiKey();
  if (!apiKey) {
    throw new ClaudeFehler('Kein API-Schlüssel hinterlegt.', 'kein_schluessel');
  }

  const { forderung, glaeubiger, verjaehrung, inkasso, absicht, betragVorschlag } = eingabe;
  const b = forderung.betraege;
  const beschreibung = ABSICHTEN.find((a) => a.id === absicht);

  const fakten = [
    `Gläubiger: ${glaeubiger?.name ?? 'unbekannt'}`,
    glaeubiger?.adresse ? `Anschrift des Gläubigers: ${glaeubiger.adresse}` : null,
    glaeubiger?.vertrittFuer ? `Treibt ein für: ${glaeubiger.vertrittFuer}` : null,
    forderung.aktenzeichen ? `Aktenzeichen: ${forderung.aktenzeichen}` : 'Kein Aktenzeichen bekannt',
    `Hauptforderung: ${formatEuro(b.hauptforderung)}`,
    b.zinsen ? `Zinsen: ${formatEuro(b.zinsen)}` : null,
    b.mahnkosten ? `Mahnkosten: ${formatEuro(b.mahnkosten)}` : null,
    b.inkassokosten ? `Inkassokosten: ${formatEuro(b.inkassokosten)}` : null,
    b.saeumniszuschlaege ? `Säumniszuschläge: ${formatEuro(b.saeumniszuschlaege)}` : null,
    `Gesamtforderung: ${formatEuro(summe(b))}`,
    forderung.entstandenAm ? `Forderung entstanden am: ${forderung.entstandenAm}` : null,
    `Anliegen: ${beschreibung?.titel ?? absicht}`,
    betragVorschlag ? `Vorgeschlagener Betrag: ${formatEuro(betragVorschlag)}` : null,
  ].filter(Boolean);

  if (absicht === 'verjaehrung') {
    fakten.push(
      `Begründung der Verjährung, die im Brief genannt werden soll: ${verjaehrung.begruendung}`
    );
  }
  if (absicht === 'kosten_bestreiten' && inkasso) {
    fakten.push(
      `Beanstandeter Kostenanteil: ${formatEuro(inkasso.differenz)}. Zulässig wären nach der Rechnung höchstens ${formatEuro(inkasso.zulaessigMax)}. Rechenweg: ${inkasso.rechenweg.join(' ')}`
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const antwort = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 8000,
      output_config: { effort: 'medium' },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Schreib den Brief.\n\n${fakten.join('\n')}`,
        },
      ],
    });

    if (antwort.stop_reason === 'refusal') {
      throw new ClaudeFehler('Das Schreiben wurde abgelehnt.', 'abgelehnt');
    }
    const block = antwort.content.find((x) => x.type === 'text');
    if (!block || block.type !== 'text') {
      throw new ClaudeFehler('Leere Antwort erhalten.', 'unbekannt');
    }
    return block.text.trim();
  } catch (fehler) {
    if (fehler instanceof ClaudeFehler) throw fehler;
    if (fehler instanceof Anthropic.AuthenticationError) {
      throw new ClaudeFehler('API-Schlüssel wird nicht akzeptiert.', 'auth');
    }
    if (fehler instanceof Anthropic.APIConnectionError) {
      throw new ClaudeFehler('Keine Verbindung.', 'netzwerk');
    }
    throw new ClaudeFehler(fehler instanceof Error ? fehler.message : 'Unbekannter Fehler.', 'unbekannt');
  }
}
