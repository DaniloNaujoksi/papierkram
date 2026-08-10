import type { SQLiteDatabase } from 'expo-sqlite';

export const DATENBANK_NAME = 'papierkram.db';
const SCHEMA_VERSION = 3;

/**
 * Migrationen laufen beim Start. Jede Version ist ein eigener Block, damit eine
 * bestehende Datenbank auf dem Gerät weiterlebt und nicht neu angelegt werden muss —
 * es hängen echte Belege daran.
 */
export async function migriere(db: SQLiteDatabase): Promise<void> {
  const zeile = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = zeile?.user_version ?? 0;

  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      PRAGMA foreign_keys = ON;

      CREATE TABLE glaeubiger (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        name           TEXT    NOT NULL,
        vertritt_fuer  TEXT,
        adresse        TEXT,
        telefon        TEXT,
        email          TEXT,
        ist_inkasso    INTEGER NOT NULL DEFAULT 0,
        notizen        TEXT
      );

      CREATE TABLE forderung (
        id                        INTEGER PRIMARY KEY AUTOINCREMENT,
        glaeubiger_id             INTEGER NOT NULL REFERENCES glaeubiger(id) ON DELETE CASCADE,
        titel                     TEXT    NOT NULL,
        typ                       TEXT    NOT NULL,
        status                    TEXT    NOT NULL DEFAULT 'offen',
        hauptforderung            INTEGER NOT NULL DEFAULT 0,
        zinsen                    INTEGER NOT NULL DEFAULT 0,
        mahnkosten                INTEGER NOT NULL DEFAULT 0,
        inkassokosten             INTEGER NOT NULL DEFAULT 0,
        gerichtskosten            INTEGER NOT NULL DEFAULT 0,
        saeumniszuschlaege        INTEGER NOT NULL DEFAULT 0,
        sonstige_kosten           INTEGER NOT NULL DEFAULT 0,
        gefordert_gesamt          INTEGER,
        aktenzeichen              TEXT,
        entstanden_am             TEXT,
        faellig_am                TEXT,
        frist_bis                 TEXT,
        ist_tituliert             INTEGER NOT NULL DEFAULT 0,
        tituliert_am              TEXT,
        verjaehrung_neubeginn_am  TEXT,
        verjaehrung_gehemmt_seit  TEXT,
        vorsatz_vorgeworfen       INTEGER NOT NULL DEFAULT 0,
        notizen                   TEXT,
        erstellt_am               TEXT    NOT NULL,
        geaendert_am              TEXT    NOT NULL
      );

      CREATE INDEX idx_forderung_glaeubiger ON forderung(glaeubiger_id);
      CREATE INDEX idx_forderung_status     ON forderung(status);

      CREATE TABLE dokument (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        forderung_id     INTEGER REFERENCES forderung(id) ON DELETE SET NULL,
        dateiname        TEXT    NOT NULL,
        typ              TEXT    NOT NULL DEFAULT 'sonstiges',
        briefdatum       TEXT,
        ocr_text         TEXT,
        gesendeter_text  TEXT,
        extraktion_json  TEXT,
        erfasst_am       TEXT    NOT NULL
      );

      CREATE INDEX idx_dokument_forderung ON dokument(forderung_id);

      CREATE TABLE zahlung (
        id                          INTEGER PRIMARY KEY AUTOINCREMENT,
        forderung_id                INTEGER NOT NULL REFERENCES forderung(id) ON DELETE CASCADE,
        betrag                      INTEGER NOT NULL,
        datum                       TEXT    NOT NULL,
        notiz                       TEXT,
        als_anerkenntnis_gewertet   INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX idx_zahlung_forderung ON zahlung(forderung_id);

      -- Schlüssel-Wert-Ablage für Haushaltszahlen und Rechtsparameter.
      -- Bewusst als Daten und nicht als Konstanten im Code: Pfändungsfreibetrag und
      -- Basiszinssatz ändern sich jedes Jahr.
      CREATE TABLE einstellung (
        schluessel TEXT PRIMARY KEY,
        wert       TEXT NOT NULL
      );
    `);
    version = 1;
  }

  if (version === 1) {
    // Tiefenanalysen werden aufbewahrt, nicht nur angezeigt: Man liest sie
    // mehrfach, nimmt sie zum Beratungstermin mit, und beim nächsten Lauf ist
    // der Vergleich mit der vorigen Einschätzung selbst eine Information.
    await db.execAsync(`
      CREATE TABLE analyse (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        erstellt_am     TEXT    NOT NULL,
        text            TEXT    NOT NULL,
        gesendeter_text TEXT    NOT NULL,
        anzahl_belege   INTEGER NOT NULL DEFAULT 0,
        summe_offen     INTEGER NOT NULL DEFAULT 0
      );
    `);
    version = 2;
  }

  if (version === 2) {
    // Ausgehende Schreiben werden mitgefuehrt, nicht nur erzeugt. In jedem spaeteren
    // Streit ist die Frage, wann was an wen ging — und ohne diese Spur steht Aussage
    // gegen Aussage.
    await db.execAsync(`
      CREATE TABLE schreiben (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        forderung_id  INTEGER NOT NULL REFERENCES forderung(id) ON DELETE CASCADE,
        absicht       TEXT    NOT NULL,
        text          TEXT    NOT NULL,
        erstellt_am   TEXT    NOT NULL,
        versendet_am  TEXT,
        versandart    TEXT
      );

      CREATE INDEX idx_schreiben_forderung ON schreiben(forderung_id);
    `);
    version = 3;
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
