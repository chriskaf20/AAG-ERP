export const RESULTATS_F05 = { conforme: "Conforme", non_conforme: "Non conforme", non_applicable: "Non applicable" }
export const RESULTATS_F06 = { realise: "Réalisé", non_realise: "Non réalisé" }
export const RESULTATS_PV: Record<string, string> = { ...RESULTATS_F05, ...RESULTATS_F06 }
export const GRAVITES_RESERVE = { faible: "Faible", moyenne: "Moyenne", elevee: "Élevée" }
export const DECISIONS_PV: Record<string, string> = { sans_reserve: "Sans réserve", avec_reserves: "Avec réserves", refus: "Refusé" }
