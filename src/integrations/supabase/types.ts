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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      achievement_definitions: {
        Row: {
          category: string
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          threshold: number
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          threshold: number
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          threshold?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          id: string
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          id?: string
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          id?: string
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      body_measurements: {
        Row: {
          body_fat_percentage: number | null
          chest: number | null
          created_at: string
          hip: number | null
          id: string
          member_id: string
          recorded_by: string
          recorded_date: string
          waist: number | null
        }
        Insert: {
          body_fat_percentage?: number | null
          chest?: number | null
          created_at?: string
          hip?: number | null
          id?: string
          member_id: string
          recorded_by: string
          recorded_date?: string
          waist?: number | null
        }
        Update: {
          body_fat_percentage?: number | null
          chest?: number | null
          created_at?: string
          hip?: number | null
          id?: string
          member_id?: string
          recorded_by?: string
          recorded_date?: string
          waist?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_measurements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "wellness_members"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string
          id: string
          industry: string | null
          name: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          industry?: string | null
          name: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          industry?: string | null
          name?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          position: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          position?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          position?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          close_date: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          owner_id: string
          pipeline_id: string
          probability: number | null
          stage_id: string
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          close_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          owner_id: string
          pipeline_id: string
          probability?: number | null
          stage_id: string
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          close_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          owner_id?: string
          pipeline_id?: string
          probability?: number | null
          stage_id?: string
          title?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          name: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      integration_credentials: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      member_achievements: {
        Row: {
          achievement_id: string
          created_at: string
          id: string
          member_id: string
          unlocked_at: string
        }
        Insert: {
          achievement_id: string
          created_at?: string
          id?: string
          member_id: string
          unlocked_at?: string
        }
        Update: {
          achievement_id?: string
          created_at?: string
          id?: string
          member_id?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievement_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_achievements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "wellness_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_categories: {
        Row: {
          active: boolean
          created_at: string
          direction: string
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          direction: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          direction?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      member_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          member_id: string
          note: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          member_id: string
          note: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          member_id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_notes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "wellness_members"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          read: boolean
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          pipeline_id: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          pipeline_id: string
          position?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          pipeline_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      serving_transactions: {
        Row: {
          attendance_id: string | null
          balance_after: number
          change: number
          created_at: string
          created_by: string
          id: string
          member_id: string
          membership_id: string
          note: string | null
          txn_type: Database["public"]["Enums"]["serving_txn_type"]
        }
        Insert: {
          attendance_id?: string | null
          balance_after: number
          change: number
          created_at?: string
          created_by: string
          id?: string
          member_id: string
          membership_id: string
          note?: string | null
          txn_type: Database["public"]["Enums"]["serving_txn_type"]
        }
        Update: {
          attendance_id?: string | null
          balance_after?: number
          change?: number
          created_at?: string
          created_by?: string
          id?: string
          member_id?: string
          membership_id?: string
          note?: string | null
          txn_type?: Database["public"]["Enums"]["serving_txn_type"]
        }
        Relationships: [
          {
            foreignKeyName: "serving_transactions_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "wellness_attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serving_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "wellness_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serving_transactions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "wellness_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed: boolean
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weight_tracking: {
        Row: {
          created_at: string
          id: string
          member_id: string
          notes: string | null
          recorded_by: string
          recorded_date: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          notes?: string | null
          recorded_by: string
          recorded_date?: string
          weight: number
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          notes?: string | null
          recorded_by?: string
          recorded_date?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_tracking_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "wellness_members"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_attendance: {
        Row: {
          checkin_method: Database["public"]["Enums"]["checkin_method"]
          created_at: string
          id: string
          member_id: string
          membership_id: string | null
          remaining_balance_snapshot: number | null
          serving_deducted: boolean
          staff_id: string | null
          trial_id: string | null
          visit_date: string
          visit_time: string
        }
        Insert: {
          checkin_method?: Database["public"]["Enums"]["checkin_method"]
          created_at?: string
          id?: string
          member_id: string
          membership_id?: string | null
          remaining_balance_snapshot?: number | null
          serving_deducted?: boolean
          staff_id?: string | null
          trial_id?: string | null
          visit_date?: string
          visit_time?: string
        }
        Update: {
          checkin_method?: Database["public"]["Enums"]["checkin_method"]
          created_at?: string
          id?: string
          member_id?: string
          membership_id?: string | null
          remaining_balance_snapshot?: number | null
          serving_deducted?: boolean
          staff_id?: string | null
          trial_id?: string | null
          visit_date?: string
          visit_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "wellness_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_attendance_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "wellness_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_attendance_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "wellness_trials"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_batches: {
        Row: {
          coach_staff_id: string | null
          created_at: string
          created_by: string
          end_date: string | null
          id: string
          max_capacity: number | null
          name: string
          program_type: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          coach_staff_id?: string | null
          created_at?: string
          created_by: string
          end_date?: string | null
          id?: string
          max_capacity?: number | null
          name: string
          program_type?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          coach_staff_id?: string | null
          created_at?: string
          created_by?: string
          end_date?: string | null
          id?: string
          max_capacity?: number | null
          name?: string
          program_type?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      wellness_centre_settings: {
        Row: {
          checkin_code: string
          code_rotated_at: string
          created_at: string
          id: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          checkin_code?: string
          code_rotated_at?: string
          created_at?: string
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          checkin_code?: string
          code_rotated_at?: string
          created_at?: string
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      wellness_checkin_requests: {
        Row: {
          attendance_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          member_id: string
          membership_id: string | null
          reject_reason: string | null
          request_date: string
          requested_at: string
          requested_weight: number | null
          status: string
          updated_at: string
        }
        Insert: {
          attendance_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          member_id: string
          membership_id?: string | null
          reject_reason?: string | null
          request_date?: string
          requested_at?: string
          requested_weight?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          attendance_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          member_id?: string
          membership_id?: string | null
          reject_reason?: string | null
          request_date?: string
          requested_at?: string
          requested_weight?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_checkin_requests_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "wellness_attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_checkin_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "wellness_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_checkin_requests_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "wellness_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_members: {
        Row: {
          activation_code: string
          activity_level: string | null
          anniversary_date: string | null
          batch_id: string | null
          category_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          current_weight: number | null
          date_of_birth: string | null
          email: string | null
          full_name: string
          gender: string | null
          goal: Database["public"]["Enums"]["wellness_goal"] | null
          height: number | null
          id: string
          initial_weight: number | null
          is_guest: boolean
          joining_date: string
          marital_status: string | null
          mobile_number: string
          referred_by_member_id: string | null
          status: Database["public"]["Enums"]["wellness_status"]
          target_weight: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activation_code?: string
          activity_level?: string | null
          anniversary_date?: string | null
          batch_id?: string | null
          category_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          current_weight?: number | null
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          goal?: Database["public"]["Enums"]["wellness_goal"] | null
          height?: number | null
          id?: string
          initial_weight?: number | null
          is_guest?: boolean
          joining_date?: string
          marital_status?: string | null
          mobile_number: string
          referred_by_member_id?: string | null
          status?: Database["public"]["Enums"]["wellness_status"]
          target_weight?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activation_code?: string
          activity_level?: string | null
          anniversary_date?: string | null
          batch_id?: string | null
          category_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          current_weight?: number | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          goal?: Database["public"]["Enums"]["wellness_goal"] | null
          height?: number | null
          id?: string
          initial_weight?: number | null
          is_guest?: boolean
          joining_date?: string
          marital_status?: string | null
          mobile_number?: string
          referred_by_member_id?: string | null
          status?: Database["public"]["Enums"]["wellness_status"]
          target_weight?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wellness_members_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "wellness_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_members_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "member_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_members_referred_by_member_id_fkey"
            columns: ["referred_by_member_id"]
            isOneToOne: false
            referencedRelation: "wellness_members"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_memberships: {
        Row: {
          created_at: string
          created_by: string
          end_date: string
          id: string
          member_id: string
          membership_code: string
          plan_id: string
          price_paid: number
          remaining_servings: number
          renewed_from: string | null
          start_date: string
          status: Database["public"]["Enums"]["membership_status"]
          total_servings: number
          updated_at: string
          used_servings: number
        }
        Insert: {
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          member_id: string
          membership_code: string
          plan_id: string
          price_paid?: number
          remaining_servings: number
          renewed_from?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["membership_status"]
          total_servings: number
          updated_at?: string
          used_servings?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          member_id?: string
          membership_code?: string
          plan_id?: string
          price_paid?: number
          remaining_servings?: number
          renewed_from?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["membership_status"]
          total_servings?: number
          updated_at?: string
          used_servings?: number
        }
        Relationships: [
          {
            foreignKeyName: "wellness_memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "wellness_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "wellness_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_memberships_renewed_from_fkey"
            columns: ["renewed_from"]
            isOneToOne: false
            referencedRelation: "wellness_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_notification_log: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          error_message: string | null
          id: string
          last_attempt_at: string | null
          member_id: string
          message: string | null
          sent_at: string | null
          status: string
          trigger_key: string
          whatsapp_message_id: string | null
        }
        Insert: {
          attempts?: number
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          member_id: string
          message?: string | null
          sent_at?: string | null
          status?: string
          trigger_key: string
          whatsapp_message_id?: string | null
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          member_id?: string
          message?: string | null
          sent_at?: string | null
          status?: string
          trigger_key?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wellness_notification_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "wellness_members"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_notification_templates: {
        Row: {
          active: boolean
          channel: string
          created_at: string
          created_by: string
          id: string
          message_template: string
          template_language: string | null
          template_name: string | null
          trigger_key: string
          updated_at: string
          variables: Json
        }
        Insert: {
          active?: boolean
          channel: string
          created_at?: string
          created_by: string
          id?: string
          message_template: string
          template_language?: string | null
          template_name?: string | null
          trigger_key: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          active?: boolean
          channel?: string
          created_at?: string
          created_by?: string
          id?: string
          message_template?: string
          template_language?: string | null
          template_name?: string | null
          trigger_key?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      wellness_plans: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          description: string | null
          duration_days: number
          id: string
          name: string
          plan_type: string
          price: number
          servings_per_day: number
          total_servings: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          duration_days?: number
          id?: string
          name: string
          plan_type?: string
          price?: number
          servings_per_day?: number
          total_servings?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          duration_days?: number
          id?: string
          name?: string
          plan_type?: string
          price?: number
          servings_per_day?: number
          total_servings?: number
          updated_at?: string
        }
        Relationships: []
      }
      wellness_trials: {
        Row: {
          created_at: string
          created_by: string
          duration_days: number
          end_date: string | null
          id: string
          member_id: string
          plan_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["trial_status"]
          updated_at: string
          weight_at_start: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_days?: number
          end_date?: string | null
          id?: string
          member_id: string
          plan_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["trial_status"]
          updated_at?: string
          weight_at_start?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_days?: number
          end_date?: string | null
          id?: string
          member_id?: string
          plan_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["trial_status"]
          updated_at?: string
          weight_at_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wellness_trials_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "wellness_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_trials_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "wellness_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_api_logs: {
        Row: {
          action: string
          created_at: string
          error: string | null
          function_name: string | null
          http_status: number | null
          id: string
          message_id: string | null
          ok: boolean
          phone: string | null
          provider_code: string | null
          provider_message_id: string | null
          request_summary: Json
        }
        Insert: {
          action: string
          created_at?: string
          error?: string | null
          function_name?: string | null
          http_status?: number | null
          id?: string
          message_id?: string | null
          ok?: boolean
          phone?: string | null
          provider_code?: string | null
          provider_message_id?: string | null
          request_summary?: Json
        }
        Update: {
          action?: string
          created_at?: string
          error?: string | null
          function_name?: string | null
          http_status?: number | null
          id?: string
          message_id?: string | null
          ok?: boolean
          phone?: string | null
          provider_code?: string | null
          provider_message_id?: string | null
          request_summary?: Json
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          last_direction: string | null
          last_message_at: string | null
          last_message_preview: string | null
          member_id: string | null
          phone: string
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          last_direction?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          member_id?: string | null
          phone: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          last_direction?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          member_id?: string | null
          phone?: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "wellness_members"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          conversation_id: string | null
          created_at: string
          delivered_at: string | null
          direction: string
          error_message: string | null
          id: string
          is_bot: boolean
          member_id: string | null
          message_content: string | null
          message_type: string
          phone: string | null
          provider_message_id: string | null
          read_at: string | null
          retry_of_message_id: string | null
          sent_by: string | null
          source_module: string
          status: string
          template_name: string | null
          updated_at: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction: string
          error_message?: string | null
          id?: string
          is_bot?: boolean
          member_id?: string | null
          message_content?: string | null
          message_type?: string
          phone?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          retry_of_message_id?: string | null
          sent_by?: string | null
          source_module?: string
          status?: string
          template_name?: string | null
          updated_at?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          id?: string
          is_bot?: boolean
          member_id?: string | null
          message_content?: string | null
          message_type?: string
          phone?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          retry_of_message_id?: string | null
          sent_by?: string | null
          source_module?: string
          status?: string
          template_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "wellness_members"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_logs: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          id: string
          payload: Json | null
          phone: string | null
          processed_at: string | null
          processing_status: string
          provider_message_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          phone?: string | null
          processed_at?: string | null
          processing_status?: string
          provider_message_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          phone?: string | null
          processed_at?: string | null
          processing_status?: string
          provider_message_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_next_membership: {
        Args: { p_member_id: string }
        Returns: string
      }
      adjust_servings: {
        Args: { p_change: number; p_membership_id: string; p_note?: string }
        Returns: number
      }
      approve_checkin_request: {
        Args: { p_request_id: string; p_weight?: number }
        Returns: Json
      }
      checkin_member: {
        Args: {
          p_member_id: string
          p_method?: Database["public"]["Enums"]["checkin_method"]
        }
        Returns: Json
      }
      claim_member_account: {
        Args: { p_code: string; p_mobile: string }
        Returns: Json
      }
      convert_trial_to_membership: {
        Args: { p_plan_id: string; p_price?: number; p_trial_id: string }
        Returns: string
      }
      create_membership: {
        Args: { p_member_id: string; p_plan_id: string; p_price?: number }
        Returns: string
      }
      delete_wellness_plan: { Args: { p_plan_id: string }; Returns: Json }
      expire_stale_checkin_requests: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_member: {
        Args: { _target_user_id: string; _user_id: string }
        Returns: boolean
      }
      is_wellness_manager: { Args: { _user_id: string }; Returns: boolean }
      is_wellness_staff: { Args: { _user_id: string }; Returns: boolean }
      mark_notification_sent: {
        Args: { p_error?: string; p_log_id: string; p_status?: string }
        Returns: undefined
      }
      member_self_checkin: {
        Args: { p_code: string; p_weight?: number }
        Returns: Json
      }
      owns_wellness_member: {
        Args: { _member_id: string; _user_id: string }
        Returns: boolean
      }
      recalc_all_member_achievements: { Args: never; Returns: undefined }
      recalc_member_achievements: {
        Args: { p_member_id: string }
        Returns: undefined
      }
      refresh_wellness_statuses: { Args: never; Returns: undefined }
      reject_checkin_request: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: Json
      }
      renew_membership: {
        Args: { p_membership_id: string; p_plan_id?: string; p_price?: number }
        Returns: string
      }
      renew_membership_v2: {
        Args: {
          p_membership_id: string
          p_mode?: string
          p_note?: string
          p_plan_id: string
          p_price?: number
          p_servings?: number
        }
        Returns: string
      }
      rotate_checkin_code: { Args: never; Returns: string }
      seed_default_pipeline: { Args: { p_user_id: string }; Returns: string }
      switch_membership_plan: {
        Args: {
          p_carry_servings?: boolean
          p_membership_id: string
          p_new_plan_id: string
          p_price?: number
        }
        Returns: string
      }
      wellness_plan_usage: {
        Args: never
        Returns: {
          plan_id: string
          usage_count: number
        }[]
      }
    }
    Enums: {
      activity_type: "call" | "email" | "meeting" | "note"
      app_role: "admin" | "manager" | "rep"
      checkin_method:
        | "qr_scan"
        | "barcode_scan"
        | "admin_manual"
        | "staff_entry"
      membership_status:
        | "active"
        | "expiring_soon"
        | "expired"
        | "cancelled"
        | "queued"
      serving_txn_type:
        | "membership_allocation"
        | "daily_deduction"
        | "manual_adjustment"
        | "renewal_allocation"
        | "refund_adjustment"
      trial_status:
        | "active"
        | "completed"
        | "expired"
        | "converted"
        | "cancelled"
      wellness_goal:
        | "weight_loss"
        | "fat_loss"
        | "weight_management"
        | "weight_gain"
        | "general_wellness"
        | "healthy_lifestyle"
        | "body_transformation"
      wellness_status:
        | "lead"
        | "trial"
        | "active_member"
        | "renewal_due"
        | "expired"
        | "inactive"
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
      activity_type: ["call", "email", "meeting", "note"],
      app_role: ["admin", "manager", "rep"],
      checkin_method: [
        "qr_scan",
        "barcode_scan",
        "admin_manual",
        "staff_entry",
      ],
      membership_status: [
        "active",
        "expiring_soon",
        "expired",
        "cancelled",
        "queued",
      ],
      serving_txn_type: [
        "membership_allocation",
        "daily_deduction",
        "manual_adjustment",
        "renewal_allocation",
        "refund_adjustment",
      ],
      trial_status: [
        "active",
        "completed",
        "expired",
        "converted",
        "cancelled",
      ],
      wellness_goal: [
        "weight_loss",
        "fat_loss",
        "weight_management",
        "weight_gain",
        "general_wellness",
        "healthy_lifestyle",
        "body_transformation",
      ],
      wellness_status: [
        "lead",
        "trial",
        "active_member",
        "renewal_due",
        "expired",
        "inactive",
      ],
    },
  },
} as const
