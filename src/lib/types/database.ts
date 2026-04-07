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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      alert_definitions: {
        Row: {
          action_url_template: string | null
          category: string
          created_at: string
          default_severity: string
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          action_url_template?: string | null
          category: string
          created_at?: string
          default_severity: string
          id: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          action_url_template?: string | null
          category?: string
          created_at?: string
          default_severity?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      alert_subscriptions: {
        Row: {
          alert_id: string
          channel_dashboard: boolean
          channel_email: boolean
          channel_slack: boolean
          enabled: boolean
          id: string
          role: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alert_id: string
          channel_dashboard?: boolean
          channel_email?: boolean
          channel_slack?: boolean
          enabled?: boolean
          id?: string
          role: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alert_id?: string
          channel_dashboard?: boolean
          channel_email?: boolean
          channel_slack?: boolean
          enabled?: boolean
          id?: string
          role?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_subscriptions_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alert_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_subscriptions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          action_url: string | null
          auto_resolve_at: string | null
          category: Database["public"]["Enums"]["alert_category"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          dismissed_at: string | null
          dismissed_by: string | null
          due_date: string | null
          id: string
          is_recurring: boolean | null
          message: string
          metadata: Json | null
          recurrence_key: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          resource_id: string | null
          resource_type: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          status: Database["public"]["Enums"]["alert_status"]
          target_staff_id: string | null
          target_user_id: string | null
          title: string
          triggered_at: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action_url?: string | null
          auto_resolve_at?: string | null
          category: Database["public"]["Enums"]["alert_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          due_date?: string | null
          id?: string
          is_recurring?: boolean | null
          message: string
          metadata?: Json | null
          recurrence_key?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          target_staff_id?: string | null
          target_user_id?: string | null
          title: string
          triggered_at?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action_url?: string | null
          auto_resolve_at?: string | null
          category?: Database["public"]["Enums"]["alert_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          due_date?: string | null
          id?: string
          is_recurring?: boolean | null
          message?: string
          metadata?: Json | null
          recurrence_key?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          target_staff_id?: string | null
          target_user_id?: string | null
          title?: string
          triggered_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_dismissed_by_fkey"
            columns: ["dismissed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_target_staff_id_fkey"
            columns: ["target_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_correction_requests: {
        Row: {
          attendance_record_id: string
          created_at: string
          id: string
          original_break_minutes: number | null
          original_clock_in: string | null
          original_clock_out: string | null
          original_note: string | null
          project_id: string | null
          reason: string
          requested_break_minutes: number | null
          requested_by_user_id: string
          requested_clock_in: string | null
          requested_clock_out: string | null
          requested_note: string | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          slack_thread_ts: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attendance_record_id: string
          created_at?: string
          id?: string
          original_break_minutes?: number | null
          original_clock_in?: string | null
          original_clock_out?: string | null
          original_note?: string | null
          project_id?: string | null
          reason: string
          requested_break_minutes?: number | null
          requested_by_user_id: string
          requested_clock_in?: string | null
          requested_clock_out?: string | null
          requested_note?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          slack_thread_ts?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attendance_record_id?: string
          created_at?: string
          id?: string
          original_break_minutes?: number | null
          original_clock_in?: string | null
          original_clock_out?: string | null
          original_note?: string | null
          project_id?: string | null
          reason?: string
          requested_break_minutes?: number | null
          requested_by_user_id?: string
          requested_clock_in?: string | null
          requested_clock_out?: string | null
          requested_note?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          slack_thread_ts?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_correction_requests_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_correction_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_correction_requests_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_correction_requests_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          break_end: string | null
          break_minutes: number | null
          break_start: string | null
          clock_in: string | null
          clock_in_rounded: string | null
          clock_out: string | null
          clock_out_rounded: string | null
          created_at: string
          date: string
          deleted_at: string | null
          id: string
          location_type: string | null
          modification_reason: string | null
          modified_by: string | null
          note: string | null
          overtime_minutes: number | null
          project_id: string | null
          rounding_applied: boolean
          slack_diff_channel_id: string | null
          slack_diff_thread_ts: string | null
          staff_id: string | null
          status: string
          updated_at: string
          user_id: string
          work_minutes: number | null
        }
        Insert: {
          break_end?: string | null
          break_minutes?: number | null
          break_start?: string | null
          clock_in?: string | null
          clock_in_rounded?: string | null
          clock_out?: string | null
          clock_out_rounded?: string | null
          created_at?: string
          date: string
          deleted_at?: string | null
          id?: string
          location_type?: string | null
          modification_reason?: string | null
          modified_by?: string | null
          note?: string | null
          overtime_minutes?: number | null
          project_id?: string | null
          rounding_applied?: boolean
          slack_diff_channel_id?: string | null
          slack_diff_thread_ts?: string | null
          staff_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          work_minutes?: number | null
        }
        Update: {
          break_end?: string | null
          break_minutes?: number | null
          break_start?: string | null
          clock_in?: string | null
          clock_in_rounded?: string | null
          clock_out?: string | null
          clock_out_rounded?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          id?: string
          location_type?: string | null
          modification_reason?: string | null
          modified_by?: string | null
          note?: string | null
          overtime_minutes?: number | null
          project_id?: string | null
          rounding_applied?: boolean
          slack_diff_channel_id?: string | null
          slack_diff_thread_ts?: string | null
          staff_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          work_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_fields: string[] | null
          created_at: string
          description: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          request_id: string | null
          resource_id: string | null
          resource_label: string | null
          resource_type: string
          session_id: string | null
          user_agent: string | null
          user_display_name: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_fields?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_label?: string | null
          resource_type: string
          session_id?: string | null
          user_agent?: string | null
          user_display_name?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          changed_fields?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_label?: string | null
          resource_type?: string
          session_id?: string | null
          user_agent?: string | null
          user_display_name?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_invitees: {
        Row: {
          created_at: string
          event_id: string
          id: string
          responded_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          responded_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          responded_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_invitees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_invitees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          color: string | null
          created_at: string
          created_by_user_id: string
          deleted_at: string | null
          description: string | null
          end_at: string
          id: string
          location: string | null
          project_id: string | null
          start_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          created_by_user_id: string
          deleted_at?: string | null
          description?: string | null
          end_at: string
          id?: string
          location?: string | null
          project_id?: string | null
          start_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          created_by_user_id?: string
          deleted_at?: string | null
          description?: string | null
          end_at?: string
          id?: string
          location?: string | null
          project_id?: string | null
          start_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          client_code: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          custom_fields: Json | null
          deleted_at: string | null
          id: string
          industry: string | null
          name: string
          name_kana: string | null
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          client_code: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          custom_fields?: Json | null
          deleted_at?: string | null
          id?: string
          industry?: string | null
          name: string
          name_kana?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          client_code?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          custom_fields?: Json | null
          deleted_at?: string | null
          id?: string
          industry?: string | null
          name?: string
          name_kana?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      compensation_rules: {
        Row: {
          assignment_id: string | null
          base_amount: number
          compensation_type: Database["public"]["Enums"]["compensation_type"]
          conditions: Json | null
          created_at: string
          created_by: string | null
          currency: string | null
          deleted_at: string | null
          effective_from: string
          effective_until: string | null
          holiday_multiplier: number | null
          id: string
          name: string
          night_multiplier: number | null
          overtime_multiplier: number | null
          overtime_threshold_hours: number | null
          priority: number
          project_id: string | null
          staff_id: string | null
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          base_amount: number
          compensation_type: Database["public"]["Enums"]["compensation_type"]
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          effective_from: string
          effective_until?: string | null
          holiday_multiplier?: number | null
          id?: string
          name: string
          night_multiplier?: number | null
          overtime_multiplier?: number | null
          overtime_threshold_hours?: number | null
          priority?: number
          project_id?: string | null
          staff_id?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          base_amount?: number
          compensation_type?: Database["public"]["Enums"]["compensation_type"]
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_until?: string | null
          holiday_multiplier?: number | null
          id?: string
          name?: string
          night_multiplier?: number | null
          overtime_multiplier?: number | null
          overtime_threshold_hours?: number | null
          priority?: number
          project_id?: string | null
          staff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compensation_rules_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "project_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compensation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compensation_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compensation_rules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          content_html: string
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          updated_at: string
          updated_by: string | null
          variables: Json | null
          version: number
        }
        Insert: {
          content_html: string
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json | null
          version?: number
        }
        Update: {
          content_html?: string
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          auto_renew: boolean
          compensation_details: Json | null
          content_html: string
          content_snapshot: Json | null
          contract_number: string
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          deleted_at: string | null
          end_date: string | null
          id: string
          notes: string | null
          sent_at: string | null
          signature_data: string | null
          signed_at: string | null
          signer_ip: string | null
          staff_id: string
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          template_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
          viewed_at: string | null
        }
        Insert: {
          auto_renew?: boolean
          compensation_details?: Json | null
          content_html: string
          content_snapshot?: Json | null
          contract_number: string
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          sent_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          staff_id: string
          start_date: string
          status?: Database["public"]["Enums"]["contract_status"]
          template_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          viewed_at?: string | null
        }
        Update: {
          auto_renew?: boolean
          compensation_details?: Json | null
          content_html?: string
          content_snapshot?: Json | null
          contract_number?: string
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          sent_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          staff_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          template_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          created_at: string
          created_by: string | null
          default_value: string | null
          deleted_at: string | null
          description: string | null
          display_width: string | null
          entity_type: string
          field_key: string
          field_label: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id: string
          is_filterable: boolean
          is_required: boolean
          is_searchable: boolean
          is_visible: boolean
          options: Json | null
          sort_order: number
          updated_at: string
          updated_by: string | null
          validation_rules: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_value?: string | null
          deleted_at?: string | null
          description?: string | null
          display_width?: string | null
          entity_type: string
          field_key: string
          field_label: string
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_filterable?: boolean
          is_required?: boolean
          is_searchable?: boolean
          is_visible?: boolean
          options?: Json | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          validation_rules?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_value?: string | null
          deleted_at?: string | null
          description?: string | null
          display_width?: string | null
          entity_type?: string
          field_key?: string
          field_label?: string
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_filterable?: boolean
          is_required?: boolean
          is_searchable?: boolean
          is_visible?: boolean
          options?: Json | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_definitions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gcal_pending_events: {
        Row: {
          created_at: string
          description: string | null
          end_time: string
          event_date: string
          excluded: boolean
          excluded_at: string | null
          external_calendar_id: string
          external_event_id: string
          external_updated_at: string | null
          id: string
          staff_id: string
          start_time: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time: string
          event_date: string
          excluded?: boolean
          excluded_at?: string | null
          external_calendar_id?: string
          external_event_id: string
          external_updated_at?: string | null
          id?: string
          staff_id: string
          start_time: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string
          event_date?: string
          excluded?: boolean
          excluded_at?: string | null
          external_calendar_id?: string
          external_event_id?: string
          external_updated_at?: string | null
          id?: string
          staff_id?: string
          start_time?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gcal_pending_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          billing_rule_id: string | null
          created_at: string
          description: string
          id: string
          invoice_id: string
          is_taxable: boolean
          quantity: number
          rule_type: Database["public"]["Enums"]["billing_rule_type"] | null
          sort_order: number
          tax_rate: number
          unit: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          billing_rule_id?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          is_taxable?: boolean
          quantity?: number
          rule_type?: Database["public"]["Enums"]["billing_rule_type"] | null
          sort_order?: number
          tax_rate?: number
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_rule_id?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          is_taxable?: boolean
          quantity?: number
          rule_type?: Database["public"]["Enums"]["billing_rule_type"] | null
          sort_order?: number
          tax_rate?: number
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_billing_rule_id_fkey"
            columns: ["billing_rule_id"]
            isOneToOne: false
            referencedRelation: "project_billing_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          bank_transfer_ref: string | null
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          method: string | null
          notes: string | null
          paid_at: string
          reference: string | null
        }
        Insert: {
          amount: number
          bank_transfer_ref?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          method?: string | null
          notes?: string | null
          paid_at: string
          reference?: string | null
        }
        Update: {
          amount?: number
          bank_transfer_ref?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_account_type: string | null
          bank_branch: string | null
          bank_name: string | null
          calculation_snapshot: Json
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          discount_amount: number
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          issued_at: string | null
          notes: string | null
          paid_amount: number
          paid_at: string | null
          pdf_generated_at: string | null
          pdf_url: string | null
          period_end: string
          period_start: string
          project_id: string
          sent_at: string | null
          sent_to_email: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          calculation_snapshot?: Json
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          discount_amount?: number
          due_date: string
          id?: string
          invoice_number: string
          issue_date: string
          issued_at?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          period_end: string
          period_start: string
          project_id: string
          sent_at?: string | null
          sent_to_email?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          calculation_snapshot?: Json
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          discount_amount?: number
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          issued_at?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          project_id?: string
          sent_at?: string | null
          sent_to_email?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_grants: {
        Row: {
          created_at: string
          created_by: string | null
          expiry_date: string
          grant_date: string
          grant_type: string | null
          id: string
          note: string | null
          remaining_days: number | null
          staff_id: string
          total_days: number
          used_days: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expiry_date: string
          grant_date: string
          grant_type?: string | null
          id?: string
          note?: string | null
          remaining_days?: number | null
          staff_id: string
          total_days: number
          used_days?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expiry_date?: string
          grant_date?: string
          grant_type?: string | null
          id?: string
          note?: string | null
          remaining_days?: number | null
          staff_id?: string
          total_days?: number
          used_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_grants_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approval_comment: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days: number
          end_date: string
          hours: number | null
          id: string
          leave_grant_id: string | null
          leave_type: string
          reason: string | null
          staff_id: string
          start_date: string
          status: string | null
          updated_at: string
        }
        Insert: {
          approval_comment?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days: number
          end_date: string
          hours?: number | null
          id?: string
          leave_grant_id?: string | null
          leave_type: string
          reason?: string | null
          staff_id: string
          start_date: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          approval_comment?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days?: number
          end_date?: string
          hours?: number | null
          id?: string
          leave_grant_id?: string | null
          leave_type?: string
          reason?: string | null
          staff_id?: string
          start_date?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_leave_grant_id_fkey"
            columns: ["leave_grant_id"]
            isOneToOne: false
            referencedRelation: "leave_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_history: {
        Row: {
          body_html: string | null
          body_text: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          created_by: string | null
          delivered_at: string | null
          external_message_id: string | null
          external_response: Json | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          max_retries: number | null
          metadata: Json | null
          next_retry_at: string | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          read_at: string | null
          recipient_email: string | null
          recipient_phone: string | null
          recipient_staff_id: string | null
          recipient_user_id: string | null
          resource_id: string | null
          resource_type: string | null
          retry_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          subject: string | null
          template_id: string | null
          template_variables: Json | null
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          external_message_id?: string | null
          external_response?: Json | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          max_retries?: number | null
          metadata?: Json | null
          next_retry_at?: string | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          read_at?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          recipient_staff_id?: string | null
          recipient_user_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string | null
          template_id?: string | null
          template_variables?: Json | null
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          external_message_id?: string | null
          external_response?: Json | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          max_retries?: number | null
          metadata?: Json | null
          next_retry_at?: string | null
          notification_type?: Database["public"]["Enums"]["notification_type"]
          read_at?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          recipient_staff_id?: string | null
          recipient_user_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string | null
          template_id?: string | null
          template_variables?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_history_recipient_staff_id_fkey"
            columns: ["recipient_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_history_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_calculation_lines: {
        Row: {
          amount: number
          compensation_rule_id: string | null
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          is_taxable: boolean | null
          line_type: Database["public"]["Enums"]["payment_line_type"]
          payment_calculation_id: string
          project_id: string | null
          quantity: number | null
          shift_id: string | null
          sort_order: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          compensation_rule_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description: string
          id?: string
          is_taxable?: boolean | null
          line_type: Database["public"]["Enums"]["payment_line_type"]
          payment_calculation_id: string
          project_id?: string | null
          quantity?: number | null
          shift_id?: string | null
          sort_order?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          compensation_rule_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          is_taxable?: boolean | null
          line_type?: Database["public"]["Enums"]["payment_line_type"]
          payment_calculation_id?: string
          project_id?: string | null
          quantity?: number | null
          shift_id?: string | null
          sort_order?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_calculation_lines_compensation_rule_id_fkey"
            columns: ["compensation_rule_id"]
            isOneToOne: false
            referencedRelation: "compensation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_calculation_lines_payment_calculation_id_fkey"
            columns: ["payment_calculation_id"]
            isOneToOne: false
            referencedRelation: "payment_calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_calculation_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_calculation_lines_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_calculations: {
        Row: {
          allowance_amount: number
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          bank_transfer_ref: string | null
          calculated_at: string | null
          calculation_details: Json | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          custom_fields: Json | null
          days_worked: number | null
          deductions_amount: number
          deleted_at: string | null
          gross_amount: number
          holiday_hours: number | null
          id: string
          issued_at: string | null
          issued_by: string | null
          net_amount: number
          night_hours: number | null
          notes: string | null
          notice_pdf_generated_at: string | null
          notice_pdf_url: string | null
          notice_status: string | null
          overtime_hours: number | null
          paid_at: string | null
          payment_date: string | null
          payment_number: string
          period_end: string
          period_start: string
          sent_at: string | null
          sent_to_email: string | null
          staff_id: string
          status: Database["public"]["Enums"]["payment_calc_status"]
          total_hours: number | null
          transportation_amount: number
          updated_at: string
          updated_by: string | null
          withholding_tax_amount: number
        }
        Insert: {
          allowance_amount?: number
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bank_transfer_ref?: string | null
          calculated_at?: string | null
          calculation_details?: Json | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          custom_fields?: Json | null
          days_worked?: number | null
          deductions_amount?: number
          deleted_at?: string | null
          gross_amount?: number
          holiday_hours?: number | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          net_amount?: number
          night_hours?: number | null
          notes?: string | null
          notice_pdf_generated_at?: string | null
          notice_pdf_url?: string | null
          notice_status?: string | null
          overtime_hours?: number | null
          paid_at?: string | null
          payment_date?: string | null
          payment_number: string
          period_end: string
          period_start: string
          sent_at?: string | null
          sent_to_email?: string | null
          staff_id: string
          status?: Database["public"]["Enums"]["payment_calc_status"]
          total_hours?: number | null
          transportation_amount?: number
          updated_at?: string
          updated_by?: string | null
          withholding_tax_amount?: number
        }
        Update: {
          allowance_amount?: number
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bank_transfer_ref?: string | null
          calculated_at?: string | null
          calculation_details?: Json | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          custom_fields?: Json | null
          days_worked?: number | null
          deductions_amount?: number
          deleted_at?: string | null
          gross_amount?: number
          holiday_hours?: number | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          net_amount?: number
          night_hours?: number | null
          notes?: string | null
          notice_pdf_generated_at?: string | null
          notice_pdf_url?: string | null
          notice_status?: string | null
          overtime_hours?: number | null
          paid_at?: string | null
          payment_date?: string | null
          payment_number?: string
          period_end?: string
          period_start?: string
          sent_at?: string | null
          sent_to_email?: string | null
          staff_id?: string
          status?: Database["public"]["Enums"]["payment_calc_status"]
          total_hours?: number | null
          transportation_amount?: number
          updated_at?: string
          updated_by?: string | null
          withholding_tax_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_calculations_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_calculations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_calculations_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_calculations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_calculations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          period_end: string
          period_start: string
          period_type: Database["public"]["Enums"]["report_period_type"]
          project_id: string | null
          staff_id: string
          status: Database["public"]["Enums"]["report_status"]
          summary: Json | null
          total_actual_hours: number | null
          total_days_absent: number | null
          total_days_early_leave: number | null
          total_days_late: number | null
          total_days_worked: number | null
          total_holiday_hours: number | null
          total_night_hours: number | null
          total_overtime_hours: number | null
          total_scheduled_hours: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          period_type?: Database["public"]["Enums"]["report_period_type"]
          project_id?: string | null
          staff_id: string
          status?: Database["public"]["Enums"]["report_status"]
          summary?: Json | null
          total_actual_hours?: number | null
          total_days_absent?: number | null
          total_days_early_leave?: number | null
          total_days_late?: number | null
          total_days_worked?: number | null
          total_holiday_hours?: number | null
          total_night_hours?: number | null
          total_overtime_hours?: number | null
          total_scheduled_hours?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          period_type?: Database["public"]["Enums"]["report_period_type"]
          project_id?: string | null
          staff_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          summary?: Json | null
          total_actual_hours?: number | null
          total_days_absent?: number | null
          total_days_early_leave?: number | null
          total_days_late?: number | null
          total_days_worked?: number | null
          total_holiday_hours?: number | null
          total_night_hours?: number | null
          total_overtime_hours?: number | null
          total_scheduled_hours?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reports_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reports_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          id: string
          resource: string
          scope: string
        }
        Insert: {
          action: string
          id?: string
          resource: string
          scope?: string
        }
        Update: {
          action?: string
          id?: string
          resource?: string
          scope?: string
        }
        Relationships: []
      }
      profile_change_requests: {
        Row: {
          attachment_urls: string[]
          changes: Json
          created_at: string
          id: string
          requested_by: string
          requires_address_doc: boolean
          requires_bank_holder_doc: boolean
          requires_identity_doc: boolean
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          staff_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attachment_urls?: string[]
          changes?: Json
          created_at?: string
          id?: string
          requested_by: string
          requires_address_doc?: boolean
          requires_bank_holder_doc?: boolean
          requires_identity_doc?: boolean
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attachment_urls?: string[]
          changes?: Json
          created_at?: string
          id?: string
          requested_by?: string
          requires_address_doc?: boolean
          requires_bank_holder_doc?: boolean
          requires_identity_doc?: boolean
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_change_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      project_assignments: {
        Row: {
          break_minutes: number | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          deleted_at: string | null
          end_date: string | null
          id: string
          notes: string | null
          project_id: string
          role_title: string | null
          shift_end: string | null
          shift_start: string | null
          staff_id: string
          start_date: string
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          break_minutes?: number | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          project_id: string
          role_title?: string | null
          shift_end?: string | null
          shift_start?: string | null
          staff_id: string
          start_date: string
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          break_minutes?: number | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          role_title?: string | null
          shift_end?: string | null
          shift_start?: string | null
          staff_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_billing_rules: {
        Row: {
          closing_day: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_from: string
          effective_to: string | null
          fixed_amount: number | null
          id: string
          label: string
          max_amount: number | null
          min_amount: number | null
          notes: string | null
          payment_day: number | null
          project_id: string
          rate_percent: number | null
          rule_type: Database["public"]["Enums"]["billing_rule_type"]
          sort_order: number
          tax_rate: number
          unit_price: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          closing_day?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_to?: string | null
          fixed_amount?: number | null
          id?: string
          label: string
          max_amount?: number | null
          min_amount?: number | null
          notes?: string | null
          payment_day?: number | null
          project_id: string
          rate_percent?: number | null
          rule_type: Database["public"]["Enums"]["billing_rule_type"]
          sort_order?: number
          tax_rate?: number
          unit_price?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          closing_day?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_to?: string | null
          fixed_amount?: number | null
          id?: string
          label?: string
          max_amount?: number | null
          min_amount?: number | null
          notes?: string | null
          payment_day?: number | null
          project_id?: string
          rate_percent?: number | null
          rule_type?: Database["public"]["Enums"]["billing_rule_type"]
          sort_order?: number
          tax_rate?: number
          unit_price?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_billing_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_billing_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_billing_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_contracts: {
        Row: {
          client_address: string | null
          client_contact_person: string | null
          client_email: string | null
          client_name: string
          content: string | null
          contract_number: string
          created_at: string
          created_by: string | null
          end_date: string | null
          estimate_id: string | null
          external_sign_id: string | null
          id: string
          items: Json
          notes: string | null
          payment_terms: string | null
          project_id: string
          signed_at: string | null
          signed_document_url: string | null
          start_date: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          client_address?: string | null
          client_contact_person?: string | null
          client_email?: string | null
          client_name: string
          content?: string | null
          contract_number: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          estimate_id?: string | null
          external_sign_id?: string | null
          id?: string
          items?: Json
          notes?: string | null
          payment_terms?: string | null
          project_id: string
          signed_at?: string | null
          signed_document_url?: string | null
          start_date?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          client_address?: string | null
          client_contact_person?: string | null
          client_email?: string | null
          client_name?: string
          content?: string | null
          contract_number?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          estimate_id?: string | null
          external_sign_id?: string | null
          id?: string
          items?: Json
          notes?: string | null
          payment_terms?: string | null
          project_id?: string
          signed_at?: string | null
          signed_document_url?: string | null
          start_date?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contracts_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "project_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_estimates: {
        Row: {
          client_address: string | null
          client_contact_person: string | null
          client_email: string | null
          client_name: string
          created_at: string
          created_by: string | null
          description: string | null
          estimate_number: string
          id: string
          items: Json
          notes: string | null
          project_id: string
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          title: string
          total_amount: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          client_address?: string | null
          client_contact_person?: string | null
          client_email?: string | null
          client_name: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimate_number: string
          id?: string
          items?: Json
          notes?: string | null
          project_id: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          client_address?: string | null
          client_contact_person?: string | null
          client_email?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimate_number?: string
          id?: string
          items?: Json
          notes?: string | null
          project_id?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_estimates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invoices: {
        Row: {
          bank_info: string | null
          client_address: string | null
          client_contact_person: string | null
          client_email: string | null
          client_name: string
          contract_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          items: Json
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          project_id: string
          sent_at: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          bank_info?: string | null
          client_address?: string | null
          client_contact_person?: string | null
          client_email?: string | null
          client_name: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          items?: Json
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          project_id: string
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          bank_info?: string | null
          client_address?: string | null
          client_contact_person?: string | null
          client_email?: string | null
          client_name?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          items?: Json
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          project_id?: string
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "project_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_member_compensations: {
        Row: {
          bonus_rules: Json | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          project_id: string
          rate_amount: number
          rate_type: Database["public"]["Enums"]["compensation_type"]
          staff_id: string
          unit_label: string | null
          updated_at: string
        }
        Insert: {
          bonus_rules?: Json | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          project_id: string
          rate_amount?: number
          rate_type: Database["public"]["Enums"]["compensation_type"]
          staff_id: string
          unit_label?: string | null
          updated_at?: string
        }
        Update: {
          bonus_rules?: Json | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          rate_amount?: number
          rate_type?: Database["public"]["Enums"]["compensation_type"]
          staff_id?: string
          unit_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_member_compensations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_member_compensations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_member_compensations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      project_notification_settings: {
        Row: {
          attendance_break_end: boolean
          attendance_break_start: boolean
          attendance_clock_in: boolean
          attendance_clock_out: boolean
          attendance_missing: boolean
          attendance_missing_delay_minutes: number
          attendance_missing_max_repeats: number
          attendance_missing_repeat_interval_minutes: number
          created_at: string
          id: string
          leave_requested: boolean
          member_assigned: boolean
          member_removed: boolean
          overtime_warning: boolean
          overtime_warning_threshold_hours: number
          project_id: string
          report_overdue: boolean
          report_overdue_delay_hours: number
          report_overdue_delay_minutes: number
          report_overdue_max_repeats: number
          report_overdue_repeat_interval_hours: number
          report_submitted: boolean
          shift_approved: boolean
          shift_rejected: boolean
          shift_submission_alert_repeat_interval_days: number
          shift_submission_alert_start_days_before: number
          shift_submission_deadline_day: number
          shift_submitted: boolean
          updated_at: string
        }
        Insert: {
          attendance_break_end?: boolean
          attendance_break_start?: boolean
          attendance_clock_in?: boolean
          attendance_clock_out?: boolean
          attendance_missing?: boolean
          attendance_missing_delay_minutes?: number
          attendance_missing_max_repeats?: number
          attendance_missing_repeat_interval_minutes?: number
          created_at?: string
          id?: string
          leave_requested?: boolean
          member_assigned?: boolean
          member_removed?: boolean
          overtime_warning?: boolean
          overtime_warning_threshold_hours?: number
          project_id: string
          report_overdue?: boolean
          report_overdue_delay_hours?: number
          report_overdue_delay_minutes?: number
          report_overdue_max_repeats?: number
          report_overdue_repeat_interval_hours?: number
          report_submitted?: boolean
          shift_approved?: boolean
          shift_rejected?: boolean
          shift_submission_alert_repeat_interval_days?: number
          shift_submission_alert_start_days_before?: number
          shift_submission_deadline_day?: number
          shift_submitted?: boolean
          updated_at?: string
        }
        Update: {
          attendance_break_end?: boolean
          attendance_break_start?: boolean
          attendance_clock_in?: boolean
          attendance_clock_out?: boolean
          attendance_missing?: boolean
          attendance_missing_delay_minutes?: number
          attendance_missing_max_repeats?: number
          attendance_missing_repeat_interval_minutes?: number
          created_at?: string
          id?: string
          leave_requested?: boolean
          member_assigned?: boolean
          member_removed?: boolean
          overtime_warning?: boolean
          overtime_warning_threshold_hours?: number
          project_id?: string
          report_overdue?: boolean
          report_overdue_delay_hours?: number
          report_overdue_delay_minutes?: number
          report_overdue_max_repeats?: number
          report_overdue_repeat_interval_hours?: number
          report_submitted?: boolean
          shift_approved?: boolean
          shift_rejected?: boolean
          shift_submission_alert_repeat_interval_days?: number
          shift_submission_alert_start_days_before?: number
          shift_submission_deadline_day?: number
          shift_submitted?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notification_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget_amount: number | null
          budget_currency: string | null
          client_contact: string | null
          client_id: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          default_break_minutes: number | null
          default_shift_end: string | null
          default_shift_start: string | null
          deleted_at: string | null
          description: string | null
          end_date: string | null
          id: string
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          location_radius: number | null
          name: string
          notes: string | null
          project_code: string
          project_number: string
          project_type: string
          requires_gps_checkin: boolean | null
          shift_approval_mode: string
          slack_channel_id: string | null
          slack_channel_name: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          tags: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          budget_amount?: number | null
          budget_currency?: string | null
          client_contact?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          default_break_minutes?: number | null
          default_shift_end?: string | null
          default_shift_start?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          location_radius?: number | null
          name: string
          notes?: string | null
          project_code: string
          project_number?: string
          project_type?: string
          requires_gps_checkin?: boolean | null
          shift_approval_mode?: string
          slack_channel_id?: string | null
          slack_channel_name?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          tags?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          budget_amount?: number | null
          budget_currency?: string | null
          client_contact?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          default_break_minutes?: number | null
          default_shift_end?: string | null
          default_shift_start?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          location_radius?: number | null
          name?: string
          notes?: string | null
          project_code?: string
          project_number?: string
          project_type?: string
          requires_gps_checkin?: boolean | null
          shift_approval_mode?: string
          slack_channel_id?: string | null
          slack_channel_name?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          tags?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      retirement_records: {
        Row: {
          checklist: Json | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          deleted_at: string | null
          documents_issued: Json | null
          effective_date: string
          final_payment_id: string | null
          forwarding_address: string | null
          forwarding_email: string | null
          forwarding_phone: string | null
          id: string
          last_working_date: string
          notes: string | null
          outstanding_amount: number | null
          paid_leave_buyout: number | null
          paid_leave_remaining: number | null
          processed_by: string | null
          reason: Database["public"]["Enums"]["retirement_reason"]
          reason_detail: string | null
          resignation_date: string | null
          severance_amount: number | null
          staff_id: string
          status: Database["public"]["Enums"]["retirement_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          checklist?: Json | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          documents_issued?: Json | null
          effective_date: string
          final_payment_id?: string | null
          forwarding_address?: string | null
          forwarding_email?: string | null
          forwarding_phone?: string | null
          id?: string
          last_working_date: string
          notes?: string | null
          outstanding_amount?: number | null
          paid_leave_buyout?: number | null
          paid_leave_remaining?: number | null
          processed_by?: string | null
          reason: Database["public"]["Enums"]["retirement_reason"]
          reason_detail?: string | null
          resignation_date?: string | null
          severance_amount?: number | null
          staff_id: string
          status?: Database["public"]["Enums"]["retirement_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          checklist?: Json | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          documents_issued?: Json | null
          effective_date?: string
          final_payment_id?: string | null
          forwarding_address?: string | null
          forwarding_email?: string | null
          forwarding_phone?: string | null
          id?: string
          last_working_date?: string
          notes?: string | null
          outstanding_amount?: number | null
          paid_leave_buyout?: number | null
          paid_leave_remaining?: number | null
          processed_by?: string | null
          reason?: Database["public"]["Enums"]["retirement_reason"]
          reason_detail?: string | null
          resignation_date?: string | null
          severance_amount?: number | null
          staff_id?: string
          status?: Database["public"]["Enums"]["retirement_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retirement_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retirement_records_final_payment_id_fkey"
            columns: ["final_payment_id"]
            isOneToOne: false
            referencedRelation: "payment_calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retirement_records_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retirement_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retirement_records_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      scheduling_bookings: {
        Row: {
          created_at: string
          google_calendar_event_id: string | null
          guest_company: string | null
          guest_email: string | null
          guest_name: string
          id: string
          link_id: string
          message: string | null
          selected_end: string
          selected_start: string
          status: string
        }
        Insert: {
          created_at?: string
          google_calendar_event_id?: string | null
          guest_company?: string | null
          guest_email?: string | null
          guest_name: string
          id?: string
          link_id: string
          message?: string | null
          selected_end: string
          selected_start: string
          status?: string
        }
        Update: {
          created_at?: string
          google_calendar_event_id?: string | null
          guest_company?: string | null
          guest_email?: string | null
          guest_name?: string
          id?: string
          link_id?: string
          message?: string | null
          selected_end?: string
          selected_start?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_bookings_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "scheduling_links"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduling_links: {
        Row: {
          created_at: string
          created_by: string
          date_range_end: string
          date_range_start: string
          duration_minutes: number
          expires_at: string | null
          id: string
          member_ids: string[]
          mode: string
          slug: string
          status: string
          time_range_end: string
          time_range_start: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          date_range_end: string
          date_range_start: string
          duration_minutes?: number
          expires_at?: string | null
          id?: string
          member_ids: string[]
          mode?: string
          slug: string
          status?: string
          time_range_end?: string
          time_range_start?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          date_range_end?: string
          date_range_start?: string
          duration_minutes?: number
          expires_at?: string | null
          id?: string
          member_ids?: string[]
          mode?: string
          slug?: string
          status?: string
          time_range_end?: string
          time_range_start?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      shift_approval_history: {
        Row: {
          action: string
          comment: string | null
          id: string
          new_end_time: string | null
          new_start_time: string | null
          performed_at: string
          performed_by: string
          previous_end_time: string | null
          previous_start_time: string | null
          shift_id: string
        }
        Insert: {
          action: string
          comment?: string | null
          id?: string
          new_end_time?: string | null
          new_start_time?: string | null
          performed_at?: string
          performed_by: string
          previous_end_time?: string | null
          previous_start_time?: string | null
          shift_id: string
        }
        Update: {
          action?: string
          comment?: string | null
          id?: string
          new_end_time?: string | null
          new_start_time?: string | null
          performed_at?: string
          performed_by?: string
          previous_end_time?: string | null
          previous_start_time?: string | null
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_approval_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_approval_history_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          approval_comment: string | null
          approved_at: string | null
          approved_by: string | null
          attendees: Json
          created_at: string
          created_by: string
          deleted_at: string | null
          end_time: string
          external_calendar_id: string | null
          external_event_id: string | null
          external_updated_at: string | null
          google_calendar_event_id: string | null
          google_calendar_synced: boolean | null
          google_meet_url: string | null
          id: string
          notes: string | null
          project_id: string
          rejected_at: string | null
          rejected_by: string | null
          shift_date: string
          shift_type: string
          slack_thread_ts: string | null
          source: string
          staff_id: string
          start_time: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          approval_comment?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attendees?: Json
          created_at?: string
          created_by: string
          deleted_at?: string | null
          end_time: string
          external_calendar_id?: string | null
          external_event_id?: string | null
          external_updated_at?: string | null
          google_calendar_event_id?: string | null
          google_calendar_synced?: boolean | null
          google_meet_url?: string | null
          id?: string
          notes?: string | null
          project_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          shift_date: string
          shift_type?: string
          slack_thread_ts?: string | null
          source?: string
          staff_id: string
          start_time: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          approval_comment?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attendees?: Json
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          end_time?: string
          external_calendar_id?: string | null
          external_event_id?: string | null
          external_updated_at?: string | null
          google_calendar_event_id?: string | null
          google_calendar_synced?: boolean | null
          google_meet_url?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          shift_date?: string
          shift_type?: string
          slack_thread_ts?: string | null
          source?: string
          staff_id?: string
          start_time?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_account_type: string | null
          bank_branch: string | null
          bank_name: string | null
          city: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          daily_rate: number | null
          date_of_birth: string | null
          deleted_at: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          first_name: string
          first_name_eiji: string | null
          first_name_kana: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          hire_date: string
          hourly_rate: number | null
          id: string
          last_name: string
          last_name_eiji: string | null
          last_name_kana: string | null
          monthly_salary: number | null
          notes: string | null
          personal_email: string | null
          phone: string | null
          postal_code: string | null
          prefecture: string | null
          qualifications: Json | null
          skills: Json | null
          staff_code: string
          status: Database["public"]["Enums"]["staff_status"]
          termination_date: string | null
          transportation_allowance: number | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          daily_rate?: number | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          first_name: string
          first_name_eiji?: string | null
          first_name_kana?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          hire_date: string
          hourly_rate?: number | null
          id?: string
          last_name: string
          last_name_eiji?: string | null
          last_name_kana?: string | null
          monthly_salary?: number | null
          notes?: string | null
          personal_email?: string | null
          phone?: string | null
          postal_code?: string | null
          prefecture?: string | null
          qualifications?: Json | null
          skills?: Json | null
          staff_code: string
          status?: Database["public"]["Enums"]["staff_status"]
          termination_date?: string | null
          transportation_allowance?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          daily_rate?: number | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          first_name?: string
          first_name_eiji?: string | null
          first_name_kana?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          hire_date?: string
          hourly_rate?: number | null
          id?: string
          last_name?: string
          last_name_eiji?: string | null
          last_name_kana?: string | null
          monthly_salary?: number | null
          notes?: string | null
          personal_email?: string | null
          phone?: string | null
          postal_code?: string | null
          prefecture?: string | null
          qualifications?: Json | null
          skills?: Json | null
          staff_code?: string
          status?: Database["public"]["Enums"]["staff_status"]
          termination_date?: string | null
          transportation_allowance?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_emergency_contacts: {
        Row: {
          contact_name: string | null
          contact_phone: string | null
          contact_relation: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          is_current: boolean
          staff_id: string
        }
        Insert: {
          contact_name?: string | null
          contact_phone?: string | null
          contact_relation?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_current?: boolean
          staff_id: string
        }
        Update: {
          contact_name?: string | null
          contact_phone?: string | null
          contact_relation?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_current?: boolean
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_emergency_contacts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_external_accounts: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string | null
          external_id: string | null
          id: string
          metadata: Json | null
          provider: string
          provisioned_at: string | null
          staff_id: string
          status: string
          suspended_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          provider: string
          provisioned_at?: string | null
          staff_id: string
          status?: string
          suspended_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          provisioned_at?: string | null
          staff_id?: string
          status?: string
          suspended_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_external_accounts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          base_daily_amount: number | null
          base_hourly_amount: number | null
          base_monthly_amount: number | null
          compensation_type:
            | Database["public"]["Enums"]["compensation_type"]
            | null
          created_at: string
          deleted_at: string | null
          display_name: string
          email: string
          google_access_token: string | null
          google_refresh_token: string | null
          google_token_expires_at: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          base_daily_amount?: number | null
          base_hourly_amount?: number | null
          base_monthly_amount?: number | null
          compensation_type?:
            | Database["public"]["Enums"]["compensation_type"]
            | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          email: string
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          base_daily_amount?: number | null
          base_hourly_amount?: number | null
          base_monthly_amount?: number | null
          compensation_type?:
            | Database["public"]["Enums"]["compensation_type"]
            | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          email?: string
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      work_reports: {
        Row: {
          achievements: Json | null
          approved_at: string | null
          approved_by: string | null
          attachments: Json | null
          content: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          deleted_at: string | null
          id: string
          issues: Json | null
          next_actions: Json | null
          project_id: string | null
          report_date: string
          report_type: string
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shift_id: string | null
          slack_thread_ts: string | null
          staff_id: string
          status: Database["public"]["Enums"]["report_status"]
          submitted_at: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          achievements?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          id?: string
          issues?: Json | null
          next_actions?: Json | null
          project_id?: string | null
          report_date: string
          report_type?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_id?: string | null
          slack_thread_ts?: string | null
          staff_id: string
          status?: Database["public"]["Enums"]["report_status"]
          submitted_at?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          achievements?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          id?: string
          issues?: Json | null
          next_actions?: Json | null
          project_id?: string | null
          report_date?: string
          report_type?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_id?: string | null
          slack_thread_ts?: string | null
          staff_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          submitted_at?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_reports_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_reports_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_reports_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      alert_category:
        | "contract_expiry"
        | "shift_anomaly"
        | "report_overdue"
        | "payment_pending"
        | "attendance_issue"
        | "assignment_gap"
        | "retirement_pending"
        | "system_error"
        | "compliance"
        | "custom"
      alert_severity: "info" | "warning" | "error" | "critical"
      alert_status:
        | "active"
        | "acknowledged"
        | "resolved"
        | "dismissed"
        | "expired"
      assignment_status:
        | "proposed"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "restore"
        | "login"
        | "logout"
        | "export"
        | "import"
        | "approve"
        | "reject"
        | "send"
        | "sign"
        | "calculate"
        | "confirm"
        | "assign"
        | "unassign"
      billing_rule_type:
        | "HOURLY"
        | "MONTHLY_FIXED"
        | "DAILY"
        | "PER_CALL"
        | "PER_APPOINTMENT"
        | "PER_CLOSING"
        | "REVENUE_SHARE"
        | "MANAGEMENT_FEE"
        | "DISCOUNT_FIXED"
        | "DISCOUNT_RATE"
      compensation_type: "hourly" | "daily" | "monthly" | "fixed" | "commission"
      contract_status:
        | "draft"
        | "pending_review"
        | "sent"
        | "viewed"
        | "signed"
        | "active"
        | "expired"
        | "terminated"
        | "rejected"
      contract_type: "employment" | "nda" | "service" | "amendment" | "other"
      custom_field_type:
        | "text"
        | "number"
        | "date"
        | "datetime"
        | "boolean"
        | "select"
        | "multiselect"
        | "url"
        | "email"
        | "phone"
        | "file"
        | "json"
      employment_type:
        | "full_time"
        | "part_time"
        | "contract"
        | "temporary"
        | "freelance"
        | "executive"
        | "other"
      gender_type: "male" | "female" | "other" | "prefer_not_to_say"
      invoice_status:
        | "draft"
        | "calculated"
        | "confirmed"
        | "sent"
        | "paid"
        | "cancelled"
      notification_channel: "email" | "sms" | "line" | "push" | "in_app"
      notification_status:
        | "pending"
        | "sending"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "cancelled"
      notification_type:
        | "contract_sent"
        | "contract_signed"
        | "shift_reminder"
        | "shift_change"
        | "report_submitted"
        | "report_approved"
        | "report_rejected"
        | "payment_confirmed"
        | "payment_issued"
        | "assignment_new"
        | "retirement_started"
        | "alert"
        | "system"
        | "custom"
      payment_calc_status:
        | "draft"
        | "calculated"
        | "reviewing"
        | "confirmed"
        | "issued"
        | "cancelled"
      payment_line_type:
        | "base_pay"
        | "overtime_pay"
        | "night_pay"
        | "holiday_pay"
        | "transportation"
        | "bonus"
        | "allowance"
        | "deduction"
        | "tax"
        | "insurance"
        | "adjustment"
        | "other"
      project_status:
        | "planning"
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
        | "paused"
        | "archived"
      report_period_type: "daily" | "weekly" | "biweekly" | "monthly"
      report_status:
        | "draft"
        | "submitted"
        | "reviewing"
        | "approved"
        | "rejected"
        | "revised"
      retirement_reason:
        | "voluntary"
        | "company"
        | "contract_end"
        | "mutual"
        | "retirement_age"
        | "other"
      retirement_status:
        | "initiated"
        | "documents_pending"
        | "in_progress"
        | "final_payment"
        | "completed"
        | "cancelled"
      staff_status: "active" | "on_leave" | "suspended" | "retired"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      alert_category: [
        "contract_expiry",
        "shift_anomaly",
        "report_overdue",
        "payment_pending",
        "attendance_issue",
        "assignment_gap",
        "retirement_pending",
        "system_error",
        "compliance",
        "custom",
      ],
      alert_severity: ["info", "warning", "error", "critical"],
      alert_status: [
        "active",
        "acknowledged",
        "resolved",
        "dismissed",
        "expired",
      ],
      assignment_status: [
        "proposed",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      audit_action: [
        "create",
        "update",
        "delete",
        "restore",
        "login",
        "logout",
        "export",
        "import",
        "approve",
        "reject",
        "send",
        "sign",
        "calculate",
        "confirm",
        "assign",
        "unassign",
      ],
      billing_rule_type: [
        "HOURLY",
        "MONTHLY_FIXED",
        "DAILY",
        "PER_CALL",
        "PER_APPOINTMENT",
        "PER_CLOSING",
        "REVENUE_SHARE",
        "MANAGEMENT_FEE",
        "DISCOUNT_FIXED",
        "DISCOUNT_RATE",
      ],
      compensation_type: ["hourly", "daily", "monthly", "fixed", "commission"],
      contract_status: [
        "draft",
        "pending_review",
        "sent",
        "viewed",
        "signed",
        "active",
        "expired",
        "terminated",
        "rejected",
      ],
      contract_type: ["employment", "nda", "service", "amendment", "other"],
      custom_field_type: [
        "text",
        "number",
        "date",
        "datetime",
        "boolean",
        "select",
        "multiselect",
        "url",
        "email",
        "phone",
        "file",
        "json",
      ],
      employment_type: [
        "full_time",
        "part_time",
        "contract",
        "temporary",
        "freelance",
        "executive",
        "other",
      ],
      gender_type: ["male", "female", "other", "prefer_not_to_say"],
      invoice_status: [
        "draft",
        "calculated",
        "confirmed",
        "sent",
        "paid",
        "cancelled",
      ],
      notification_channel: ["email", "sms", "line", "push", "in_app"],
      notification_status: [
        "pending",
        "sending",
        "sent",
        "delivered",
        "read",
        "failed",
        "cancelled",
      ],
      notification_type: [
        "contract_sent",
        "contract_signed",
        "shift_reminder",
        "shift_change",
        "report_submitted",
        "report_approved",
        "report_rejected",
        "payment_confirmed",
        "payment_issued",
        "assignment_new",
        "retirement_started",
        "alert",
        "system",
        "custom",
      ],
      payment_calc_status: [
        "draft",
        "calculated",
        "reviewing",
        "confirmed",
        "issued",
        "cancelled",
      ],
      payment_line_type: [
        "base_pay",
        "overtime_pay",
        "night_pay",
        "holiday_pay",
        "transportation",
        "bonus",
        "allowance",
        "deduction",
        "tax",
        "insurance",
        "adjustment",
        "other",
      ],
      project_status: [
        "planning",
        "active",
        "on_hold",
        "completed",
        "cancelled",
        "paused",
        "archived",
      ],
      report_period_type: ["daily", "weekly", "biweekly", "monthly"],
      report_status: [
        "draft",
        "submitted",
        "reviewing",
        "approved",
        "rejected",
        "revised",
      ],
      retirement_reason: [
        "voluntary",
        "company",
        "contract_end",
        "mutual",
        "retirement_age",
        "other",
      ],
      retirement_status: [
        "initiated",
        "documents_pending",
        "in_progress",
        "final_payment",
        "completed",
        "cancelled",
      ],
      staff_status: ["active", "on_leave", "suspended", "retired"],
    },
  },
} as const
