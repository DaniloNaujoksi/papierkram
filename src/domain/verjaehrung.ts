/**
 * Verjährungsrechner.
 *
 * Verjährung ist der stärkste Hebel, den ein Schuldner hat: eine verjährte Forderung
 * muss nicht bezahlt werden — aber nur, wenn man die Einrede aktiv erhebt. Ein Gericht
 * prüft das nicht von selbst. Deshalb rechnet die App jede Forderung durch und meldet
 * sich, bevor der Gläubiger die Frist durch einen Mahnbescheid rettet.
 *
 * Das Ergebnis ist eine begründete Einschätzung mit Rechtsgrundlage, kein Rechtsrat.
 * Vor dem Erheben einer Einrede gehört jeder Fall vor eine anerkannte Schuldnerberatung
 * oder einen Anwalt — ein Fehlgriff kostet Gerichtskosten.
 */

import type { Forderung, Forderungstyp, IsoDate } from './types';

export type VerjaehrungsAmpel = 'verjaehrt' | 'laeuft_bald_ab' | 'offen' | 'unbekannt';

export interface Verjaehrungsregel {
  jahre: number;
  /** true: Frist startet erst am 31.12. des Entstehungsjahres (§ 199 BGB, § 25 SGB IV, § 229 AO). */
  beginnZumJahresende: boolean;
  paragraph: string;
  erlaeuterung: string;
}

export interface Verjaehrungsergebnis {
  ampel: VerjaehrungsAmpel;
  regel: Verjaehrungsregel;
  /** Tag, an dem die Verjährung eintritt (bzw. eingetreten ist). */
  verjaehrtAm: IsoDate | null;
  tageBisVerjaehrung: number | null;
  /** Klartext für die Übersicht. */
  begruendung: string;
  /** Was jetzt zu tun ist. */
  hinweis: string | null;
}

/**
 * Regelwerk nach Forderungstyp. Nicht jede Schuld verjährt in drei Jahren —
 * gerade die Krankenkasse und das Finanzamt haben eigene, längere Fristen.
 */
export function regelFuer(typ: Forderungstyp, vorsatzVorgeworfen: boolean): Verjaehrungsregel {
  switch (typ) {
    case 'krankenkasse':
    case 'sozialversicherung':
      return vorsatzVorgeworfen
        ? {
            jahre: 30,
            beginnZumJahresende: true,
            paragraph: '§ 25 Abs. 1 Satz 2 SGB IV',
            erlaeuterung:
              'Vorsätzlich vorenthaltene Sozialversicherungsbeiträge verjähren erst nach 30 Jahren. Prüfe, ob dir wirklich Vorsatz vorgeworfen wird — oft steht das nirgends und die reguläre Vier-Jahres-Frist gilt.',
          }
        : {
            jahre: 4,
            beginnZumJahresende: true,
            paragraph: '§ 25 Abs. 1 Satz 1 SGB IV',
            erlaeuterung:
              'Beitragsansprüche verjähren vier Jahre nach Ablauf des Kalenderjahres, in dem sie fällig wurden — nicht drei wie im BGB.',
          };

    case 'finanzamt':
      return {
        jahre: 5,
        beginnZumJahresende: true,
        paragraph: '§ 228 AO',
        erlaeuterung:
          'Die Zahlungsverjährung bei Steuern beträgt fünf Jahre ab Ablauf des Fälligkeitsjahres. Bei Steuerhinterziehung zehn Jahre. Jede Vollstreckungsmaßnahme unterbricht die Frist neu (§ 231 AO).',
      };

    case 'geldstrafe':
      return {
        jahre: 5,
        beginnZumJahresende: false,
        paragraph: '§ 79 Abs. 3 Nr. 4 StGB',
        erlaeuterung:
          'Geldstrafen bis 30 Tagessätze verjähren in drei, darüber in fünf Jahren. Achtung: Solange nicht gezahlt wird, droht die Ersatzfreiheitsstrafe. Das ist die einzige Schuldenart, die dich ins Gefängnis bringt — sie hat immer oberste Priorität.',
      };

    case 'rundfunkbeitrag':
      return {
        jahre: 3,
        beginnZumJahresende: true,
        paragraph: '§ 7 Abs. 4 RBStV in Verbindung mit § 195 BGB',
        erlaeuterung:
          'Rundfunkbeiträge verjähren in drei Jahren. Sobald ein Festsetzungsbescheid ergangen ist, gilt jedoch die deutlich längere Verjährung für Verwaltungsakte und der Beitragsservice kann ohne Gericht vollstrecken.',
      };

    default:
      return {
        jahre: 3,
        beginnZumJahresende: true,
        paragraph: '§§ 195, 199 BGB',
        erlaeuterung:
          'Regelverjährung: drei Jahre, beginnend mit dem Schluss des Jahres, in dem die Forderung entstanden ist und der Gläubiger davon wusste.',
      };
  }
}

const TAG_MS = 24 * 60 * 60 * 1000;

function parseDate(iso: IsoDate | null): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

function addJahre(d: Date, jahre: number): Date {
  const r = new Date(d.getTime());
  r.setUTCFullYear(r.getUTCFullYear() + jahre);
  return r;
}

/**
 * Rechnet die Verjährung einer Forderung durch.
 *
 * @param heute Referenzdatum. Wird explizit übergeben, damit die Funktion testbar bleibt.
 */
export function berechneVerjaehrung(forderung: Forderung, heute: Date): Verjaehrungsergebnis {
  // Ein Titel schlägt alles: 30 Jahre ab Rechtskraft, und der Gläubiger darf sofort vollstrecken.
  if (forderung.istTituliert) {
    const regel: Verjaehrungsregel = {
      jahre: 30,
      beginnZumJahresende: false,
      paragraph: '§ 197 Abs. 1 Nr. 3 BGB',
      erlaeuterung:
        'Titulierte Forderungen — Vollstreckungsbescheid, Urteil, notarielle Urkunde — verjähren erst nach 30 Jahren. Auf Verjährung zu warten ist hier keine Strategie. Der Weg führt über Ratenzahlung, Vergleich oder Insolvenz.',
    };
    const start = parseDate(forderung.tituliertAm);
    if (!start) {
      return {
        ampel: 'offen',
        regel,
        verjaehrtAm: null,
        tageBisVerjaehrung: null,
        begruendung:
          'Forderung ist tituliert, das Datum der Titulierung fehlt. Ohne dieses Datum lässt sich die 30-Jahres-Frist nicht berechnen.',
        hinweis:
          'Trage das Datum aus dem Vollstreckungsbescheid oder Urteil nach. Bis dahin: Diese Forderung ist zwangsvollstreckbar und braucht als Erstes eine Lösung.',
      };
    }
    const ende = addJahre(start, 30);
    const tage = Math.ceil((ende.getTime() - heute.getTime()) / TAG_MS);
    return {
      ampel: tage <= 0 ? 'verjaehrt' : 'offen',
      regel,
      verjaehrtAm: toIso(ende),
      tageBisVerjaehrung: tage,
      begruendung: `Tituliert am ${forderung.tituliertAm}. Verjährung erst am ${toIso(ende)}.`,
      hinweis:
        'Tituliert heißt: Der Gläubiger kann jederzeit ohne weiteres Gerichtsverfahren pfänden. Richte ein P-Konto ein, bevor eine Kontopfändung kommt — danach dauert die Freigabe Wochen, in denen du an dein Geld nicht herankommst.',
    };
  }

  const regel = regelFuer(forderung.typ, forderung.vorsatzVorgeworfen);

  // Ein Anerkenntnis oder eine Ratenzahlung setzt die Frist komplett auf null (§ 212 BGB).
  // Das ist die häufigste Falle: Wer 20 Euro auf eine fast verjährte Forderung zahlt,
  // schenkt dem Gläubiger die volle Frist noch einmal.
  const neubeginn = parseDate(forderung.verjaehrungNeubeginnAm);
  const entstanden = parseDate(forderung.entstandenAm) ?? parseDate(forderung.faelligAm);

  const basis = neubeginn ?? entstanden;
  if (!basis) {
    return {
      ampel: 'unbekannt',
      regel,
      verjaehrtAm: null,
      tageBisVerjaehrung: null,
      begruendung:
        'Kein Entstehungs- oder Fälligkeitsdatum erfasst. Ohne dieses Datum ist keine Verjährungsaussage möglich.',
      hinweis:
        'Suche im ältesten Schreiben zu dieser Forderung nach dem Rechnungs- oder Leistungsdatum und trage es nach. Findest du nichts, kannst du beim Gläubiger eine Forderungsaufstellung verlangen — er muss belegen, woraus sich die Forderung ergibt.',
    };
  }

  const startjahr = basis.getUTCFullYear();
  const start = regel.beginnZumJahresende
    ? new Date(Date.UTC(startjahr, 11, 31))
    : basis;
  const ende = addJahre(start, regel.jahre);

  // Hemmung: Die Frist pausiert, solange z. B. ein Mahnverfahren läuft (§ 204 BGB).
  // Wir verschieben das Ende um die bisher verstrichene Hemmungsdauer plus die
  // sechs Monate Nachlauf aus § 204 Abs. 2 BGB.
  const gehemmtSeit = parseDate(forderung.verjaehrungGehemmtSeit);
  let endeEffektiv = ende;
  let hemmungsHinweis: string | null = null;
  if (gehemmtSeit) {
    const gehemmteTage = Math.max(0, Math.ceil((heute.getTime() - gehemmtSeit.getTime()) / TAG_MS));
    endeEffektiv = new Date(ende.getTime() + (gehemmteTage + 183) * TAG_MS);
    hemmungsHinweis = `Die Verjährung ist seit ${forderung.verjaehrungGehemmtSeit} gehemmt (§ 204 BGB), die Frist läuft solange nicht weiter.`;
  }

  const tage = Math.ceil((endeEffektiv.getTime() - heute.getTime()) / TAG_MS);
  const ampel: VerjaehrungsAmpel = tage <= 0 ? 'verjaehrt' : tage <= 180 ? 'laeuft_bald_ab' : 'offen';

  const basisText = neubeginn
    ? `Die Verjährung hat am ${forderung.verjaehrungNeubeginnAm} neu begonnen (§ 212 BGB, Anerkenntnis oder Zahlung).`
    : `Forderung entstanden am ${toIso(basis)}.`;

  let hinweis: string | null = null;
  if (ampel === 'verjaehrt') {
    hinweis =
      'Die Frist ist abgelaufen. Wichtig: Die Forderung erlischt dadurch nicht, du musst die Verjährungseinrede ausdrücklich schriftlich erheben. Zahle bis dahin nichts und unterschreibe nichts — jede Teilzahlung und jedes Anerkenntnis lässt die Frist von vorn beginnen.';
  } else if (ampel === 'laeuft_bald_ab') {
    hinweis = `Nur noch ${tage} Tage. Gläubiger sichern kurz vor Fristende gern mit einem Mahnbescheid ab, der die Verjährung hemmt. Zahle in dieser Phase nichts freiwillig und schreibe nichts, was als Anerkenntnis gelesen werden kann.`;
  } else if (hemmungsHinweis) {
    hinweis = hemmungsHinweis;
  }

  return {
    ampel,
    regel,
    verjaehrtAm: toIso(endeEffektiv),
    tageBisVerjaehrung: tage,
    begruendung: `${basisText} ${regel.jahre} Jahre nach ${regel.beginnZumJahresende ? `Ablauf des Jahres ${startjahr}` : 'diesem Datum'} — Verjährung am ${toIso(endeEffektiv)} (${regel.paragraph}).`,
    hinweis,
  };
}
