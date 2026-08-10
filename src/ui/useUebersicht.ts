import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  alleForderungen,
  alleGlaeubiger,
  letzterDokumenttypJeForderung,
  zahlungssummeJeForderung,
} from '../db/repo';
import { berechneVerjaehrung, type Verjaehrungsergebnis } from '../domain/verjaehrung';
import { berechnePrioritaet, type Prioritaet } from '../domain/prioritaet';
import { summe } from '../domain/betraege';
import type { Cent, Dokumenttyp, Forderung, Glaeubiger } from '../domain/types';

export interface Eintrag {
  forderung: Forderung;
  glaeubiger: Glaeubiger | undefined;
  verjaehrung: Verjaehrungsergebnis;
  prioritaet: Prioritaet;
  letzterDokumenttyp: Dokumenttyp | null;
  tageBisFrist: number | null;
  offen: Cent;
}

export interface Uebersicht {
  eintraege: Eintrag[];
  gesamtOffen: Cent;
  /** Summe aller Posten, die über die eigentliche Schuld hinaus verlangt werden. */
  gesamtNebenkosten: Cent;
  laedt: boolean;
  neuLaden: () => void;
}

const TAG_MS = 24 * 60 * 60 * 1000;

function tageBis(iso: string | null, heute: Date): number | null {
  if (!iso) return null;
  const ziel = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(ziel.getTime())) return null;
  return Math.ceil((ziel.getTime() - heute.getTime()) / TAG_MS);
}

export function useUebersicht(): Uebersicht {
  const [eintraege, setEintraege] = useState<Eintrag[]>([]);
  const [laedt, setLaedt] = useState(true);

  const laden = useCallback(async () => {
    const [forderungen, glaeubiger, dokumenttypen, zahlungen] = await Promise.all([
      alleForderungen(),
      alleGlaeubiger(),
      letzterDokumenttypJeForderung(),
      zahlungssummeJeForderung(),
    ]);

    const glaeubigerNachId = new Map(glaeubiger.map((g) => [g.id, g]));
    const heute = new Date();

    const berechnet: Eintrag[] = forderungen.map((forderung) => {
      const verjaehrung = berechneVerjaehrung(forderung, heute);
      const letzterDokumenttyp = dokumenttypen.get(forderung.id) ?? null;
      const tage = tageBis(forderung.fristBis, heute);

      return {
        forderung,
        glaeubiger: glaeubigerNachId.get(forderung.glaeubigerId),
        verjaehrung,
        prioritaet: berechnePrioritaet({
          forderung,
          verjaehrung,
          letzterDokumenttyp,
          tageBisFrist: tage,
        }),
        letzterDokumenttyp,
        tageBisFrist: tage,
        offen: Math.max(0, summe(forderung.betraege) - (zahlungen.get(forderung.id) ?? 0)),
      };
    });

    berechnet.sort((a, b) => b.prioritaet.rangwert - a.prioritaet.rangwert);
    setEintraege(berechnet);
    setLaedt(false);
  }, []);

  // Neu laden, sobald der Screen wieder sichtbar wird — nach dem Erfassen eines
  // Briefs muss die Übersicht sofort stimmen.
  useFocusEffect(
    useCallback(() => {
      void laden();
    }, [laden])
  );

  // Vermutlich verjährte Forderungen zählen nicht zur Schuldensumme: sie sind der
  // Grund, warum die Zahl niedriger sein kann als befürchtet.
  const gesamtOffen = eintraege
    .filter((e) => e.verjaehrung.ampel !== 'verjaehrt' || e.forderung.istTituliert)
    .reduce((s, e) => s + e.offen, 0);

  const gesamtNebenkosten = eintraege.reduce(
    (s, e) => s + (summe(e.forderung.betraege) - e.forderung.betraege.hauptforderung),
    0
  );

  return { eintraege, gesamtOffen, gesamtNebenkosten, laedt, neuLaden: () => void laden() };
}
