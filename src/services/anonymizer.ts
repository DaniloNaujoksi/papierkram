/**
 * Anonymisierung vor dem API-Aufruf.
 *
 * Das gescannte Bild verlässt das Gerät nie. Was hinausgeht, ist ausschließlich der
 * on-device erzeugte OCR-Text — und aus dem werden vorher alle Angaben entfernt, die
 * dich als Person identifizieren: Name, Anschrift, Geburtsdatum, Bankverbindung,
 * Versicherten-, Steuer- und Rentenversicherungsnummer.
 *
 * Was bewusst DRINBLEIBT, weil die Auswertung sonst wertlos wäre:
 *   - Name und Anschrift des Gläubigers (das ist eine Firma, keine schützenswerte Person)
 *   - alle Beträge, Daten und Fristen
 *   - das Aktenzeichen (ohne die Datenbank des Gläubigers bedeutungslos)
 *
 * Vor jedem Versand kannst du dir in der App genau ansehen, welcher Text hinausgeht.
 */

export interface PersoenlicheDaten {
  vorname: string;
  nachname: string;
  /** Weitere Schreibweisen, die in Briefen auftauchen: Geburtsname, Tippfehler der Gläubiger. */
  weitereNamen: string[];
  strasse: string;
  plz: string;
  ort: string;
  geburtsdatum: string;
  /** Frei erfassbare Kennnummern: Versichertennummer, Steuer-ID, Rentenversicherungsnummer, Kundennummern. */
  kennnummern: string[];
}

export const LEERE_PERSOENLICHE_DATEN: PersoenlicheDaten = {
  vorname: '',
  nachname: '',
  weitereNamen: [],
  strasse: '',
  plz: '',
  ort: '',
  geburtsdatum: '',
  kennnummern: [],
};

export interface AnonymisierungsErgebnis {
  text: string;
  /** Welche Kategorien tatsächlich ersetzt wurden — für die Vorschau vor dem Versand. */
  ersetzungen: Array<{ kategorie: string; anzahl: number }>;
  /**
   * Warnungen, wenn etwas nicht sauber entfernt werden konnte. Erscheint in der Vorschau,
   * damit du im Zweifel abbrichst statt blind zu senden.
   */
  warnungen: string[];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Ersetzt alle Vorkommen und zählt sie. Wortgrenzen verhindern Treffer mitten in anderen Wörtern. */
function ersetze(text: string, muster: RegExp, platzhalter: string): { text: string; anzahl: number } {
  let anzahl = 0;
  const neu = text.replace(muster, () => {
    anzahl += 1;
    return platzhalter;
  });
  return { text: neu, anzahl };
}

export function anonymisiere(rohtext: string, daten: PersoenlicheDaten): AnonymisierungsErgebnis {
  let text = rohtext;
  const ersetzungen: Array<{ kategorie: string; anzahl: number }> = [];
  const warnungen: string[] = [];

  const zaehle = (kategorie: string, anzahl: number) => {
    if (anzahl > 0) ersetzungen.push({ kategorie, anzahl });
  };

  // 1. Bankverbindungen. Zuerst, weil eine IBAN Ziffernfolgen enthält, die spätere
  //    Muster sonst zerschneiden würden.
  {
    const iban = /\b[A-Z]{2}\d{2}[\s]?(?:[A-Z0-9]{4}[\s]?){2,7}[A-Z0-9]{1,4}\b/g;
    const r = ersetze(text, iban, '[IBAN]');
    text = r.text;
    zaehle('Bankverbindung (IBAN)', r.anzahl);

    const bic = /\b[A-Z]{4}DE[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/g;
    const rb = ersetze(text, bic, '[BIC]');
    text = rb.text;
    zaehle('Bankverbindung (BIC)', rb.anzahl);
  }

  // 2. Selbst erfasste Kennnummern. Vor den Namen, weil sie eindeutig sind.
  {
    let n = 0;
    for (const nummer of daten.kennnummern.map((k) => k.trim()).filter(Boolean)) {
      const r = ersetze(text, new RegExp(escapeRegex(nummer), 'gi'), '[KENNNUMMER]');
      text = r.text;
      n += r.anzahl;
    }
    zaehle('Kennnummern', n);
  }

  // 3. Deutsche Rentenversicherungsnummer: 12 Ziffern und ein Buchstabe, z. B. 65170839J567.
  {
    const rvnr = /\b\d{2}\s?\d{6}\s?[A-Z]\s?\d{3}\b/g;
    const r = ersetze(text, rvnr, '[SOZIALVERSICHERUNGSNUMMER]');
    text = r.text;
    zaehle('Sozialversicherungsnummer', r.anzahl);
  }

  // 4. Nummern, die an einer Beschriftung hängen: Steuer-ID, Versicherten-, Mitglieds-
  //    und Kundennummer. Bewusst nur mit vorangehendem Schlüsselwort — eine reine
  //    Ziffernsuche würde auch Aktenzeichen und Rechnungsnummern treffen, die wir für
  //    die Auswertung brauchen.
  {
    const beschriftet =
      /((?:Steuer-?(?:identifikations)?nummer|Steuer-?ID|IdNr\.?|Identifikationsnummer|Versicherten-?nummer|Versicherungsnummer|KV-?Nummer|Mitglieds-?nummer|Kunden-?nummer|Vertrags-?nummer|Personal-?nummer)\s*:?\s*)([A-Z]?[\d\s./-]{6,20}\d)/gi;
    let n = 0;
    text = text.replace(beschriftet, (_treffer, beschriftung: string) => {
      n += 1;
      return `${beschriftung}[KENNNUMMER]`;
    });
    zaehle('Beschriftete Kennnummern', n);
  }

  // 5. Geburtsdatum in allen üblichen Schreibweisen. Nur das eigene — andere Daten
  //    müssen erhalten bleiben, sonst gehen Briefdatum und Fristen verloren.
  if (daten.geburtsdatum.trim()) {
    const varianten = geburtsdatumVarianten(daten.geburtsdatum.trim());
    let n = 0;
    for (const v of varianten) {
      const r = ersetze(text, new RegExp(escapeRegex(v), 'gi'), '[GEBURTSDATUM]');
      text = r.text;
      n += r.anzahl;
    }
    zaehle('Geburtsdatum', n);
  }

  // 6. Anschrift. Straße mit Hausnummer, dann PLZ mit Ort.
  {
    let n = 0;
    if (daten.strasse.trim()) {
      // Das Eingabefeld heißt "Straße und Hausnummer", enthält also meist beides.
      // Für die Suche zählt nur das Grundwort: aus "Musterstraße 12" wird "Muster",
      // damit im Brief auch "Musterstr. 12", "Musterstrasse 12" oder eine andere
      // Hausnummer erkannt wird. Endung und Nummer sind im Muster optional — lieber
      // einmal zu viel entfernen als die Anschrift durchrutschen lassen.
      const ohneHausnummer = daten.strasse.trim().replace(/\s*\d+\s*[a-zA-Z]?\s*$/, '').trim();
      const stamm = ohneHausnummer.replace(/\s*(stra(ß|ss)e|str\.?)\s*$/i, '').trim();

      if (stamm.length >= 3) {
        const muster = new RegExp(
          `\\b${escapeRegex(stamm)}(?:\\s*(?:stra(?:ß|ss)e|str\\.?))?(?:\\s*\\d+\\s*[a-zA-Z]?)?`,
          'gi'
        );
        const r = ersetze(text, muster, '[STRASSE]');
        text = r.text;
        n += r.anzahl;
      } else {
        warnungen.push(
          'Der Straßenname ist zu kurz, um ihn zuverlässig zu erkennen. Prüfe den Text unten von Hand auf deine Anschrift.'
        );
      }
    }
    if (daten.plz.trim() && daten.ort.trim()) {
      const muster = new RegExp(`${escapeRegex(daten.plz.trim())}\\s+${escapeRegex(daten.ort.trim())}`, 'gi');
      const r = ersetze(text, muster, '[PLZ ORT]');
      text = r.text;
      n += r.anzahl;
    }
    // Die PLZ allein ebenfalls, sie ist für sich schon ein Ortsmerkmal.
    if (daten.plz.trim()) {
      const r = ersetze(text, new RegExp(`\\b${escapeRegex(daten.plz.trim())}\\b`, 'g'), '[PLZ]');
      text = r.text;
      n += r.anzahl;
    }
    zaehle('Anschrift', n);
  }

  // 7. Namen zum Schluss: Vollname vor Einzelteilen, sonst bleiben Bruchstücke stehen.
  {
    const namen = [
      `${daten.vorname} ${daten.nachname}`,
      `${daten.nachname}, ${daten.vorname}`,
      ...daten.weitereNamen,
      daten.nachname,
      daten.vorname,
    ]
      .map((s) => s.trim())
      .filter((s) => s.length >= 3);

    let n = 0;
    for (const name of namen) {
      const r = ersetze(text, new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi'), '[NAME]');
      text = r.text;
      n += r.anzahl;
    }
    zaehle('Name', n);

    if (daten.nachname.trim().length > 0 && daten.nachname.trim().length < 3) {
      warnungen.push(
        'Dein Nachname ist sehr kurz und wird deshalb nicht automatisch ersetzt — zu hohes Risiko, dass dabei normale Wörter zerstört werden. Prüfe den Text unten von Hand.'
      );
    }
  }

  // Abschlusskontrolle: Wenn zentrale Angaben nicht hinterlegt sind, kann auch nichts
  // entfernt werden. Das muss sichtbar sein, bevor gesendet wird.
  if (!daten.nachname.trim()) {
    warnungen.push('Kein Nachname hinterlegt — dein Name wird nicht entfernt. Trage ihn in den Einstellungen ein.');
  }
  if (!daten.plz.trim() && !daten.strasse.trim()) {
    warnungen.push('Keine Anschrift hinterlegt — deine Adresse wird nicht entfernt.');
  }

  return { text, ersetzungen, warnungen };
}

/** "1985-03-07" oder "07.03.1985" in alle Schreibweisen, die in Briefen vorkommen. */
function geburtsdatumVarianten(eingabe: string): string[] {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eingabe);
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(eingabe);

  let jahr: string, monat: string, tag: string;
  if (iso) {
    [, jahr, monat, tag] = iso;
  } else if (de) {
    [, tag, monat, jahr] = de;
    tag = tag.padStart(2, '0');
    monat = monat.padStart(2, '0');
  } else {
    return [eingabe];
  }

  const tagOhneNull = String(Number(tag));
  const monatOhneNull = String(Number(monat));

  return [
    `${tag}.${monat}.${jahr}`,
    `${tagOhneNull}.${monatOhneNull}.${jahr}`,
    `${jahr}-${monat}-${tag}`,
    `${tag}/${monat}/${jahr}`,
    `${tag}.${monat}.${jahr.slice(2)}`,
  ];
}
