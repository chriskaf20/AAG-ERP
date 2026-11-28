export const CHAMPS_F03 = [
  { nom: "objectif", libelle: "Objectif du site" },
  { nom: "public_vise", libelle: "Public visé et résultat attendu" },
  { nom: "langues", libelle: "Langues" },
  { nom: "pages", libelle: "Pages et contenus attendus" },
  { nom: "exclusions", libelle: "Exclusions", aide: "Indiquez « Aucune » si le périmètre est complet." },
  { nom: "fonctionnalites", libelle: "Fonctionnalités", aide: "Précisez les outils attendus ou le motif si non applicable." },
  { nom: "domaine", libelle: "Nom de domaine" },
  { nom: "hebergement", libelle: "Responsable de l’hébergement" },
  { nom: "date_mise_en_ligne", libelle: "Date cible de mise en ligne" },
  { nom: "remise_acces", libelle: "Responsable de la remise des accès" },
  { nom: "contenus", libelle: "Apports du client et échéances", aide: "Consignez les références utiles sans saisir de mot de passe." },
  { nom: "criteres_reception", libelle: "Critères de réception F-05" },
  { nom: "formation", libelle: "Formation et remise des accès", aide: "Indiquez « Non applicable » si aucune tâche n’est prévue." },
  { nom: "interlocuteur_client", libelle: "Interlocuteur client habilité" },
] as const

export type ContenuF03 = Partial<Record<(typeof CHAMPS_F03)[number]["nom"], string>>
