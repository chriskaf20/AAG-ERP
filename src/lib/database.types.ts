export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      avis_clients: {
        Row: {
          commentaire: string | null
          created_at: string
          created_by: string | null
          dossier_id: string
          id: string
          note: number
          organization_id: string
          saisi_par: string | null
          updated_at: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          created_by?: string | null
          dossier_id: string
          id?: string
          note: number
          organization_id: string
          saisi_par?: string | null
          updated_at?: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          created_by?: string | null
          dossier_id?: string
          id?: string
          note?: number
          organization_id?: string
          saisi_par?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avis_clients_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avis_clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avis_clients_saisi_par_fkey"
            columns: ["saisi_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          action_corrective: string | null
          created_at: string
          created_by: string | null
          date_cloture: string | null
          description: string
          dossier_id: string
          gravite: Database["public"]["Enums"]["incident_gravite"]
          id: string
          mission_id: string | null
          organization_id: string
          responsable_id: string | null
          statut: Database["public"]["Enums"]["incident_statut"]
          updated_at: string
        }
        Insert: {
          action_corrective?: string | null
          created_at?: string
          created_by?: string | null
          date_cloture?: string | null
          description: string
          dossier_id: string
          gravite?: Database["public"]["Enums"]["incident_gravite"]
          id?: string
          mission_id?: string | null
          organization_id: string
          responsable_id?: string | null
          statut?: Database["public"]["Enums"]["incident_statut"]
          updated_at?: string
        }
        Update: {
          action_corrective?: string | null
          created_at?: string
          created_by?: string | null
          date_cloture?: string | null
          description?: string
          dossier_id?: string
          gravite?: Database["public"]["Enums"]["incident_gravite"]
          id?: string
          mission_id?: string | null
          organization_id?: string
          responsable_id?: string | null
          statut?: Database["public"]["Enums"]["incident_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fournisseurs: {
        Row: {
          actif: boolean
          categorie: string | null
          contact: string | null
          created_at: string
          created_by: string | null
          email: string | null
          evaluation: number | null
          id: string
          nif: string | null
          nom: string
          organization_id: string
          rccm: string | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          categorie?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          evaluation?: number | null
          id?: string
          nif?: string | null
          nom: string
          organization_id: string
          rccm?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          categorie?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          evaluation?: number | null
          id?: string
          nif?: string | null
          nom?: string
          organization_id?: string
          rccm?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fournisseurs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bons_commande: {
        Row: {
          bon_origine_id: string | null
          created_at: string
          created_by: string | null
          department_id: string
          devise: Database["public"]["Enums"]["devise"]
          dossier_id: string | null
          emis_le: string | null
          fournisseur_id: string
          id: string
          mentions_emission: Json | null
          motif_annulation: string | null
          numero: string | null
          objet: string
          organization_id: string
          reliquat_annule_le: string | null
          statut: string
          taux_cdf: number
          taxes: Json
          total_ht: number
          total_ttc: number
          updated_at: string
          valide_le: string | null
          valide_par: string | null
        }
        Insert: {
          bon_origine_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id: string
          devise: Database["public"]["Enums"]["devise"]
          dossier_id?: string | null
          emis_le?: string | null
          fournisseur_id: string
          id?: string
          mentions_emission?: Json | null
          motif_annulation?: string | null
          numero?: string | null
          objet: string
          organization_id: string
          reliquat_annule_le?: string | null
          statut?: string
          taux_cdf: number
          taxes: Json
          total_ht: number
          total_ttc: number
          updated_at?: string
          valide_le?: string | null
          valide_par?: string | null
        }
        Update: {
          bon_origine_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string
          devise?: Database["public"]["Enums"]["devise"]
          dossier_id?: string | null
          emis_le?: string | null
          fournisseur_id?: string
          id?: string
          mentions_emission?: Json | null
          motif_annulation?: string | null
          numero?: string | null
          objet?: string
          organization_id?: string
          reliquat_annule_le?: string | null
          statut?: string
          taux_cdf?: number
          taxes?: Json
          total_ht?: number
          total_ttc?: number
          updated_at?: string
          valide_le?: string | null
          valide_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bons_commande_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_commande_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_commande_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_commande_organization_id_fournisseur_id_fkey"
            columns: ["organization_id", "fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "bons_commande_origine_fk"
            columns: ["organization_id", "bon_origine_id"]
            isOneToOne: false
            referencedRelation: "bons_commande"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      bon_commande_lignes: {
        Row: {
          bon_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          ordre: number
          organization_id: string
          prix_unitaire: number
          quantite: number
          updated_at: string
        }
        Insert: {
          bon_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          ordre: number
          organization_id: string
          prix_unitaire: number
          quantite: number
          updated_at?: string
        }
        Update: {
          bon_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          ordre?: number
          organization_id?: string
          prix_unitaire?: number
          quantite?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bon_commande_lignes_organization_id_bon_id_fkey"
            columns: ["organization_id", "bon_id"]
            isOneToOne: false
            referencedRelation: "bons_commande"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "bon_commande_lignes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      receptions_achat: {
        Row: {
          bon_id: string
          created_at: string
          created_by: string | null
          date_reception: string
          id: string
          observations: string | null
          organization_id: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          bon_id: string
          created_at?: string
          created_by?: string | null
          date_reception: string
          id: string
          observations?: string | null
          organization_id: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          bon_id?: string
          created_at?: string
          created_by?: string | null
          date_reception?: string
          id?: string
          observations?: string | null
          organization_id?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receptions_achat_organization_id_bon_id_fkey"
            columns: ["organization_id", "bon_id"]
            isOneToOne: false
            referencedRelation: "bons_commande"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "receptions_achat_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reception_achat_lignes: {
        Row: {
          bon_id: string
          created_at: string
          created_by: string | null
          id: string
          ligne_id: string
          organization_id: string
          quantite: number
          reception_id: string
          updated_at: string
        }
        Insert: {
          bon_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          ligne_id: string
          organization_id: string
          quantite: number
          reception_id: string
          updated_at?: string
        }
        Update: {
          bon_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          ligne_id?: string
          organization_id?: string
          quantite?: number
          reception_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reception_achat_lignes_organization_id_bon_id_ligne_id_fkey"
            columns: ["organization_id", "bon_id", "ligne_id"]
            isOneToOne: false
            referencedRelation: "bon_commande_lignes"
            referencedColumns: ["organization_id", "bon_id", "id"]
          },
          {
            foreignKeyName: "reception_achat_lignes_organization_id_bon_id_reception_id_fkey"
            columns: ["organization_id", "bon_id", "reception_id"]
            isOneToOne: false
            referencedRelation: "receptions_achat"
            referencedColumns: ["organization_id", "bon_id", "id"]
          },
          {
            foreignKeyName: "reception_achat_lignes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      livrables: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          document_id: string | null
          dossier_id: string
          echeance: string | null
          id: string
          libelle: string
          organization_id: string
          remis_le: string | null
          remis_par: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          dossier_id: string
          echeance?: string | null
          id?: string
          libelle: string
          organization_id: string
          remis_le?: string | null
          remis_par?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          dossier_id?: string
          echeance?: string | null
          id?: string
          libelle?: string
          organization_id?: string
          remis_le?: string | null
          remis_par?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "livrables_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livrables_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livrables_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livrables_remis_par_fkey"
            columns: ["remis_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_agents: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mission_id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mission_id: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mission_id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_agents_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_agents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_agents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          consignes: string | null
          created_at: string
          created_by: string | null
          debut: string
          dossier_id: string
          fin: string | null
          id: string
          lieu: string | null
          motif_annulation: string | null
          organization_id: string
          statut: Database["public"]["Enums"]["mission_statut"]
          titre: string
          type: Database["public"]["Enums"]["mission_type"]
          updated_at: string
        }
        Insert: {
          consignes?: string | null
          created_at?: string
          created_by?: string | null
          debut: string
          dossier_id: string
          fin?: string | null
          id?: string
          lieu?: string | null
          motif_annulation?: string | null
          organization_id: string
          statut?: Database["public"]["Enums"]["mission_statut"]
          titre: string
          type: Database["public"]["Enums"]["mission_type"]
          updated_at?: string
        }
        Update: {
          consignes?: string | null
          created_at?: string
          created_by?: string | null
          debut?: string
          dossier_id?: string
          fin?: string | null
          id?: string
          lieu?: string | null
          motif_annulation?: string | null
          organization_id?: string
          statut?: Database["public"]["Enums"]["mission_statut"]
          titre?: string
          type?: Database["public"]["Enums"]["mission_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      points_avancement: {
        Row: {
          created_at: string
          created_by: string | null
          date_point: string
          dossier_id: string
          email_destinataire: string | null
          email_erreur: string | null
          email_le: string | null
          email_statut: string
          envoye_par: string | null
          id: string
          organization_id: string
          texte: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_point?: string
          dossier_id: string
          email_destinataire?: string | null
          email_erreur?: string | null
          email_le?: string | null
          email_statut?: string
          envoye_par?: string | null
          id?: string
          organization_id: string
          texte: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_point?: string
          dossier_id?: string
          email_destinataire?: string | null
          email_erreur?: string | null
          email_le?: string | null
          email_statut?: string
          envoye_par?: string | null
          id?: string
          organization_id?: string
          texte?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_avancement_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_avancement_envoye_par_fkey"
            columns: ["envoye_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_avancement_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pv_reception: {
        Row: {
          created_at: string
          created_by: string | null
          date_limite_reserves: string | null
          date_reception: string
          decision: string | null
          dossier_id: string
          id: string
          lieu: string | null
          motif_refus: string | null
          observations: string | null
          organization_id: string
          refuse_le: string | null
          satisfaction: number | null
          signature_atlas_id: string | null
          signature_client_id: string | null
          signe_le: string | null
          type: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_limite_reserves?: string | null
          date_reception?: string
          decision?: string | null
          dossier_id: string
          id?: string
          lieu?: string | null
          motif_refus?: string | null
          observations?: string | null
          organization_id: string
          refuse_le?: string | null
          satisfaction?: number | null
          signature_atlas_id?: string | null
          signature_client_id?: string | null
          signe_le?: string | null
          type: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_limite_reserves?: string | null
          date_reception?: string
          decision?: string | null
          dossier_id?: string
          id?: string
          lieu?: string | null
          motif_refus?: string | null
          observations?: string | null
          organization_id?: string
          refuse_le?: string | null
          satisfaction?: number | null
          signature_atlas_id?: string | null
          signature_client_id?: string | null
          signe_le?: string | null
          type?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pv_reception_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_reception_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_reception_signature_atlas_id_fkey"
            columns: ["signature_atlas_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_reception_signature_client_id_fkey"
            columns: ["signature_client_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      pv_reception_lignes: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          id: string
          libelle: string
          observation: string | null
          ordre: number
          organization_id: string
          pv_id: string
          resultat: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          libelle: string
          observation?: string | null
          ordre?: number
          organization_id: string
          pv_id: string
          resultat?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          libelle?: string
          observation?: string | null
          ordre?: number
          organization_id?: string
          pv_id?: string
          resultat?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pv_reception_lignes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_reception_lignes_pv_id_fkey"
            columns: ["pv_id"]
            isOneToOne: false
            referencedRelation: "pv_reception"
            referencedColumns: ["id"]
          },
        ]
      }
      rapport_photos: {
        Row: {
          chemin: string
          created_at: string
          created_by: string | null
          hauteur: number | null
          id: string
          largeur: number | null
          legende: string | null
          organization_id: string
          rapport_id: string
          taille: number | null
          updated_at: string
        }
        Insert: {
          chemin: string
          created_at?: string
          created_by?: string | null
          hauteur?: number | null
          id?: string
          largeur?: number | null
          legende?: string | null
          organization_id: string
          rapport_id: string
          taille?: number | null
          updated_at?: string
        }
        Update: {
          chemin?: string
          created_at?: string
          created_by?: string | null
          hauteur?: number | null
          id?: string
          largeur?: number | null
          legende?: string | null
          organization_id?: string
          rapport_id?: string
          taille?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rapport_photos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rapport_photos_rapport_id_fkey"
            columns: ["rapport_id"]
            isOneToOne: false
            referencedRelation: "rapports_intervention"
            referencedColumns: ["id"]
          },
        ]
      }
      rapports_intervention: {
        Row: {
          created_at: string
          created_by: string | null
          dossier_id: string
          id: string
          latitude: number | null
          longitude: number | null
          mission_id: string
          observations: string | null
          organization_id: string
          precision_m: number | null
          redige_par: string | null
          remplace_id: string | null
          signature_client_id: string | null
          signe_le: string | null
          travaux: string
          updated_at: string
          valide_le: string | null
          valide_par: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dossier_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          mission_id: string
          observations?: string | null
          organization_id: string
          precision_m?: number | null
          redige_par?: string | null
          remplace_id?: string | null
          signature_client_id?: string | null
          signe_le?: string | null
          travaux: string
          updated_at?: string
          valide_le?: string | null
          valide_par?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dossier_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          mission_id?: string
          observations?: string | null
          organization_id?: string
          precision_m?: number | null
          redige_par?: string | null
          remplace_id?: string | null
          signature_client_id?: string | null
          signe_le?: string | null
          travaux?: string
          updated_at?: string
          valide_le?: string | null
          valide_par?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "rapports_intervention_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rapports_intervention_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rapports_intervention_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rapports_intervention_redige_par_fkey"
            columns: ["redige_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rapports_intervention_remplace_id_fkey"
            columns: ["remplace_id"]
            isOneToOne: false
            referencedRelation: "rapports_intervention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rapports_intervention_signature_client_id_fkey"
            columns: ["signature_client_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rapports_intervention_valide_par_fkey"
            columns: ["valide_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reserves: {
        Row: {
          commentaire_levee: string | null
          created_at: string
          created_by: string | null
          date_limite: string | null
          description: string
          dossier_id: string
          id: string
          levee_le: string | null
          levee_par: string | null
          organization_id: string
          pv_id: string
          statut: string
          updated_at: string
        }
        Insert: {
          commentaire_levee?: string | null
          created_at?: string
          created_by?: string | null
          date_limite?: string | null
          description: string
          dossier_id: string
          id?: string
          levee_le?: string | null
          levee_par?: string | null
          organization_id: string
          pv_id: string
          statut?: string
          updated_at?: string
        }
        Update: {
          commentaire_levee?: string | null
          created_at?: string
          created_by?: string | null
          date_limite?: string | null
          description?: string
          dossier_id?: string
          id?: string
          levee_le?: string | null
          levee_par?: string | null
          organization_id?: string
          pv_id?: string
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reserves_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserves_levee_par_fkey"
            columns: ["levee_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserves_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserves_pv_id_fkey"
            columns: ["pv_id"]
            isOneToOne: false
            referencedRelation: "pv_reception"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          created_by: string | null
          id: number
          motif: string | null
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
          record_id: string | null
          table_name: string
          updated_at: string
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: never
          motif?: string | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string | null
          table_name: string
          updated_at?: string
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: never
          motif?: string | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string | null
          table_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      avenants: {
        Row: {
          contrat_id: string
          created_at: string
          created_by: string | null
          date_effet: string | null
          document_id: string | null
          id: string
          montant_delta: number
          numero: string
          objet: string
          organization_id: string
          signe_le: string | null
          statut: Database["public"]["Enums"]["contrat_statut"]
          updated_at: string
        }
        Insert: {
          contrat_id: string
          created_at?: string
          created_by?: string | null
          date_effet?: string | null
          document_id?: string | null
          id?: string
          montant_delta?: number
          numero?: string
          objet: string
          organization_id: string
          signe_le?: string | null
          statut?: Database["public"]["Enums"]["contrat_statut"]
          updated_at?: string
        }
        Update: {
          contrat_id?: string
          created_at?: string
          created_by?: string | null
          date_effet?: string | null
          document_id?: string | null
          id?: string
          montant_delta?: number
          numero?: string
          objet?: string
          organization_id?: string
          signe_le?: string | null
          statut?: Database["public"]["Enums"]["contrat_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avenants_contrat_id_fkey"
            columns: ["contrat_id"]
            isOneToOne: false
            referencedRelation: "contrats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avenants_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avenants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      avoirs: {
        Row: {
          code_authentification_def: string | null
          created_at: string
          created_by: string | null
          date_avoir: string
          dossier_id: string
          facture_id: string
          id: string
          montant_ttc: number
          motif: string
          numero: string
          numero_avoir_normalise: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          code_authentification_def?: string | null
          created_at?: string
          created_by?: string | null
          date_avoir?: string
          dossier_id: string
          facture_id: string
          id?: string
          montant_ttc: number
          motif: string
          numero: string
          numero_avoir_normalise?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          code_authentification_def?: string | null
          created_at?: string
          created_by?: string | null
          date_avoir?: string
          dossier_id?: string
          facture_id?: string
          id?: string
          montant_ttc?: number
          motif?: string
          numero?: string
          numero_avoir_normalise?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avoirs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avoirs_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avoirs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          adresse: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          id_nat: string | null
          nif: string | null
          notes: string | null
          organization_id: string
          raison_sociale: string
          rccm: string | null
          telephone: string | null
          type: Database["public"]["Enums"]["client_type"]
          updated_at: string
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          id_nat?: string | null
          nif?: string | null
          notes?: string | null
          organization_id: string
          raison_sociale: string
          rccm?: string | null
          telephone?: string | null
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          id_nat?: string | null
          nif?: string | null
          notes?: string | null
          organization_id?: string
          raison_sociale?: string
          rccm?: string | null
          telephone?: string | null
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compteurs: {
        Row: {
          annee: number
          created_at: string
          created_by: string | null
          dernier: number
          organization_id: string
          type: string
          updated_at: string
        }
        Insert: {
          annee: number
          created_at?: string
          created_by?: string | null
          dernier?: number
          organization_id: string
          type: string
          updated_at?: string
        }
        Update: {
          annee?: number
          created_at?: string
          created_by?: string | null
          dernier?: number
          organization_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compteurs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          email: string | null
          est_signataire: boolean
          fonction: string | null
          id: string
          nom: string
          organization_id: string
          telephone: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          est_signataire?: boolean
          fonction?: string | null
          id?: string
          nom: string
          organization_id: string
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          est_signataire?: boolean
          fonction?: string | null
          id?: string
          nom?: string
          organization_id?: string
          telephone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contrats: {
        Row: {
          reception_tacite: boolean
          created_at: string
          created_by: string | null
          date_debut: string | null
          date_fin: string | null
          devis_id: string | null
          devise: Database["public"]["Enums"]["devise"]
          document_id: string | null
          dossier_id: string
          id: string
          montant: number | null
          numero: string
          objet: string
          organization_id: string
          signe_le: string | null
          statut: Database["public"]["Enums"]["contrat_statut"]
          updated_at: string
        }
        Insert: {
          reception_tacite?: boolean
          created_at?: string
          created_by?: string | null
          date_debut?: string | null
          date_fin?: string | null
          devis_id?: string | null
          devise?: Database["public"]["Enums"]["devise"]
          document_id?: string | null
          dossier_id: string
          id?: string
          montant?: number | null
          numero?: string
          objet: string
          organization_id: string
          signe_le?: string | null
          statut?: Database["public"]["Enums"]["contrat_statut"]
          updated_at?: string
        }
        Update: {
          reception_tacite?: boolean
          created_at?: string
          created_by?: string | null
          date_debut?: string | null
          date_fin?: string | null
          devis_id?: string | null
          devise?: Database["public"]["Enums"]["devise"]
          document_id?: string | null
          dossier_id?: string
          id?: string
          montant?: number | null
          numero?: string
          objet?: string
          organization_id?: string
          signe_le?: string | null
          statut?: Database["public"]["Enums"]["contrat_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrats_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrats_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrats_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      def_transmissions: {
        Row: {
          avoir_id: string | null
          created_at: string
          created_by: string | null
          facture_id: string | null
          fournisseur: string | null
          id: string
          message: string | null
          mode: string
          organization_id: string
          reponse: Json | null
          requete: Json | null
          statut: string
          updated_at: string
        }
        Insert: {
          avoir_id?: string | null
          created_at?: string
          created_by?: string | null
          facture_id?: string | null
          fournisseur?: string | null
          id?: string
          message?: string | null
          mode: string
          organization_id: string
          reponse?: Json | null
          requete?: Json | null
          statut: string
          updated_at?: string
        }
        Update: {
          avoir_id?: string | null
          created_at?: string
          created_by?: string | null
          facture_id?: string | null
          fournisseur?: string | null
          id?: string
          message?: string | null
          mode?: string
          organization_id?: string
          reponse?: Json | null
          requete?: Json | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "def_transmissions_avoir_id_fkey"
            columns: ["avoir_id"]
            isOneToOne: false
            referencedRelation: "avoirs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "def_transmissions_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "def_transmissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: Database["public"]["Enums"]["dept_code"]
          created_at: string
          created_by: string | null
          id: string
          nom: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          code: Database["public"]["Enums"]["dept_code"]
          created_at?: string
          created_by?: string | null
          id?: string
          nom: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          code?: Database["public"]["Enums"]["dept_code"]
          created_at?: string
          created_by?: string | null
          id?: string
          nom?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      devis: {
        Row: {
          acompte_pct: number | null
          conditions_paiement: string | null
          created_at: string
          created_by: string | null
          date_devis: string
          date_validite: string | null
          depasse_seuil: boolean
          devise: Database["public"]["Enums"]["devise"]
          dossier_id: string
          envoye_le: string | null
          envoye_par: string | null
          id: string
          marge: number
          motif_refus: string | null
          numero: string
          objet: string | null
          organization_id: string
          refuse_le: string | null
          signature_id: string | null
          signe_le: string | null
          soumis_le: string | null
          soumis_par: string | null
          statut: Database["public"]["Enums"]["devis_statut"]
          taux_cdf: number
          taxes: Json | null
          total_brut: number
          total_cout: number
          total_ht: number
          total_remise: number
          total_taxes: number
          total_ttc: number
          total_ttc_usd: number
          updated_at: string
          valide_le: string | null
          valide_par: string | null
          validite_jours: number
          version: number
          version_precedente_id: string | null
        }
        Insert: {
          acompte_pct?: number | null
          conditions_paiement?: string | null
          created_at?: string
          created_by?: string | null
          date_devis?: string
          date_validite?: string | null
          depasse_seuil?: boolean
          devise?: Database["public"]["Enums"]["devise"]
          dossier_id: string
          envoye_le?: string | null
          envoye_par?: string | null
          id?: string
          marge?: number
          motif_refus?: string | null
          numero?: string
          objet?: string | null
          organization_id: string
          refuse_le?: string | null
          signature_id?: string | null
          signe_le?: string | null
          soumis_le?: string | null
          soumis_par?: string | null
          statut?: Database["public"]["Enums"]["devis_statut"]
          taux_cdf?: number
          taxes?: Json | null
          total_brut?: number
          total_cout?: number
          total_ht?: number
          total_remise?: number
          total_taxes?: number
          total_ttc?: number
          total_ttc_usd?: number
          updated_at?: string
          valide_le?: string | null
          valide_par?: string | null
          validite_jours?: number
          version?: number
          version_precedente_id?: string | null
        }
        Update: {
          acompte_pct?: number | null
          conditions_paiement?: string | null
          created_at?: string
          created_by?: string | null
          date_devis?: string
          date_validite?: string | null
          depasse_seuil?: boolean
          devise?: Database["public"]["Enums"]["devise"]
          dossier_id?: string
          envoye_le?: string | null
          envoye_par?: string | null
          id?: string
          marge?: number
          motif_refus?: string | null
          numero?: string
          objet?: string | null
          organization_id?: string
          refuse_le?: string | null
          signature_id?: string | null
          signe_le?: string | null
          soumis_le?: string | null
          soumis_par?: string | null
          statut?: Database["public"]["Enums"]["devis_statut"]
          taux_cdf?: number
          taxes?: Json | null
          total_brut?: number
          total_cout?: number
          total_ht?: number
          total_remise?: number
          total_taxes?: number
          total_ttc?: number
          total_ttc_usd?: number
          updated_at?: string
          valide_le?: string | null
          valide_par?: string | null
          validite_jours?: number
          version?: number
          version_precedente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_envoye_par_fkey"
            columns: ["envoye_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_soumis_par_fkey"
            columns: ["soumis_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_valide_par_fkey"
            columns: ["valide_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_version_precedente_id_fkey"
            columns: ["version_precedente_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_lignes: {
        Row: {
          cout_unitaire: number | null
          created_at: string
          created_by: string | null
          description: string
          devis_id: string
          id: string
          montant_brut: number | null
          montant_ht: number | null
          ordre: number
          organization_id: string
          prix_unitaire: number
          quantite: number
          remise_pct: number
          service_id: string | null
          unite: Database["public"]["Enums"]["unite_service"]
          updated_at: string
        }
        Insert: {
          cout_unitaire?: number | null
          created_at?: string
          created_by?: string | null
          description: string
          devis_id: string
          id?: string
          montant_brut?: number | null
          montant_ht?: number | null
          ordre?: number
          organization_id: string
          prix_unitaire?: number
          quantite?: number
          remise_pct?: number
          service_id?: string | null
          unite?: Database["public"]["Enums"]["unite_service"]
          updated_at?: string
        }
        Update: {
          cout_unitaire?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          devis_id?: string
          id?: string
          montant_brut?: number | null
          montant_ht?: number | null
          ordre?: number
          organization_id?: string
          prix_unitaire?: number
          quantite?: number
          remise_pct?: number
          service_id?: string | null
          unite?: Database["public"]["Enums"]["unite_service"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devis_lignes_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_lignes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_lignes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          bucket: string
          chemin: string
          client_id: string | null
          created_at: string
          created_by: string | null
          dossier_id: string | null
          est_signe: boolean
          id: string
          libelle: string | null
          mime_type: string | null
          nom_fichier: string
          organization_id: string
          signe_le: string | null
          signe_par: string | null
          taille: number | null
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          version: number
          version_precedente_id: string | null
        }
        Insert: {
          bucket: string
          chemin: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          dossier_id?: string | null
          est_signe?: boolean
          id?: string
          libelle?: string | null
          mime_type?: string | null
          nom_fichier: string
          organization_id: string
          signe_le?: string | null
          signe_par?: string | null
          taille?: number | null
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          version?: number
          version_precedente_id?: string | null
        }
        Update: {
          bucket?: string
          chemin?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          dossier_id?: string | null
          est_signe?: boolean
          id?: string
          libelle?: string | null
          mime_type?: string | null
          nom_fichier?: string
          organization_id?: string
          signe_le?: string | null
          signe_par?: string | null
          taille?: number | null
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          version?: number
          version_precedente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_signe_par_fkey"
            columns: ["signe_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_version_precedente_id_fkey"
            columns: ["version_precedente_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      dossier_affectations: {
        Row: {
          created_at: string
          created_by: string | null
          dossier_id: string
          id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dossier_id: string
          id?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dossier_id?: string
          id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossier_affectations_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossier_affectations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossier_affectations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dossier_counters: {
        Row: {
          annee: number
          created_at: string
          created_by: string | null
          dernier: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          annee: number
          created_at?: string
          created_by?: string | null
          dernier?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          annee?: number
          created_at?: string
          created_by?: string | null
          dernier?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossier_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dossier_status_history: {
        Row: {
          ancien_statut: Database["public"]["Enums"]["dossier_statut"] | null
          created_at: string
          created_by: string | null
          dossier_id: string
          id: string
          motif: string | null
          nouveau_statut: Database["public"]["Enums"]["dossier_statut"]
          organization_id: string
          updated_at: string
        }
        Insert: {
          ancien_statut?: Database["public"]["Enums"]["dossier_statut"] | null
          created_at?: string
          created_by?: string | null
          dossier_id: string
          id?: string
          motif?: string | null
          nouveau_statut: Database["public"]["Enums"]["dossier_statut"]
          organization_id: string
          updated_at?: string
        }
        Update: {
          ancien_statut?: Database["public"]["Enums"]["dossier_statut"] | null
          created_at?: string
          created_by?: string | null
          dossier_id?: string
          id?: string
          motif?: string | null
          nouveau_statut?: Database["public"]["Enums"]["dossier_statut"]
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossier_status_history_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossier_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dossiers: {
        Row: {
          receptionne_le: string | null
          reception_tacite: boolean
          garantie_fin: string | null
          accuse_reception_envoye: boolean
          annee: number
          besoin: string
          budget_devise: Database["public"]["Enums"]["devise"]
          budget_indicatif: number | null
          canal: Database["public"]["Enums"]["canal_reception"]
          client_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          date_reception: string
          delai_souhaite: string | null
          department_id: string
          id: string
          numero: string
          organization_id: string
          pieces_autres: string | null
          pieces_recues: Database["public"]["Enums"]["piece_type"][]
          responsable_id: string | null
          service: string
          statut: Database["public"]["Enums"]["dossier_statut"]
          statut_change_le: string | null
          statut_motif: string | null
          updated_at: string
        }
        Insert: {
          receptionne_le?: string | null
          reception_tacite?: boolean
          garantie_fin?: string | null
          accuse_reception_envoye?: boolean
          annee?: number
          besoin: string
          budget_devise?: Database["public"]["Enums"]["devise"]
          budget_indicatif?: number | null
          canal: Database["public"]["Enums"]["canal_reception"]
          client_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          date_reception?: string
          delai_souhaite?: string | null
          department_id: string
          id?: string
          numero?: string
          organization_id: string
          pieces_autres?: string | null
          pieces_recues?: Database["public"]["Enums"]["piece_type"][]
          responsable_id?: string | null
          service: string
          statut?: Database["public"]["Enums"]["dossier_statut"]
          statut_change_le?: string | null
          statut_motif?: string | null
          updated_at?: string
        }
        Update: {
          receptionne_le?: string | null
          reception_tacite?: boolean
          garantie_fin?: string | null
          accuse_reception_envoye?: boolean
          annee?: number
          besoin?: string
          budget_devise?: Database["public"]["Enums"]["devise"]
          budget_indicatif?: number | null
          canal?: Database["public"]["Enums"]["canal_reception"]
          client_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          date_reception?: string
          delai_souhaite?: string | null
          department_id?: string
          id?: string
          numero?: string
          organization_id?: string
          pieces_autres?: string | null
          pieces_recues?: Database["public"]["Enums"]["piece_type"][]
          responsable_id?: string | null
          service?: string
          statut?: Database["public"]["Enums"]["dossier_statut"]
          statut_change_le?: string | null
          statut_motif?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossiers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      facture_lignes: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          facture_id: string
          id: string
          montant_brut: number | null
          montant_ht: number | null
          ordre: number
          organization_id: string
          prix_unitaire: number
          quantite: number
          remise_pct: number
          service_id: string | null
          unite: Database["public"]["Enums"]["unite_service"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          facture_id: string
          id?: string
          montant_brut?: number | null
          montant_ht?: number | null
          ordre?: number
          organization_id: string
          prix_unitaire?: number
          quantite?: number
          remise_pct?: number
          service_id?: string | null
          unite?: Database["public"]["Enums"]["unite_service"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          facture_id?: string
          id?: string
          montant_brut?: number | null
          montant_ht?: number | null
          ordre?: number
          organization_id?: string
          prix_unitaire?: number
          quantite?: number
          remise_pct?: number
          service_id?: string | null
          unite?: Database["public"]["Enums"]["unite_service"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facture_lignes_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facture_lignes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facture_lignes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      factures: {
        Row: {
          arrondi: number
          code_authentification_def: string | null
          created_at: string
          created_by: string | null
          date_emission: string | null
          delai_paiement_jours: number
          devis_id: string | null
          devise: Database["public"]["Enums"]["devise"]
          dossier_id: string
          echeance: string | null
          emise_le: string | null
          emise_par: string | null
          id: string
          montant_avoirs: number
          montant_paye: number
          normalisee_le: string | null
          normalisee_par: string | null
          numero: string | null
          numero_facture_normalisee: string | null
          objet: string | null
          organization_id: string
          periode_debut: string | null
          periode_fin: string | null
          qr_code: string | null
          remise_client_le: string | null
          remise_client_par: string | null
          solde_du: number | null
          statut: Database["public"]["Enums"]["facture_statut"]
          taux_cdf: number
          taxes: Json | null
          total_brut: number
          total_ht: number
          total_remise: number
          total_taxes: number
          total_ttc: number
          type: Database["public"]["Enums"]["facture_type"]
          updated_at: string
        }
        Insert: {
          arrondi?: number
          code_authentification_def?: string | null
          created_at?: string
          created_by?: string | null
          date_emission?: string | null
          delai_paiement_jours?: number
          devis_id?: string | null
          devise?: Database["public"]["Enums"]["devise"]
          dossier_id: string
          echeance?: string | null
          emise_le?: string | null
          emise_par?: string | null
          id?: string
          montant_avoirs?: number
          montant_paye?: number
          normalisee_le?: string | null
          normalisee_par?: string | null
          numero?: string | null
          numero_facture_normalisee?: string | null
          objet?: string | null
          organization_id: string
          periode_debut?: string | null
          periode_fin?: string | null
          qr_code?: string | null
          remise_client_le?: string | null
          remise_client_par?: string | null
          solde_du?: number | null
          statut?: Database["public"]["Enums"]["facture_statut"]
          taux_cdf?: number
          taxes?: Json | null
          total_brut?: number
          total_ht?: number
          total_remise?: number
          total_taxes?: number
          total_ttc?: number
          type: Database["public"]["Enums"]["facture_type"]
          updated_at?: string
        }
        Update: {
          arrondi?: number
          code_authentification_def?: string | null
          created_at?: string
          created_by?: string | null
          date_emission?: string | null
          delai_paiement_jours?: number
          devis_id?: string | null
          devise?: Database["public"]["Enums"]["devise"]
          dossier_id?: string
          echeance?: string | null
          emise_le?: string | null
          emise_par?: string | null
          id?: string
          montant_avoirs?: number
          montant_paye?: number
          normalisee_le?: string | null
          normalisee_par?: string | null
          numero?: string | null
          numero_facture_normalisee?: string | null
          objet?: string | null
          organization_id?: string
          periode_debut?: string | null
          periode_fin?: string | null
          qr_code?: string | null
          remise_client_le?: string | null
          remise_client_par?: string | null
          solde_du?: number | null
          statut?: Database["public"]["Enums"]["facture_statut"]
          taux_cdf?: number
          taxes?: Json | null
          total_brut?: number
          total_ht?: number
          total_remise?: number
          total_taxes?: number
          total_ttc?: number
          type?: Database["public"]["Enums"]["facture_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factures_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_emise_par_fkey"
            columns: ["emise_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_normalisee_par_fkey"
            columns: ["normalisee_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_remise_client_par_fkey"
            columns: ["remise_client_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      liens_signature: {
        Row: {
          created_at: string
          created_by: string | null
          dossier_id: string
          expire_le: string
          id: string
          objet_id: string
          objet_type: Database["public"]["Enums"]["signature_objet"]
          organization_id: string
          revoque_le: string | null
          token_hash: string
          updated_at: string
          utilise_le: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dossier_id: string
          expire_le: string
          id?: string
          objet_id: string
          objet_type: Database["public"]["Enums"]["signature_objet"]
          organization_id: string
          revoque_le?: string | null
          token_hash: string
          updated_at?: string
          utilise_le?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dossier_id?: string
          expire_le?: string
          id?: string
          objet_id?: string
          objet_type?: Database["public"]["Enums"]["signature_objet"]
          organization_id?: string
          revoque_le?: string | null
          token_hash?: string
          updated_at?: string
          utilise_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "liens_signature_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liens_signature_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lien: string | null
          lu_le: string | null
          message: string | null
          organization_id: string
          titre: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lien?: string | null
          lu_le?: string | null
          message?: string | null
          organization_id: string
          titre: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lien?: string | null
          lu_le?: string | null
          message?: string | null
          organization_id?: string
          titre?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          adresse: string | null
          created_at: string
          created_by: string | null
          devise: Database["public"]["Enums"]["devise"]
          email: string | null
          id: string
          id_nat: string | null
          logo_path: string | null
          nif: string | null
          nom: string
          organization_id: string | null
          parametres: Json
          prefixe_dossier: string
          rccm: string | null
          sigle: string | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          created_at?: string
          created_by?: string | null
          devise?: Database["public"]["Enums"]["devise"]
          email?: string | null
          id?: string
          id_nat?: string | null
          logo_path?: string | null
          nif?: string | null
          nom: string
          organization_id?: string | null
          parametres?: Json
          prefixe_dossier?: string
          rccm?: string | null
          sigle?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          created_at?: string
          created_by?: string | null
          devise?: Database["public"]["Enums"]["devise"]
          email?: string | null
          id?: string
          id_nat?: string | null
          logo_path?: string | null
          nif?: string | null
          nom?: string
          organization_id?: string | null
          parametres?: Json
          prefixe_dossier?: string
          rccm?: string | null
          sigle?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      paiements: {
        Row: {
          created_at: string
          created_by: string | null
          date_paiement: string
          devise: Database["public"]["Enums"]["devise"]
          dossier_id: string | null
          facture_id: string
          id: string
          mode: Database["public"]["Enums"]["paiement_mode"]
          montant: number
          numero_recu: string
          organization_id: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_paiement?: string
          devise?: Database["public"]["Enums"]["devise"]
          dossier_id?: string | null
          facture_id: string
          id?: string
          mode: Database["public"]["Enums"]["paiement_mode"]
          montant: number
          numero_recu?: string
          organization_id: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_paiement?: string
          devise?: Database["public"]["Enums"]["devise"]
          dossier_id?: string | null
          facture_id?: string
          id?: string
          mode?: Database["public"]["Enums"]["paiement_mode"]
          montant?: number
          numero_recu?: string
          organization_id?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paiements_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          fonction: string | null
          id: string
          nom_complet: string
          organization_id: string | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          fonction?: string | null
          id: string
          nom_complet?: string
          organization_id?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          fonction?: string | null
          id?: string
          nom_complet?: string
          organization_id?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pv_lancement: {
        Row: {
          acces_site_confirme: boolean
          acompte_confirme: boolean
          created_at: string
          created_by: string | null
          date_lancement: string
          devis_id: string | null
          dossier_id: string
          id: string
          interlocuteurs_confirmes: boolean
          lieu: string | null
          livrables_confirmes: boolean
          observations: string | null
          organization_id: string
          perimetre_confirme: boolean
          planning_confirme: boolean
          signature_atlas_id: string | null
          signature_client_id: string | null
          signe_le: string | null
          updated_at: string
        }
        Insert: {
          acces_site_confirme?: boolean
          acompte_confirme?: boolean
          created_at?: string
          created_by?: string | null
          date_lancement?: string
          devis_id?: string | null
          dossier_id: string
          id?: string
          interlocuteurs_confirmes?: boolean
          lieu?: string | null
          livrables_confirmes?: boolean
          observations?: string | null
          organization_id: string
          perimetre_confirme?: boolean
          planning_confirme?: boolean
          signature_atlas_id?: string | null
          signature_client_id?: string | null
          signe_le?: string | null
          updated_at?: string
        }
        Update: {
          acces_site_confirme?: boolean
          acompte_confirme?: boolean
          created_at?: string
          created_by?: string | null
          date_lancement?: string
          devis_id?: string | null
          dossier_id?: string
          id?: string
          interlocuteurs_confirmes?: boolean
          lieu?: string | null
          livrables_confirmes?: boolean
          observations?: string | null
          organization_id?: string
          perimetre_confirme?: boolean
          planning_confirme?: boolean
          signature_atlas_id?: string | null
          signature_client_id?: string | null
          signe_le?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pv_lancement_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_lancement_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_lancement_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_lancement_signature_atlas_id_fkey"
            columns: ["signature_atlas_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_lancement_signature_client_id_fkey"
            columns: ["signature_client_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      relances: {
        Row: {
          canal: string
          created_at: string
          created_by: string | null
          destinataire: string | null
          dossier_id: string
          envoyee_le: string
          erreur: string | null
          id: string
          niveau: Database["public"]["Enums"]["relance_niveau"]
          objet_id: string
          objet_type: string
          organization_id: string
          statut: string
          updated_at: string
        }
        Insert: {
          canal?: string
          created_at?: string
          created_by?: string | null
          destinataire?: string | null
          dossier_id: string
          envoyee_le?: string
          erreur?: string | null
          id?: string
          niveau: Database["public"]["Enums"]["relance_niveau"]
          objet_id: string
          objet_type: string
          organization_id: string
          statut: string
          updated_at?: string
        }
        Update: {
          canal?: string
          created_at?: string
          created_by?: string | null
          destinataire?: string | null
          dossier_id?: string
          envoyee_le?: string
          erreur?: string | null
          id?: string
          niveau?: Database["public"]["Enums"]["relance_niveau"]
          objet_id?: string
          objet_type?: string
          organization_id?: string
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relances_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          actif: boolean
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          id: string
          nom: string
          organization_id: string
          prix_base_usd: number
          unite: Database["public"]["Enums"]["unite_service"]
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          nom: string
          organization_id: string
          prix_base_usd?: number
          unite?: Database["public"]["Enums"]["unite_service"]
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          nom?: string
          organization_id?: string
          prix_base_usd?: number
          unite?: Database["public"]["Enums"]["unite_service"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          created_at: string
          created_by: string | null
          dossier_id: string
          id: string
          image_png: string
          ip: unknown
          lien_id: string | null
          nom_signataire: string
          objet_id: string
          objet_type: Database["public"]["Enums"]["signature_objet"]
          organization_id: string
          partie: string
          signe_le: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dossier_id: string
          id?: string
          image_png: string
          ip?: unknown
          lien_id?: string | null
          nom_signataire: string
          objet_id: string
          objet_type: Database["public"]["Enums"]["signature_objet"]
          organization_id: string
          partie: string
          signe_le?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dossier_id?: string
          id?: string
          image_png?: string
          ip?: unknown
          lien_id?: string | null
          nom_signataire?: string
          objet_id?: string
          objet_type?: Database["public"]["Enums"]["signature_objet"]
          organization_id?: string
          partie?: string
          signe_le?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signatures_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verifications: {
        Row: {
          absence_conflit: boolean | null
          absence_conflit_obs: string | null
          activite_legale: boolean | null
          activite_legale_obs: string | null
          capacite_atlas: boolean | null
          capacite_atlas_obs: string | null
          capacite_paiement: boolean | null
          capacite_paiement_obs: string | null
          coordonnees_confirmees: boolean | null
          coordonnees_confirmees_obs: string | null
          created_at: string
          created_by: string | null
          decision: Database["public"]["Enums"]["verification_decision"] | null
          documents_valides: boolean | null
          documents_valides_obs: string | null
          dossier_id: string
          id: string
          identite_verifiee: boolean | null
          identite_verifiee_obs: string | null
          motif: string | null
          observations: string | null
          organization_id: string
          pieces_demandees: string | null
          signataire_habilite: boolean | null
          signataire_habilite_obs: string | null
          updated_at: string
          valide_le: string | null
          valide_par: string | null
          verifie_le: string | null
          verifie_par: string | null
        }
        Insert: {
          absence_conflit?: boolean | null
          absence_conflit_obs?: string | null
          activite_legale?: boolean | null
          activite_legale_obs?: string | null
          capacite_atlas?: boolean | null
          capacite_atlas_obs?: string | null
          capacite_paiement?: boolean | null
          capacite_paiement_obs?: string | null
          coordonnees_confirmees?: boolean | null
          coordonnees_confirmees_obs?: string | null
          created_at?: string
          created_by?: string | null
          decision?: Database["public"]["Enums"]["verification_decision"] | null
          documents_valides?: boolean | null
          documents_valides_obs?: string | null
          dossier_id: string
          id?: string
          identite_verifiee?: boolean | null
          identite_verifiee_obs?: string | null
          motif?: string | null
          observations?: string | null
          organization_id: string
          pieces_demandees?: string | null
          signataire_habilite?: boolean | null
          signataire_habilite_obs?: string | null
          updated_at?: string
          valide_le?: string | null
          valide_par?: string | null
          verifie_le?: string | null
          verifie_par?: string | null
        }
        Update: {
          absence_conflit?: boolean | null
          absence_conflit_obs?: string | null
          activite_legale?: boolean | null
          activite_legale_obs?: string | null
          capacite_atlas?: boolean | null
          capacite_atlas_obs?: string | null
          capacite_paiement?: boolean | null
          capacite_paiement_obs?: string | null
          coordonnees_confirmees?: boolean | null
          coordonnees_confirmees_obs?: string | null
          created_at?: string
          created_by?: string | null
          decision?: Database["public"]["Enums"]["verification_decision"] | null
          documents_valides?: boolean | null
          documents_valides_obs?: string | null
          dossier_id?: string
          id?: string
          identite_verifiee?: boolean | null
          identite_verifiee_obs?: string | null
          motif?: string | null
          observations?: string | null
          organization_id?: string
          pieces_demandees?: string | null
          signataire_habilite?: boolean | null
          signataire_habilite_obs?: string | null
          updated_at?: string
          valide_le?: string | null
          valide_par?: string | null
          verifie_le?: string | null
          verifie_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verifications_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_valide_par_fkey"
            columns: ["valide_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_verifie_par_fkey"
            columns: ["verifie_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      remplacer_bon_commande: {
        Args: { p_bon: string; p_motif: string; p_org: string }
        Returns: string
      }
      receptionner_achat: {
        Args: { p_org: string; p_bon: string; p_operation: string; p_date: string; p_reference: string | null; p_observations: string | null; p_lignes: Json }
        Returns: string
      }
      enregistrer_bon_commande: {
        Args: { p_org: string; p_fournisseur: string; p_departement: string; p_dossier: string | null; p_objet: string; p_devise: Database["public"]["Enums"]["devise"]; p_lignes: Json; p_bon?: string }
        Returns: string
      }
      transition_bon_commande: {
        Args: { p_org: string; p_bon: string; p_action: string; p_motif?: string }
        Returns: undefined
      }
      confirmer_envoi_point: { Args: { p_erreur?: string; p_ok: boolean; p_point: string }; Returns: undefined }
      creer_lien_pv_reception: { Args: { p_pv: string }; Returns: string }
      enregistrer_point_avancement: { Args: { p_dossier: string; p_texte: string }; Returns: Json }
      lever_reserve: { Args: { p_commentaire?: string; p_reserve: string }; Returns: Database["public"]["Tables"]["reserves"]["Row"] }
      mes_missions: { Args: { p_org: string }; Returns: Json }
      mission_detail: { Args: { p_mission: string }; Returns: Json }
      nouvelle_version_rapport: { Args: { p_rapport: string }; Returns: string }
      refuser_reception: { Args: { p_motif: string; p_pv: string }; Returns: Database["public"]["Tables"]["dossiers"]["Row"] }
      signer_pv_reception: { Args: { p_image: string; p_nom: string; p_partie: string; p_pv: string }; Returns: Database["public"]["Tables"]["pv_reception"]["Row"] }
      signer_rapport: { Args: { p_image: string; p_nom: string; p_rapport: string }; Returns: Database["public"]["Tables"]["rapports_intervention"]["Row"] }
      valider_rapport: { Args: { p_rapport: string }; Returns: Database["public"]["Tables"]["rapports_intervention"]["Row"] }
      calcul_taxes: { Args: { p_ht: number; p_taxes: Json }; Returns: number }
      can_edit_dossier: { Args: { p_dossier: string }; Returns: boolean }
      can_see_client: { Args: { p_client: string }; Returns: boolean }
      can_see_dossier: { Args: { p_dossier: string }; Returns: boolean }
      can_see_finance: { Args: { p_dossier: string }; Returns: boolean }
      can_write_clients: { Args: { p_org: string }; Returns: boolean }
      change_dossier_status: {
        Args: {
          p_dossier_id: string
          p_motif?: string
          p_nouveau_statut: Database["public"]["Enums"]["dossier_statut"]
        }
        Returns: {
          accuse_reception_envoye: boolean
          annee: number
          besoin: string
          budget_devise: Database["public"]["Enums"]["devise"]
          budget_indicatif: number | null
          canal: Database["public"]["Enums"]["canal_reception"]
          client_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          date_reception: string
          delai_souhaite: string | null
          department_id: string
          id: string
          numero: string
          organization_id: string
          pieces_autres: string | null
          pieces_recues: Database["public"]["Enums"]["piece_type"][]
          responsable_id: string | null
          service: string
          statut: Database["public"]["Enums"]["dossier_statut"]
          statut_change_le: string | null
          statut_motif: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "dossiers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      contexte_utilisateur: { Args: { p_org: string }; Returns: Json }
      contrat_dossier: { Args: { p_contrat: string }; Returns: string }
      creer_facture_depuis_devis: {
        Args: {
          p_devis: string
          p_type: Database["public"]["Enums"]["facture_type"]
        }
        Returns: string
      }
      creer_lien_pv: { Args: { p_pv: string }; Returns: string }
      creer_lien_signature: {
        Args: {
          p_dossier: string
          p_expire_le: string
          p_objet_id: string
          p_objet_type: Database["public"]["Enums"]["signature_objet"]
          p_org: string
        }
        Returns: string
      }
      devis_dossier: { Args: { p_devis: string }; Returns: string }
      devis_totaux: {
        Args: { d: Database["public"]["Tables"]["devis"]["Row"] }
        Returns: {
          acompte_pct: number | null
          conditions_paiement: string | null
          created_at: string
          created_by: string | null
          date_devis: string
          date_validite: string | null
          depasse_seuil: boolean
          devise: Database["public"]["Enums"]["devise"]
          dossier_id: string
          envoye_le: string | null
          envoye_par: string | null
          id: string
          marge: number
          motif_refus: string | null
          numero: string
          objet: string | null
          organization_id: string
          refuse_le: string | null
          signature_id: string | null
          signe_le: string | null
          soumis_le: string | null
          soumis_par: string | null
          statut: Database["public"]["Enums"]["devis_statut"]
          taux_cdf: number
          taxes: Json | null
          total_brut: number
          total_cout: number
          total_ht: number
          total_remise: number
          total_taxes: number
          total_ttc: number
          total_ttc_usd: number
          updated_at: string
          valide_le: string | null
          valide_par: string | null
          validite_jours: number
          version: number
          version_precedente_id: string | null
        }
        SetofOptions: {
          from: "devis"
          to: "devis"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      donnees_accueil: { Args: { p_org: string }; Returns: Json }
      dossier_perm: {
        Args: {
          p_dossier: string
          p_perm?: Database["public"]["Enums"]["app_permission"]
        }
        Returns: boolean
      }
      droits_dossier: { Args: { p_dossier: string }; Returns: Json }
      emettre_avoir: {
        Args: { p_facture: string; p_montant: number; p_motif: string }
        Returns: {
          code_authentification_def: string | null
          created_at: string
          created_by: string | null
          date_avoir: string
          dossier_id: string
          facture_id: string
          id: string
          montant_ttc: number
          motif: string
          numero: string
          numero_avoir_normalise: string | null
          organization_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "avoirs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      emettre_facture: {
        Args: { p_facture: string }
        Returns: {
          code_authentification_def: string | null
          created_at: string
          created_by: string | null
          date_emission: string | null
          delai_paiement_jours: number
          devis_id: string | null
          devise: Database["public"]["Enums"]["devise"]
          dossier_id: string
          echeance: string | null
          emise_le: string | null
          emise_par: string | null
          id: string
          montant_avoirs: number
          montant_paye: number
          normalisee_le: string | null
          normalisee_par: string | null
          numero: string | null
          numero_facture_normalisee: string | null
          objet: string | null
          organization_id: string
          periode_debut: string | null
          periode_fin: string | null
          qr_code: string | null
          remise_client_le: string | null
          remise_client_par: string | null
          solde_du: number | null
          statut: Database["public"]["Enums"]["facture_statut"]
          taux_cdf: number
          taxes: Json | null
          total_brut: number
          total_ht: number
          total_remise: number
          total_taxes: number
          total_ttc: number
          type: Database["public"]["Enums"]["facture_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "factures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enregistrer_relance: {
        Args: {
          p_destinataire: string
          p_dossier: string
          p_erreur?: string
          p_niveau: Database["public"]["Enums"]["relance_niveau"]
          p_objet_id: string
          p_objet_type: string
          p_org: string
          p_statut: string
        }
        Returns: string
      }
      envoyer_devis: { Args: { p_devis: string }; Returns: Json }
      facture_dossier: { Args: { p_facture: string }; Returns: string }
      facture_recalculer: {
        Args: { p_facture: string }
        Returns: {
          code_authentification_def: string | null
          created_at: string
          created_by: string | null
          date_emission: string | null
          delai_paiement_jours: number
          devis_id: string | null
          devise: Database["public"]["Enums"]["devise"]
          dossier_id: string
          echeance: string | null
          emise_le: string | null
          emise_par: string | null
          id: string
          montant_avoirs: number
          montant_paye: number
          normalisee_le: string | null
          normalisee_par: string | null
          numero: string | null
          numero_facture_normalisee: string | null
          objet: string | null
          organization_id: string
          periode_debut: string | null
          periode_fin: string | null
          qr_code: string | null
          remise_client_le: string | null
          remise_client_par: string | null
          solde_du: number | null
          statut: Database["public"]["Enums"]["facture_statut"]
          taux_cdf: number
          taxes: Json | null
          total_brut: number
          total_ht: number
          total_remise: number
          total_taxes: number
          total_ttc: number
          type: Database["public"]["Enums"]["facture_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "factures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      facture_statut_calcule: {
        Args: { f: Database["public"]["Tables"]["factures"]["Row"] }
        Returns: Database["public"]["Enums"]["facture_statut"]
      }
      facture_totaux: {
        Args: { f: Database["public"]["Tables"]["factures"]["Row"] }
        Returns: {
          code_authentification_def: string | null
          created_at: string
          created_by: string | null
          date_emission: string | null
          delai_paiement_jours: number
          devis_id: string | null
          devise: Database["public"]["Enums"]["devise"]
          dossier_id: string
          echeance: string | null
          emise_le: string | null
          emise_par: string | null
          id: string
          montant_avoirs: number
          montant_paye: number
          normalisee_le: string | null
          normalisee_par: string | null
          numero: string | null
          numero_facture_normalisee: string | null
          objet: string | null
          organization_id: string
          periode_debut: string | null
          periode_fin: string | null
          qr_code: string | null
          remise_client_le: string | null
          remise_client_par: string | null
          solde_du: number | null
          statut: Database["public"]["Enums"]["facture_statut"]
          taux_cdf: number
          taxes: Json | null
          total_brut: number
          total_ht: number
          total_remise: number
          total_taxes: number
          total_ttc: number
          type: Database["public"]["Enums"]["facture_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "factures"
          to: "factures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_dept_role: {
        Args: {
          p_dept: string
          p_org: string
          p_roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: boolean
      }
      has_permission: {
        Args: {
          p_org: string
          p_perm: Database["public"]["Enums"]["app_permission"]
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          p_org: string
          p_roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: boolean
      }
      initialiser_permissions: { Args: { p_org: string }; Returns: undefined }
      is_direction: { Args: { p_org: string }; Returns: boolean }
      is_finance: { Args: { p_org: string }; Returns: boolean }
      is_internal: { Args: { p_org: string }; Returns: boolean }
      lien_signature_info: { Args: { p_token: string }; Returns: Json }
      marquer_facture_remise: {
        Args: { p_facture: string }
        Returns: {
          code_authentification_def: string | null
          created_at: string
          created_by: string | null
          date_emission: string | null
          delai_paiement_jours: number
          devis_id: string | null
          devise: Database["public"]["Enums"]["devise"]
          dossier_id: string
          echeance: string | null
          emise_le: string | null
          emise_par: string | null
          id: string
          montant_avoirs: number
          montant_paye: number
          normalisee_le: string | null
          normalisee_par: string | null
          numero: string | null
          numero_facture_normalisee: string | null
          objet: string | null
          organization_id: string
          periode_debut: string | null
          periode_fin: string | null
          qr_code: string | null
          remise_client_le: string | null
          remise_client_par: string | null
          solde_du: number | null
          statut: Database["public"]["Enums"]["facture_statut"]
          taux_cdf: number
          taxes: Json | null
          total_brut: number
          total_ht: number
          total_remise: number
          total_taxes: number
          total_ttc: number
          type: Database["public"]["Enums"]["facture_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "factures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mes_permissions: {
        Args: { p_org: string }
        Returns: Database["public"]["Enums"]["app_permission"][]
      }
      normaliser_facture: {
        Args: {
          p_code_def: string
          p_facture: string
          p_numero_normalise: string
          p_qr_code?: string
        }
        Returns: {
          code_authentification_def: string | null
          created_at: string
          created_by: string | null
          date_emission: string | null
          delai_paiement_jours: number
          devis_id: string | null
          devise: Database["public"]["Enums"]["devise"]
          dossier_id: string
          echeance: string | null
          emise_le: string | null
          emise_par: string | null
          id: string
          montant_avoirs: number
          montant_paye: number
          normalisee_le: string | null
          normalisee_par: string | null
          numero: string | null
          numero_facture_normalisee: string | null
          objet: string | null
          organization_id: string
          periode_debut: string | null
          periode_fin: string | null
          qr_code: string | null
          remise_client_le: string | null
          remise_client_par: string | null
          solde_du: number | null
          statut: Database["public"]["Enums"]["facture_statut"]
          taux_cdf: number
          taxes: Json | null
          total_brut: number
          total_ht: number
          total_remise: number
          total_taxes: number
          total_ttc: number
          type: Database["public"]["Enums"]["facture_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "factures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      nouvelle_version_devis: { Args: { p_devis: string }; Returns: string }
      peut_sur: {
        Args: {
          p_dept: string
          p_org: string
          p_perm: Database["public"]["Enums"]["app_permission"]
          p_responsable: string
        }
        Returns: boolean
      }
      prochain_numero: {
        Args: { p_date?: string; p_org: string; p_type: string }
        Returns: string
      }
      pv_points_confirmes: {
        Args: { p: Database["public"]["Tables"]["pv_lancement"]["Row"] }
        Returns: boolean
      }
      rapport_indicateurs: { Args: { p_org: string }; Returns: Json }
      refuser_devis: {
        Args: { p_devis: string; p_motif: string }
        Returns: {
          acompte_pct: number | null
          conditions_paiement: string | null
          created_at: string
          created_by: string | null
          date_devis: string
          date_validite: string | null
          depasse_seuil: boolean
          devise: Database["public"]["Enums"]["devise"]
          dossier_id: string
          envoye_le: string | null
          envoye_par: string | null
          id: string
          marge: number
          motif_refus: string | null
          numero: string
          objet: string | null
          organization_id: string
          refuse_le: string | null
          signature_id: string | null
          signe_le: string | null
          soumis_le: string | null
          soumis_par: string | null
          statut: Database["public"]["Enums"]["devis_statut"]
          taux_cdf: number
          taxes: Json | null
          total_brut: number
          total_cout: number
          total_ht: number
          total_remise: number
          total_taxes: number
          total_ttc: number
          total_ttc_usd: number
          updated_at: string
          valide_le: string | null
          valide_par: string | null
          validite_jours: number
          version: number
          version_precedente_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "devis"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      regenerer_lien_devis: { Args: { p_devis: string }; Returns: string }
      relances_a_envoyer: { Args: never; Returns: Json }
      role_a: {
        Args: {
          p_org: string
          p_perm: Database["public"]["Enums"]["app_permission"]
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      signer_par_lien: {
        Args: {
          p_image: string
          p_ip: unknown
          p_nom: string
          p_token: string
          p_user_agent: string
        }
        Returns: Json
      }
      signer_pv: {
        Args: { p_image: string; p_nom: string; p_partie: string; p_pv: string }
        Returns: {
          acces_site_confirme: boolean
          acompte_confirme: boolean
          created_at: string
          created_by: string | null
          date_lancement: string
          devis_id: string | null
          dossier_id: string
          id: string
          interlocuteurs_confirmes: boolean
          lieu: string | null
          livrables_confirmes: boolean
          observations: string | null
          organization_id: string
          perimetre_confirme: boolean
          planning_confirme: boolean
          signature_atlas_id: string | null
          signature_client_id: string | null
          signe_le: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pv_lancement"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      soumettre_devis: { Args: { p_devis: string }; Returns: number }
      storage_client_acces: {
        Args: { p_ecriture: boolean; p_name: string }
        Returns: boolean
      }
      storage_dossier_acces: {
        Args: { p_ecriture: boolean; p_name: string }
        Returns: boolean
      }
      taches_quotidiennes: { Args: never; Returns: Json }
      user_org_ids: { Args: never; Returns: string[] }
      valider_devis: {
        Args: { p_devis: string }
        Returns: {
          acompte_pct: number | null
          conditions_paiement: string | null
          created_at: string
          created_by: string | null
          date_devis: string
          date_validite: string | null
          depasse_seuil: boolean
          devise: Database["public"]["Enums"]["devise"]
          dossier_id: string
          envoye_le: string | null
          envoye_par: string | null
          id: string
          marge: number
          motif_refus: string | null
          numero: string
          objet: string | null
          organization_id: string
          refuse_le: string | null
          signature_id: string | null
          signe_le: string | null
          soumis_le: string | null
          soumis_par: string | null
          statut: Database["public"]["Enums"]["devis_statut"]
          taux_cdf: number
          taxes: Json | null
          total_brut: number
          total_cout: number
          total_ht: number
          total_remise: number
          total_taxes: number
          total_ttc: number
          total_ttc_usd: number
          updated_at: string
          valide_le: string | null
          valide_par: string | null
          validite_jours: number
          version: number
          version_precedente_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "devis"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      valider_verification: {
        Args: { p_verification_id: string }
        Returns: {
          accuse_reception_envoye: boolean
          annee: number
          besoin: string
          budget_devise: Database["public"]["Enums"]["devise"]
          budget_indicatif: number | null
          canal: Database["public"]["Enums"]["canal_reception"]
          client_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          date_reception: string
          delai_souhaite: string | null
          department_id: string
          id: string
          numero: string
          organization_id: string
          pieces_autres: string | null
          pieces_recues: Database["public"]["Enums"]["piece_type"][]
          responsable_id: string | null
          service: string
          statut: Database["public"]["Enums"]["dossier_statut"]
          statut_change_le: string | null
          statut_motif: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "dossiers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verification_erreurs: {
        Args: { v: Database["public"]["Tables"]["verifications"]["Row"] }
        Returns: string[]
      }
    }
    Enums: {
      mission_type: "terrain" | "interne"
      mission_statut: "planifiee" | "en_cours" | "terminee" | "annulee"
      incident_gravite: "faible" | "moyenne" | "elevee"
      incident_statut: "ouvert" | "en_traitement" | "clos"
      app_permission:
        | "dossiers.read_all"
        | "dossiers.read_dept"
        | "dossiers.read_own"
        | "dossiers.read_assigned"
        | "dossiers.create"
        | "dossiers.verify"
        | "dossiers.decide"
        | "clients.read"
        | "clients.write"
        | "devis.read"
        | "devis.write"
        | "devis.validate"
        | "devis.send"
        | "factures.read"
        | "factures.write"
        | "paiements.write"
        | "normalisation.write"
        | "marges.read"
        | "services.manage"
        | "admin.users"
        | "admin.settings"
        | "audit.read"
        | "reports.read"
        | "missions.read_assigned"
        | "missions.report"
        | "execution.write"
        | "reception.write"
        | "achats.read"
        | "achats.write"
        | "achats.validate"
        | "fournisseurs.manage"
      app_role:
        | "admin_systeme"
        | "gerant"
        | "associe"
        | "directeur_commercial"
        | "directeur_operations"
        | "daf"
        | "responsable_departement"
        | "responsable_dossier"
        | "acheteur"
        | "responsable_rh"
        | "agent_terrain"
        | "client"
      canal_reception: "visite" | "appel" | "whatsapp" | "email" | "site_web"
      client_type: "entreprise" | "particulier"
      contrat_statut: "brouillon" | "signe" | "resilie"
      dept_code: "AFF" | "SUP" | "PEF" | "DIG"
      devis_statut:
        | "brouillon"
        | "valide"
        | "envoye"
        | "signe"
        | "refuse"
        | "expire"
        | "remplace"
      devise: "USD" | "CDF"
      document_type:
        | "pv_reception"
        | "rapport_intervention"
        | "rccm"
        | "id_nat"
        | "nif"
        | "piece_identite"
        | "accuse_reception"
        | "fiche_ouverture"
        | "fiche_verification"
        | "autre"
        | "devis"
        | "facture"
        | "contrat"
        | "pv_lancement"
        | "recu"
      dossier_statut:
        | "nouveau"
        | "en_verification"
        | "complement_requis"
        | "accepte"
        | "devis_envoye"
        | "en_lancement"
        | "en_cours"
        | "livre"
        | "reserves"
        | "receptionne_a_facturer"
        | "cloture"
        | "refuse"
        | "classe_sans_suite"
      facture_statut:
        | "brouillon"
        | "emise"
        | "normalisee"
        | "partiellement_payee"
        | "payee"
        | "en_retard"
        | "annulee"
      facture_type: "acompte" | "solde" | "mensuelle"
      paiement_mode:
        | "banque"
        | "mpesa"
        | "airtel_money"
        | "orange_money"
        | "especes"
      piece_type: "rccm" | "id_nat" | "nif" | "piece_identite" | "autre"
      relance_niveau: "j7" | "j15" | "j30"
      signature_objet: "devis" | "pv_lancement" | "pv_reception" | "rapport_intervention"
      unite_service: "forfait" | "jour" | "mois" | "m2" | "course"
      verification_decision: "accepte" | "complement_requis" | "refuse"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      mission_type: ["terrain", "interne"],
      mission_statut: ["planifiee", "en_cours", "terminee", "annulee"],
      incident_gravite: ["faible", "moyenne", "elevee"],
      incident_statut: ["ouvert", "en_traitement", "clos"],
      app_permission: [
        "dossiers.read_all",
        "dossiers.read_dept",
        "dossiers.read_own",
        "dossiers.read_assigned",
        "dossiers.create",
        "dossiers.verify",
        "dossiers.decide",
        "clients.read",
        "clients.write",
        "devis.read",
        "devis.write",
        "devis.validate",
        "devis.send",
        "factures.read",
        "factures.write",
        "paiements.write",
        "normalisation.write",
        "marges.read",
        "services.manage",
        "admin.users",
        "admin.settings",
        "audit.read",
        "reports.read",
        "missions.read_assigned",
        "missions.report",
        "execution.write",
        "reception.write",
        "achats.read",
        "achats.write",
        "achats.validate",
        "fournisseurs.manage",
      ],
      app_role: [
        "admin_systeme",
        "gerant",
        "associe",
        "directeur_commercial",
        "directeur_operations",
        "daf",
        "responsable_departement",
        "responsable_dossier",
        "acheteur",
        "responsable_rh",
        "agent_terrain",
        "client",
      ],
      canal_reception: ["visite", "appel", "whatsapp", "email", "site_web"],
      client_type: ["entreprise", "particulier"],
      contrat_statut: ["brouillon", "signe", "resilie"],
      dept_code: ["AFF", "SUP", "PEF", "DIG"],
      devis_statut: [
        "brouillon",
        "valide",
        "envoye",
        "signe",
        "refuse",
        "expire",
        "remplace",
      ],
      devise: ["USD", "CDF"],
      document_type: [
        "pv_reception",
        "rapport_intervention",
        "rccm",
        "id_nat",
        "nif",
        "piece_identite",
        "accuse_reception",
        "fiche_ouverture",
        "fiche_verification",
        "autre",
        "devis",
        "facture",
        "contrat",
        "pv_lancement",
        "recu",
      ],
      dossier_statut: [
        "nouveau",
        "en_verification",
        "complement_requis",
        "accepte",
        "devis_envoye",
        "en_lancement",
        "en_cours",
        "livre",
        "reserves",
        "receptionne_a_facturer",
        "cloture",
        "refuse",
        "classe_sans_suite",
      ],
      facture_statut: [
        "brouillon",
        "emise",
        "normalisee",
        "partiellement_payee",
        "payee",
        "en_retard",
        "annulee",
      ],
      facture_type: ["acompte", "solde", "mensuelle"],
      paiement_mode: [
        "banque",
        "mpesa",
        "airtel_money",
        "orange_money",
        "especes",
      ],
      piece_type: ["rccm", "id_nat", "nif", "piece_identite", "autre"],
      relance_niveau: ["j7", "j15", "j30"],
      signature_objet: ["devis", "pv_lancement", "pv_reception", "rapport_intervention"],
      unite_service: ["forfait", "jour", "mois", "m2", "course"],
      verification_decision: ["accepte", "complement_requis", "refuse"],
    },
  },
} as const
