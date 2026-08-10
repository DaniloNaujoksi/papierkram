/**
 * Auswertung des anonymisierten Brieftextes durch Claude.
 *
 * Was hier hinausgeht, ist ausschließlich der Text, den der Anonymisierer freigegeben
 * hat — kein Bild, keine Adresse, kein Name, keine Bankverbindung. Zurück kommt ein
 * strukturierter Datensatz, den du in der Prüfansicht Feld für Feld korrigieren kannst,
 * bevor irgendetwas gespeichert wird.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as SecureStore from 'expo-secure-store';
import type { Dokumenttyp, Forderungstyp } from '../domain/types';

const SCHLUESSEL_API_KEY = 'anthropic_api_key';

export async function speichereApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(SCHLUESSEL_API_KEY, key.trim());
}

export async function leseApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(SCHLUESSEL_API_KEY);
}

export async function loescheApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(SCHLUESSEL_API_KEY);
}

/** Rohergebnis der Extraktion. Beträge kommen als Text, damit nichts still gerundet wird. */
export interface Extraktion {
  glaeubigerName: string | null;
  glaeubigerVertrittFuer: string | null;
  glaeubigerIstInkasso: boolean;
  glaeubigerAdresse: string | null;
  forderungstyp: Forderungstyp;
  dokumenttyp: Dokumenttyp;
  aktenzeichen: string | null;
  briefdatum: string | null;
  entstandenAm: string | null;
  faelligAm: string | null;
  fristBis: string | null;
  istTituliert: boolean;
  hauptforderung: string | null;
  zinsen: string | null;
  mahnkosten: string | null;
  inkassokosten: string | null;
  gerichtskosten: string | null;
  saeumniszuschlaege: string | null;
  sonstigeKosten: string | null;
  gefordertGesamt: string | null;
  /** Kurze Zusammenfassung in einem Satz, für die Übersichtsliste. */
  kurzfassung: string;
  /** Felder, bei denen die Auswertung sich nicht sicher ist — werden markiert. */
  unsichereFelder: string[];
  /** Auffälligkeiten im Brief: Drohungen mit Fristen, widersprüchliche Summen, ungewöhnliche Posten. */
  auffaelligkeiten: string[];
}

const EXTRAKTIONS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    glaeubigerName: { type: ['string', 'null'], description: 'Name des Absenders, der Geld fordert.' },
    glaeubigerVertrittFuer: {
      type: ['string', 'null'],
      description: 'Falls ein Inkassobüro schreibt: für wen es die Forderung eintreibt.',
    },
    glaeubigerIstInkasso: { type: 'boolean' },
    glaeubigerAdresse: { type: ['string', 'null'] },
    forderungstyp: {
      type: 'string',
      enum: [
        'krankenkasse', 'sozialversicherung', 'finanzamt', 'behoerde', 'rundfunkbeitrag',
        'miete', 'energie', 'telekommunikation', 'kredit', 'unterhalt', 'geldstrafe',
        'inkasso', 'versandhandel', 'privat', 'sonstige',
      ],
    },
    dokumenttyp: {
      type: 'string',
      enum: [
        'rechnung', 'zahlungserinnerung', 'mahnung', 'letzte_mahnung', 'inkassoschreiben',
        'mahnbescheid', 'vollstreckungsbescheid', 'urteil', 'vollstreckungsankuendigung',
        'pfaendungsankuendigung', 'kontopfaendung', 'lohnpfaendung', 'vermoegensauskunft',
        'ratenplan_angebot', 'vergleichsangebot', 'bescheid', 'kuendigungsandrohung', 'sonstiges',
      ],
    },
    aktenzeichen: { type: ['string', 'null'] },
    briefdatum: { type: ['string', 'null'], description: 'Datum des Schreibens im Format JJJJ-MM-TT.' },
    entstandenAm: {
      type: ['string', 'null'],
      description: 'Wann die Forderung entstanden ist (Rechnungs- oder Leistungsdatum), JJJJ-MM-TT.',
    },
    faelligAm: { type: ['string', 'null'], description: 'Ursprüngliches Fälligkeitsdatum, JJJJ-MM-TT.' },
    fristBis: { type: ['string', 'null'], description: 'Frist aus diesem Schreiben, JJJJ-MM-TT.' },
    istTituliert: {
      type: 'boolean',
      description: 'true nur bei Vollstreckungsbescheid, Urteil, Prozessvergleich oder notarieller Urkunde.',
    },
    hauptforderung: { type: ['string', 'null'], description: 'Betrag in Euro, z. B. "1.234,56".' },
    zinsen: { type: ['string', 'null'] },
    mahnkosten: { type: ['string', 'null'] },
    inkassokosten: { type: ['string', 'null'] },
    gerichtskosten: { type: ['string', 'null'] },
    saeumniszuschlaege: { type: ['string', 'null'] },
    sonstigeKosten: { type: ['string', 'null'] },
    gefordertGesamt: { type: ['string', 'null'], description: 'Die im Brief genannte Gesamtsumme.' },
    kurzfassung: { type: 'string' },
    unsichereFelder: { type: 'array', items: { type: 'string' } },
    auffaelligkeiten: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'glaeubigerName', 'glaeubigerVertrittFuer', 'glaeubigerIstInkasso', 'glaeubigerAdresse',
    'forderungstyp', 'dokumenttyp', 'aktenzeichen', 'briefdatum', 'entstandenAm', 'faelligAm',
    'fristBis', 'istTituliert', 'hauptforderung', 'zinsen', 'mahnkosten', 'inkassokosten',
    'gerichtskosten', 'saeumniszuschlaege', 'sonstigeKosten', 'gefordertGesamt',
    'kurzfassung', 'unsichereFelder', 'auffaelligkeiten',
  ],
} as const;

const SYSTEM_PROMPT = `Du wertest gescannte deutsche Zahlungsaufforderungen für eine private Schuldenverwaltung aus.

Der Text stammt aus einer Texterkennung und ist vor dem Versand anonymisiert worden: Name, Anschrift, Geburtsdatum und Bankverbindung des Empfängers sind durch Platzhalter wie [NAME], [STRASSE] oder [IBAN] ersetzt. Das ist beabsichtigt. Ignoriere die Platzhalter und werte den Rest aus.

Arbeitsweise:
- Trage nur ein, was im Text tatsächlich steht. Rate nichts. Für alles, was fehlt, gib null zurück.
- Trenne die Beträge sauber nach Posten. Kosten, die der Gläubiger obendrauf rechnet, gehören nicht in die Hauptforderung.
- Setze istTituliert nur, wenn ein Vollstreckungsbescheid, ein Urteil, ein Prozessvergleich oder eine notarielle Urkunde ausdrücklich erwähnt wird. Ein Mahnbescheid allein ist kein Titel, und die bloße Drohung mit gerichtlichen Schritten erst recht nicht.
- Unterscheide sorgfältig zwischen dem Datum des Schreibens, dem Entstehungsdatum der Forderung und der gesetzten Frist. Für die Verjährungsrechnung ist das Entstehungsdatum entscheidend.
- Die Texterkennung verwechselt regelmäßig Ziffern. Wenn ein Betrag oder ein Datum unplausibel aussieht, nimm den Wert trotzdem auf und nenne das Feld in unsichereFelder.
- Nenne unter auffaelligkeiten, was beim Prüfen auffällt: Gesamtsumme passt nicht zur Summe der Einzelposten, ungewöhnlich hohe Nebenkosten, sehr kurze Frist, Drohung mit Maßnahmen, für die die Voraussetzungen im Brief nicht belegt sind.

Die kurzfassung ist ein einziger sachlicher Satz für eine Übersichtsliste, ohne Alarmton.`;

export class ClaudeFehler extends Error {
  constructor(
    message: string,
    readonly art: 'kein_schluessel' | 'auth' | 'limit' | 'netzwerk' | 'abgelehnt' | 'unbekannt'
  ) {
    super(message);
    this.name = 'ClaudeFehler';
  }
}

/**
 * @param anonymisierterText Ausgabe des Anonymisierers. Niemals den Rohtext übergeben.
 */
export async function extrahiere(anonymisierterText: string): Promise<Extraktion> {
  const apiKey = await leseApiKey();
  if (!apiKey) {
    throw new ClaudeFehler(
      'Kein API-Schlüssel hinterlegt. Trage ihn in den Einstellungen ein.',
      'kein_schluessel'
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const antwort = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: EXTRAKTIONS_SCHEMA as unknown as Record<string, unknown> },
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Werte dieses Schreiben aus:\n\n---\n${anonymisierterText}\n---`,
        },
      ],
    });

    if (antwort.stop_reason === 'refusal') {
      throw new ClaudeFehler(
        'Die Auswertung wurde abgelehnt. Trage die Daten dieses Briefs von Hand ein.',
        'abgelehnt'
      );
    }

    const textBlock = antwort.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new ClaudeFehler('Leere Antwort erhalten.', 'unbekannt');
    }

    return JSON.parse(textBlock.text) as Extraktion;
  } catch (fehler) {
    if (fehler instanceof ClaudeFehler) throw fehler;

    if (fehler instanceof Anthropic.AuthenticationError) {
      throw new ClaudeFehler('API-Schlüssel wird nicht akzeptiert. Prüfe ihn in den Einstellungen.', 'auth');
    }
    if (fehler instanceof Anthropic.RateLimitError) {
      throw new ClaudeFehler('Zu viele Anfragen. Warte einen Moment und versuche es erneut.', 'limit');
    }
    if (fehler instanceof Anthropic.APIConnectionError) {
      throw new ClaudeFehler(
        'Keine Verbindung. Der Scan und der erkannte Text sind gespeichert — du kannst die Auswertung später nachholen.',
        'netzwerk'
      );
    }
    throw new ClaudeFehler(
      fehler instanceof Error ? fehler.message : 'Unbekannter Fehler bei der Auswertung.',
      'unbekannt'
    );
  }
}
