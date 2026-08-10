import * as SQLite from 'expo-sqlite';
import { DATENBANK_NAME, migriere } from './schema';
import type {
  Betraege,
  Dokument,
  Dokumenttyp,
  Forderung,
  ForderungStatus,
  Forderungstyp,
  Glaeubiger,
  Zahlung,
} from '../domain/types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function holeDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATENBANK_NAME).then(async (db) => {
      await migriere(db);
      return db;
    });
  }
  return dbPromise;
}

// --- Zeilen-Typen, wie SQLite sie liefert (snake_case, Booleans als 0/1) ---

interface ForderungZeile {
  id: number;
  glaeubiger_id: number;
  titel: string;
  typ: string;
  status: string;
  hauptforderung: number;
  zinsen: number;
  mahnkosten: number;
  inkassokosten: number;
  gerichtskosten: number;
  saeumniszuschlaege: number;
  sonstige_kosten: number;
  gefordert_gesamt: number | null;
  aktenzeichen: string | null;
  entstanden_am: string | null;
  faellig_am: string | null;
  frist_bis: string | null;
  ist_tituliert: number;
  tituliert_am: string | null;
  verjaehrung_neubeginn_am: string | null;
  verjaehrung_gehemmt_seit: string | null;
  vorsatz_vorgeworfen: number;
  notizen: string | null;
  erstellt_am: string;
  geaendert_am: string;
}

function zuForderung(z: ForderungZeile): Forderung {
  const betraege: Betraege = {
    hauptforderung: z.hauptforderung,
    zinsen: z.zinsen,
    mahnkosten: z.mahnkosten,
    inkassokosten: z.inkassokosten,
    gerichtskosten: z.gerichtskosten,
    saeumniszuschlaege: z.saeumniszuschlaege,
    sonstigeKosten: z.sonstige_kosten,
    gefordertGesamt: z.gefordert_gesamt,
  };
  return {
    id: z.id,
    glaeubigerId: z.glaeubiger_id,
    titel: z.titel,
    typ: z.typ as Forderungstyp,
    status: z.status as ForderungStatus,
    betraege,
    aktenzeichen: z.aktenzeichen,
    entstandenAm: z.entstanden_am,
    faelligAm: z.faellig_am,
    fristBis: z.frist_bis,
    istTituliert: z.ist_tituliert === 1,
    tituliertAm: z.tituliert_am,
    verjaehrungNeubeginnAm: z.verjaehrung_neubeginn_am,
    verjaehrungGehemmtSeit: z.verjaehrung_gehemmt_seit,
    vorsatzVorgeworfen: z.vorsatz_vorgeworfen === 1,
    notizen: z.notizen,
    erstelltAm: z.erstellt_am,
    geaendertAm: z.geaendert_am,
  };
}

// --- Gläubiger ---

export async function alleGlaeubiger(): Promise<Glaeubiger[]> {
  const db = await holeDb();
  const zeilen = await db.getAllAsync<{
    id: number;
    name: string;
    vertritt_fuer: string | null;
    adresse: string | null;
    telefon: string | null;
    email: string | null;
    ist_inkasso: number;
    notizen: string | null;
  }>('SELECT * FROM glaeubiger ORDER BY name COLLATE NOCASE');

  return zeilen.map((z) => ({
    id: z.id,
    name: z.name,
    vertrittFuer: z.vertritt_fuer,
    adresse: z.adresse,
    telefon: z.telefon,
    email: z.email,
    istInkasso: z.ist_inkasso === 1,
    notizen: z.notizen,
  }));
}

/**
 * Legt einen Gläubiger an oder gibt den bestehenden zurück. Gleicht über den Namen ab,
 * damit nicht bei jedem Brief derselbe Gläubiger doppelt in der Liste landet.
 */
export async function findeOderLegeGlaeubigerAn(
  name: string,
  daten: Partial<Omit<Glaeubiger, 'id' | 'name'>> = {}
): Promise<number> {
  const db = await holeDb();
  const vorhanden = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM glaeubiger WHERE name = ? COLLATE NOCASE',
    name.trim()
  );
  if (vorhanden) return vorhanden.id;

  const ergebnis = await db.runAsync(
    `INSERT INTO glaeubiger (name, vertritt_fuer, adresse, telefon, email, ist_inkasso, notizen)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    name.trim(),
    daten.vertrittFuer ?? null,
    daten.adresse ?? null,
    daten.telefon ?? null,
    daten.email ?? null,
    daten.istInkasso ? 1 : 0,
    daten.notizen ?? null
  );
  return ergebnis.lastInsertRowId;
}

// --- Forderungen ---

export async function alleForderungen(): Promise<Forderung[]> {
  const db = await holeDb();
  const zeilen = await db.getAllAsync<ForderungZeile>(
    "SELECT * FROM forderung WHERE status != 'erledigt' ORDER BY geaendert_am DESC"
  );
  return zeilen.map(zuForderung);
}

export async function forderung(id: number): Promise<Forderung | null> {
  const db = await holeDb();
  const zeile = await db.getFirstAsync<ForderungZeile>('SELECT * FROM forderung WHERE id = ?', id);
  return zeile ? zuForderung(zeile) : null;
}

export type NeueForderung = Omit<Forderung, 'id' | 'erstelltAm' | 'geaendertAm'>;

export async function speichereForderung(f: NeueForderung, id?: number): Promise<number> {
  const db = await holeDb();
  const jetzt = new Date().toISOString();
  const b = f.betraege;

  if (id !== undefined) {
    await db.runAsync(
      `UPDATE forderung SET
         glaeubiger_id = ?, titel = ?, typ = ?, status = ?,
         hauptforderung = ?, zinsen = ?, mahnkosten = ?, inkassokosten = ?,
         gerichtskosten = ?, saeumniszuschlaege = ?, sonstige_kosten = ?, gefordert_gesamt = ?,
         aktenzeichen = ?, entstanden_am = ?, faellig_am = ?, frist_bis = ?,
         ist_tituliert = ?, tituliert_am = ?, verjaehrung_neubeginn_am = ?,
         verjaehrung_gehemmt_seit = ?, vorsatz_vorgeworfen = ?, notizen = ?, geaendert_am = ?
       WHERE id = ?`,
      f.glaeubigerId, f.titel, f.typ, f.status,
      b.hauptforderung, b.zinsen, b.mahnkosten, b.inkassokosten,
      b.gerichtskosten, b.saeumniszuschlaege, b.sonstigeKosten, b.gefordertGesamt,
      f.aktenzeichen, f.entstandenAm, f.faelligAm, f.fristBis,
      f.istTituliert ? 1 : 0, f.tituliertAm, f.verjaehrungNeubeginnAm,
      f.verjaehrungGehemmtSeit, f.vorsatzVorgeworfen ? 1 : 0, f.notizen, jetzt,
      id
    );
    return id;
  }

  const ergebnis = await db.runAsync(
    `INSERT INTO forderung (
       glaeubiger_id, titel, typ, status,
       hauptforderung, zinsen, mahnkosten, inkassokosten,
       gerichtskosten, saeumniszuschlaege, sonstige_kosten, gefordert_gesamt,
       aktenzeichen, entstanden_am, faellig_am, frist_bis,
       ist_tituliert, tituliert_am, verjaehrung_neubeginn_am,
       verjaehrung_gehemmt_seit, vorsatz_vorgeworfen, notizen, erstellt_am, geaendert_am
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    f.glaeubigerId, f.titel, f.typ, f.status,
    b.hauptforderung, b.zinsen, b.mahnkosten, b.inkassokosten,
    b.gerichtskosten, b.saeumniszuschlaege, b.sonstigeKosten, b.gefordertGesamt,
    f.aktenzeichen, f.entstandenAm, f.faelligAm, f.fristBis,
    f.istTituliert ? 1 : 0, f.tituliertAm, f.verjaehrungNeubeginnAm,
    f.verjaehrungGehemmtSeit, f.vorsatzVorgeworfen ? 1 : 0, f.notizen, jetzt, jetzt
  );
  return ergebnis.lastInsertRowId;
}

export async function loescheForderung(id: number): Promise<void> {
  const db = await holeDb();
  await db.runAsync('DELETE FROM forderung WHERE id = ?', id);
}

// --- Dokumente ---

export type NeuesDokument = Omit<Dokument, 'id' | 'erfasstAm'>;

export async function speichereDokument(d: NeuesDokument): Promise<number> {
  const db = await holeDb();
  const ergebnis = await db.runAsync(
    `INSERT INTO dokument (forderung_id, dateiname, typ, briefdatum, ocr_text, gesendeter_text, extraktion_json, erfasst_am)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    d.forderungId, d.dateiname, d.typ, d.briefdatum,
    d.ocrText, d.gesendeterText, d.extraktionJson, new Date().toISOString()
  );
  return ergebnis.lastInsertRowId;
}

interface DokumentZeile {
  id: number;
  forderung_id: number | null;
  dateiname: string;
  typ: string;
  briefdatum: string | null;
  ocr_text: string | null;
  gesendeter_text: string | null;
  extraktion_json: string | null;
  erfasst_am: string;
}

function zuDokument(z: DokumentZeile): Dokument {
  return {
    id: z.id,
    forderungId: z.forderung_id,
    dateiname: z.dateiname,
    typ: z.typ as Dokumenttyp,
    briefdatum: z.briefdatum,
    ocrText: z.ocr_text,
    gesendeterText: z.gesendeter_text,
    extraktionJson: z.extraktion_json,
    erfasstAm: z.erfasst_am,
  };
}

export async function dokument(id: number): Promise<Dokument | null> {
  const db = await holeDb();
  const zeile = await db.getFirstAsync<DokumentZeile>('SELECT * FROM dokument WHERE id = ?', id);
  return zeile ? zuDokument(zeile) : null;
}

/** Belege ohne zugeordnete Forderung — Scans, deren Auswertung noch aussteht. */
export async function unzugeordneteDokumente(): Promise<Dokument[]> {
  const db = await holeDb();
  const zeilen = await db.getAllAsync<DokumentZeile>(
    'SELECT * FROM dokument WHERE forderung_id IS NULL ORDER BY erfasst_am DESC'
  );
  return zeilen.map(zuDokument);
}

export async function verknuepfeDokument(dokumentId: number, forderungId: number): Promise<void> {
  const db = await holeDb();
  await db.runAsync('UPDATE dokument SET forderung_id = ? WHERE id = ?', forderungId, dokumentId);
}

export async function dokumenteZuForderung(forderungId: number): Promise<Dokument[]> {
  const db = await holeDb();
  const zeilen = await db.getAllAsync<DokumentZeile>(
    'SELECT * FROM dokument WHERE forderung_id = ? ORDER BY briefdatum DESC, erfasst_am DESC',
    forderungId
  );
  return zeilen.map(zuDokument);
}

/** Jüngstes Schreiben je Forderung — bestimmt, wie dringend die Lage ist. */
export async function letzterDokumenttypJeForderung(): Promise<Map<number, Dokumenttyp>> {
  const db = await holeDb();
  const zeilen = await db.getAllAsync<{ forderung_id: number; typ: string }>(
    `SELECT forderung_id, typ FROM dokument d
     WHERE forderung_id IS NOT NULL
       AND erfasst_am = (SELECT MAX(erfasst_am) FROM dokument WHERE forderung_id = d.forderung_id)`
  );
  return new Map(zeilen.map((z) => [z.forderung_id, z.typ as Dokumenttyp]));
}

// --- Zahlungen ---

export async function speichereZahlung(z: Omit<Zahlung, 'id'>): Promise<number> {
  const db = await holeDb();
  const ergebnis = await db.runAsync(
    'INSERT INTO zahlung (forderung_id, betrag, datum, notiz, als_anerkenntnis_gewertet) VALUES (?, ?, ?, ?, ?)',
    z.forderungId, z.betrag, z.datum, z.notiz, z.alsAnerkenntnisGewertet ? 1 : 0
  );
  return ergebnis.lastInsertRowId;
}

export async function zahlungssummeJeForderung(): Promise<Map<number, number>> {
  const db = await holeDb();
  const zeilen = await db.getAllAsync<{ forderung_id: number; gezahlt: number }>(
    'SELECT forderung_id, SUM(betrag) AS gezahlt FROM zahlung GROUP BY forderung_id'
  );
  return new Map(zeilen.map((z) => [z.forderung_id, z.gezahlt]));
}

// --- Einstellungen ---

export async function leseEinstellung(schluessel: string): Promise<string | null> {
  const db = await holeDb();
  const zeile = await db.getFirstAsync<{ wert: string }>(
    'SELECT wert FROM einstellung WHERE schluessel = ?',
    schluessel
  );
  return zeile?.wert ?? null;
}

export async function schreibeEinstellung(schluessel: string, wert: string): Promise<void> {
  const db = await holeDb();
  await db.runAsync(
    'INSERT INTO einstellung (schluessel, wert) VALUES (?, ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert',
    schluessel,
    wert
  );
}
