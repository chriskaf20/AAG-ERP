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
      can_edit_dossier: { Args: { p_dossier: string }; Returns: boolean }
      can_see_client: { Args: { p_client: string }; Returns: boolean }
      can_see_dossier: { Args: { p_dossier: string }; Returns: boolean }
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
      has_dept_role: {
        Args: {
          p_dept: string
          p_org: string
          p_roles: Database["public"]["Enums"]["app_role"][]
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
      is_direction: { Args: { p_org: string }; Returns: boolean }
      is_internal: { Args: { p_org: string }; Returns: boolean }
      storage_client_acces: {
        Args: { p_ecriture: boolean; p_name: string }
        Returns: boolean
      }
      storage_dossier_acces: {
        Args: { p_ecriture: boolean; p_name: string }
        Returns: boolean
      }
      user_org_ids: { Args: never; Returns: string[] }
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
      dept_code: "AFF" | "SUP" | "PEF" | "DIG"
      devise: "USD" | "CDF"
      document_type:
        | "rccm"
        | "id_nat"
        | "nif"
        | "piece_identite"
        | "accuse_reception"
        | "fiche_ouverture"
        | "fiche_verification"
        | "autre"
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
      piece_type: "rccm" | "id_nat" | "nif" | "piece_identite" | "autre"
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
      dept_code: ["AFF", "SUP", "PEF", "DIG"],
      devise: ["USD", "CDF"],
      document_type: [
        "rccm",
        "id_nat",
        "nif",
        "piece_identite",
        "accuse_reception",
        "fiche_ouverture",
        "fiche_verification",
        "autre",
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
      piece_type: ["rccm", "id_nat", "nif", "piece_identite", "autre"],
      verification_decision: ["accepte", "complement_requis", "refuse"],
    },
  },
} as const
