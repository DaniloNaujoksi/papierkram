/**
 * Tiefenanalyse über alle Vorgänge hinweg.
 *
 * Die Einzelfall-Rechnungen — Verjährung, Priorität, Inkassokosten, Tragfähigkeit —
 * bleiben im Code. Sie müssen reproduzierbar sein und einer Beratungsstelle
 * standhalten. Was hier dazukommt, ist genau das, was Code nicht kann: erkennen,
 * dass drei Briefe derselbe Vorgang sind, dass sich ein Muster wiederholt, oder dass
 * ein Gläubiger gerade eskaliert.
 *
 * Deshalb bekommt das Modell die gerechneten Werte als Tatsachen mitgeliefert und
 * hat ausdrücklich nicht die Aufgabe, sie nachzurechnen.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeFehler, leseApiKey } from './claude';
import { formatEuro, summe } from '../domain/betraege';
import type { Eintrag } from '../ui/useUebersicht';
import type { Strategieergebnis } from '../domain/strategie';

const SYSTEM_PROMPT = `Du bist eine erfahrene Schuldnerberaterin und siehst zum ersten Mal die vollständige Lage einer Person, die dir bisher nur einzelne Briefe gezeigt hat.

Du bekommst zwei Dinge: erstens bereits ausgerechnete Werte, zweitens die anonymisierten Brieftexte selbst. Die Texte sind vorher bereinigt worden — Name, Anschrift, Geburtsdatum und Bankverbindung stehen als Platzhalter darin. Das ist beabsichtigt.

Die mitgelieferten Rechnungen sind gesetzt. Verjährungsfristen, Prioritäten, Inkassokosten und die Tragfähigkeit sind bereits geprüft; rechne sie nicht nach und widersprich ihnen nicht. Deine Aufgabe liegt darüber:

1. ZUSAMMENHÄNGE. Welche Dokumente gehören zum selben Vorgang? Eine Rechnung, die zur Mahnung und dann zum Inkasso wurde, ist eine Forderung in drei Zuständen, nicht drei Forderungen. Nenne konkret, welche Einträge du zusammenfassen würdest und woran du es festmachst.

2. MUSTER. Wiederholt sich etwas? Eskaliert ein Gläubiger schneller als die anderen? Häufen sich Forderungen einer Art? Gibt es einen gemeinsamen Auslöser hinter mehreren Vorgängen?

3. ÜBERSEHENES. Was steht in den Briefen, das in der Erfassung nicht auftaucht — angebotene Ratenzahlungen, eingeräumte Fristverlängerungen, Widerspruchsmöglichkeiten mit laufender Frist, Hinweise auf bereits geleistete Zahlungen, Ungereimtheiten zwischen den Schreiben eines Gläubigers.

4. REIHENFOLGE. Was in den nächsten vierzehn Tagen zu tun ist, in einer Reihenfolge, mit je einem Satz Begründung. Höchstens fünf Punkte.

5. VERHANDLUNG. Wo lohnt ein Vergleich, wo eine Ratenzahlung, wo eine Stundung — und mit welchem Argument gegenüber genau diesem Gläubiger.

6. FÜR DIE BERATUNG. Welche Fragen die Person bei einer anerkannten Schuldnerberatung stellen sollte und welche Unterlagen dort fehlen.

Regeln:
- Erfinde keine Rechtsregeln, keine Fristen und keine Paragrafen. Was du nicht sicher weißt, lässt du weg oder benennst es als offene Frage.
- Keine erfundenen Wahrscheinlichkeiten und keine Erfolgsquoten.
- Sag nie, jemand müsse Insolvenz anmelden. Du darfst sagen, dass eine Prüfung durch eine anerkannte Stelle naheliegt, und warum.
- Schreib direkt, in ganzen Sätzen, ohne Fachjargon und ohne Beschwichtigung. Die Person hat die Zahlen selbst gesehen.
- Kein Aufzählungszeichen-Gewitter. Überschriften und Fließtext, Listen nur da, wo eine Reihenfolge gemeint ist.
- Wenn die Lage ruhiger ist als befürchtet, sag das auch. Das ist eine Information, keine Beschwichtigung.`;

export interface AnalyseEingabe {
  eintraege: Eintrag[];
  strategie: Strategieergebnis;
  briefe: Array<{ forderungId: number | null; typ: string; briefdatum: string | null; text: string }>;
}

export interface AnalyseErgebnis {
  text: string;
  gesendeterText: string;
}

/** Baut den Text, der an die Schnittstelle geht — vollständig einsehbar vor dem Senden. */
export function baueEingabe({ eintraege, strategie, briefe }: AnalyseEingabe): string {
  const teile: string[] = [];

  teile.push('## Gerechnete Lage\n');
  teile.push(`Einschätzung: ${strategie.ueberschrift}`);
  teile.push(`Monatlich verfügbar: ${formatEuro(strategie.verfuegbarMonat)}`);
  if (strategie.tilgungsjahre !== null) {
    teile.push(`Rechnerische Tilgungsdauer: ${Math.round(strategie.tilgungsjahre * 10) / 10} Jahre`);
  }
  if (strategie.unpfaendbarMindestens !== null) {
    teile.push(`Mindestens unpfändbar: ${formatEuro(strategie.unpfaendbarMindestens)}`);
  }
  teile.push(`Begründung: ${strategie.begruendung}\n`);

  teile.push('## Erfasste Forderungen\n');
  for (const e of eintraege) {
    const b = e.forderung.betraege;
    const zeilen = [
      `### ${e.glaeubiger?.name ?? 'Unbekannter Gläubiger'}${e.glaeubiger?.istInkasso ? ' (Inkassobüro)' : ''}`,
      e.glaeubiger?.vertrittFuer ? `Treibt ein für: ${e.glaeubiger.vertrittFuer}` : null,
      `Art: ${e.forderung.typ}`,
      `Beschreibung: ${e.forderung.titel}`,
      `Hauptforderung: ${formatEuro(b.hauptforderung)}`,
      b.zinsen ? `Zinsen: ${formatEuro(b.zinsen)}` : null,
      b.mahnkosten ? `Mahnkosten: ${formatEuro(b.mahnkosten)}` : null,
      b.inkassokosten ? `Inkassokosten: ${formatEuro(b.inkassokosten)}` : null,
      b.gerichtskosten ? `Gerichtskosten: ${formatEuro(b.gerichtskosten)}` : null,
      b.saeumniszuschlaege ? `Säumniszuschläge: ${formatEuro(b.saeumniszuschlaege)}` : null,
      `Gesamt: ${formatEuro(summe(b))}`,
      e.forderung.aktenzeichen ? `Aktenzeichen: ${e.forderung.aktenzeichen}` : null,
      e.forderung.entstandenAm ? `Entstanden: ${e.forderung.entstandenAm}` : 'Entstehungsdatum unbekannt',
      e.forderung.fristBis ? `Frist: ${e.forderung.fristBis}` : null,
      e.forderung.istTituliert ? 'Tituliert: ja' : null,
      `Verjährung (gerechnet): ${e.verjaehrung.begruendung}`,
      `Priorität (gerechnet): ${e.prioritaet.dringlichkeit} — ${e.prioritaet.begruendung}`,
      `Letztes Schreiben: ${e.letzterDokumenttyp ?? 'unbekannt'}`,
    ].filter(Boolean);
    teile.push(zeilen.join('\n') + '\n');
  }

  if (briefe.length > 0) {
    teile.push('## Anonymisierte Brieftexte\n');
    for (const brief of briefe) {
      teile.push(
        `### Schreiben (${brief.typ}${brief.briefdatum ? `, ${brief.briefdatum}` : ''}, gehört zu Forderung ${
          brief.forderungId ?? 'noch keiner'
        })\n${brief.text}\n`
      );
    }
  }

  return teile.join('\n');
}

export async function erstelleTiefenanalyse(eingabe: AnalyseEingabe): Promise<AnalyseErgebnis> {
  const apiKey = await leseApiKey();
  if (!apiKey) {
    throw new ClaudeFehler(
      'Kein API-Schlüssel hinterlegt. Trage ihn in den Einstellungen ein.',
      'kein_schluessel'
    );
  }

  const gesendeterText = baueEingabe(eingabe);
  const client = new Anthropic({ apiKey });

  try {
    const antwort = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      output_config: { effort: 'high' },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Das ist meine vollständige Lage. Sag mir, was du siehst.\n\n---\n${gesendeterText}\n---`,
        },
      ],
    });

    if (antwort.stop_reason === 'refusal') {
      throw new ClaudeFehler('Die Analyse wurde abgelehnt.', 'abgelehnt');
    }

    const block = antwort.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') {
      throw new ClaudeFehler('Leere Antwort erhalten.', 'unbekannt');
    }

    return { text: block.text, gesendeterText };
  } catch (fehler) {
    if (fehler instanceof ClaudeFehler) throw fehler;
    if (fehler instanceof Anthropic.AuthenticationError) {
      throw new ClaudeFehler('API-Schlüssel wird nicht akzeptiert.', 'auth');
    }
    if (fehler instanceof Anthropic.RateLimitError) {
      throw new ClaudeFehler('Zu viele Anfragen. Warte einen Moment.', 'limit');
    }
    if (fehler instanceof Anthropic.APIConnectionError) {
      throw new ClaudeFehler('Keine Verbindung. Versuch es später erneut.', 'netzwerk');
    }
    throw new ClaudeFehler(
      fehler instanceof Error ? fehler.message : 'Unbekannter Fehler.',
      'unbekannt'
    );
  }
}
