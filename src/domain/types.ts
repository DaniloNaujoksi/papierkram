/**
 * Kern-Datentypen.
 *
 * Geldbeträge sind IMMER Integer in Cent. Niemals Float — sonst summieren sich
 * Rundungsfehler über Dutzende Forderungen zu Beträgen, über die man dann mit
 * einem Gläubiger streitet.
 */

export type Cent = number;

/** ISO-Datum ohne Zeit: "2026-08-10" */
export type IsoDate = string;

/** Woher kommt die Forderung? Bestimmt Verjährungsfrist und Priorität. */
export type Forderungstyp =
  | 'krankenkasse'
  | 'sozialversicherung'
  | 'finanzamt'
  | 'behoerde'
  | 'rundfunkbeitrag'
  | 'miete'
  | 'energie'
  | 'telekommunikation'
  | 'kredit'
  | 'unterhalt'
  | 'geldstrafe'
  | 'inkasso'
  | 'versandhandel'
  | 'privat'
  | 'sonstige';

/** Was für ein Schreiben ist das? Bestimmt, wie dringend gehandelt werden muss. */
export type Dokumenttyp =
  | 'rechnung'
  | 'zahlungserinnerung'
  | 'mahnung'
  | 'letzte_mahnung'
  | 'inkassoschreiben'
  | 'mahnbescheid'
  | 'vollstreckungsbescheid'
  | 'urteil'
  | 'vollstreckungsankuendigung'
  | 'pfaendungsankuendigung'
  | 'kontopfaendung'
  | 'lohnpfaendung'
  | 'vermoegensauskunft'
  | 'ratenplan_angebot'
  | 'vergleichsangebot'
  | 'bescheid'
  | 'kuendigungsandrohung'
  | 'sonstiges';

export type ForderungStatus =
  | 'offen'
  | 'in_verhandlung'
  | 'ratenzahlung_laeuft'
  | 'gestundet'
  | 'bestritten'
  | 'erledigt'
  | 'verjaehrt_einrede_moeglich';

/** Aufschlüsselung der Forderung. Getrennt, weil jede Position anders angreifbar ist. */
export interface Betraege {
  hauptforderung: Cent;
  zinsen: Cent;
  mahnkosten: Cent;
  inkassokosten: Cent;
  gerichtskosten: Cent;
  saeumniszuschlaege: Cent;
  sonstigeKosten: Cent;
  /** Was der Gläubiger im Brief als Gesamtsumme nennt. Kann von der Summe abweichen — das ist ein Prüfsignal. */
  gefordertGesamt: Cent | null;
}

export interface Glaeubiger {
  id: number;
  name: string;
  /** Das Unternehmen/die Kasse, für die ein Inkassobüro eintreibt. */
  vertrittFuer: string | null;
  adresse: string | null;
  telefon: string | null;
  email: string | null;
  istInkasso: boolean;
  notizen: string | null;
}

export interface Forderung {
  id: number;
  glaeubigerId: number;
  titel: string;
  typ: Forderungstyp;
  status: ForderungStatus;
  betraege: Betraege;
  aktenzeichen: string | null;
  /** Wann ist die Forderung entstanden (Leistungsdatum/Rechnungsdatum)? Basis der Verjährungsrechnung. */
  entstandenAm: IsoDate | null;
  /** Fälligkeitsdatum laut Gläubiger. */
  faelligAm: IsoDate | null;
  /** Frist aus dem zuletzt erfassten Schreiben. */
  fristBis: IsoDate | null;
  /** Tituliert = 30 Jahre Verjährung und Zwangsvollstreckung ohne weiteres Verfahren möglich. */
  istTituliert: boolean;
  tituliertAm: IsoDate | null;
  /**
   * Neubeginn der Verjährung nach § 212 BGB — durch Anerkenntnis, Abschlagszahlung
   * oder Ratenzahlungsvereinbarung. Setzt die Frist komplett zurück.
   */
  verjaehrungNeubeginnAm: IsoDate | null;
  /** Hemmung nach § 204 BGB, z. B. laufender Mahnbescheid. Frist pausiert. */
  verjaehrungGehemmtSeit: IsoDate | null;
  /** Bei Sozialversicherungsbeiträgen: Vorsatz verlängert von 4 auf 30 Jahre (§ 25 SGB IV). */
  vorsatzVorgeworfen: boolean;
  notizen: string | null;
  erstelltAm: string;
  geaendertAm: string;
}

export interface Dokument {
  id: number;
  forderungId: number | null;
  /** Dateiname im App-Dokumentenordner. Das Bild verlässt das Gerät nie. */
  dateiname: string;
  typ: Dokumenttyp;
  briefdatum: IsoDate | null;
  /** OCR-Rohtext, on-device erzeugt. */
  ocrText: string | null;
  /** Was tatsächlich an die API ging — für deine Kontrolle nachvollziehbar gespeichert. */
  gesendeterText: string | null;
  /** Rohes Extraktionsergebnis als JSON, für spätere Nachbesserung. */
  extraktionJson: string | null;
  erfasstAm: string;
}

export interface Zahlung {
  id: number;
  forderungId: number;
  betrag: Cent;
  datum: IsoDate;
  notiz: string | null;
  /**
   * Achtung: Eine Zahlung auf eine strittige oder verjährte Forderung kann als
   * Anerkenntnis gewertet werden (§ 212 BGB) und startet die Verjährung neu.
   */
  alsAnerkenntnisGewertet: boolean;
}

/** Beweglicher Rechtsrahmen — Werte ändern sich jährlich, deshalb Daten und nicht Code. */
export interface Rechtsparameter {
  /** Pfändungsfreibetrag nach § 850c ZPO, angepasst jeweils zum 1. Juli. */
  pfaendungsfreibetragMonat: Cent;
  pfaendungsfreibetragGueltigAb: IsoDate;
  pfaendungsfreibetragQuelle: string;
  /** Zahl der Personen mit gesetzlichem Unterhaltsanspruch — erhöht den Freibetrag. */
  unterhaltspflichtigePersonen: number;
  /** Basiszinssatz der Bundesbank; Verzugszinsen = Basiszins + 5 Prozentpunkte (§ 288 BGB). */
  basiszinssatzProzent: number;
  basiszinssatzGueltigAb: IsoDate;
}

export interface Haushalt {
  nettoeinkommenMonat: Cent;
  /** Fixkosten, die vor jeder Tilgung bedient werden. Miete, Strom, Versicherung, Fahrtkosten. */
  fixkostenMonat: Cent;
  lebenshaltungMonat: Cent;
}
