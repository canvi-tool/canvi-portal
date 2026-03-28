export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string
          avatar_url: string | null
          locale: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name: string
          avatar_url?: string | null
          locale?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string
          avatar_url?: string | null
          locale?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          id: string
          resource: string
          action: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          resource: string
          action: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          resource?: string
          action?: string
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          role_id: string
          permission_id: string
          created_at: string
        }
        Insert: {
          role_id: string
          permission_id: string
          created_at?: string
        }
        Update: {
          role_id?: string
          permission_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'role_permissions_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'roles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'role_permissions_permission_id_fkey'
            columns: ['permission_id']
            isOneToOne: false
            referencedRelation: 'permissions'
            referencedColumns: ['id']
          },
        ]
      }
      user_roles: {
        Row: {
          user_id: string
          role_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          role_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          role_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_roles_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_roles_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'roles'
            referencedColumns: ['id']
          },
        ]
      }
      staff: {
        Row: {
          id: string
          user_id: string | null
          full_name: string
          full_name_kana: string | null
          email: string
          phone: string | null
          date_of_birth: string | null
          employment_type: string
          status: string
          join_date: string | null
          notes: string | null
          custom_fields: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          full_name: string
          full_name_kana?: string | null
          email: string
          phone?: string | null
          date_of_birth?: string | null
          employment_type: string
          status?: string
          join_date?: string | null
          notes?: string | null
          custom_fields?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          full_name?: string
          full_name_kana?: string | null
          email?: string
          phone?: string | null
          date_of_birth?: string | null
          employment_type?: string
          status?: string
          join_date?: string | null
          notes?: string | null
          custom_fields?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'staff_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      contract_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          content_template: string
          variables: Json | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          content_template: string
          variables?: Json | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          content_template?: string
          variables?: Json | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contract_templates_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      contracts: {
        Row: {
          id: string
          staff_id: string
          template_id: string | null
          title: string
          content: string | null
          status: string
          start_date: string
          end_date: string | null
          signed_at: string | null
          signed_document_url: string | null
          external_sign_id: string | null
          variables: Json | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          template_id?: string | null
          title: string
          content?: string | null
          status?: string
          start_date: string
          end_date?: string | null
          signed_at?: string | null
          signed_document_url?: string | null
          external_sign_id?: string | null
          variables?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          template_id?: string | null
          title?: string
          content?: string | null
          status?: string
          start_date?: string
          end_date?: string | null
          signed_at?: string | null
          signed_document_url?: string | null
          external_sign_id?: string | null
          variables?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contracts_staff_id_fkey'
            columns: ['staff_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contracts_template_id_fkey'
            columns: ['template_id']
            isOneToOne: false
            referencedRelation: 'contract_templates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contracts_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          status: string
          start_date: string | null
          end_date: string | null
          client_name: string | null
          metadata: Json | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          status?: string
          start_date?: string | null
          end_date?: string | null
          client_name?: string | null
          metadata?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          status?: string
          start_date?: string | null
          end_date?: string | null
          client_name?: string | null
          metadata?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'projects_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      project_assignments: {
        Row: {
          id: string
          project_id: string
          staff_id: string
          role: string | null
          status: string
          start_date: string
          end_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          staff_id: string
          role?: string | null
          status?: string
          start_date: string
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          staff_id?: string
          role?: string | null
          status?: string
          start_date?: string
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_assignments_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_assignments_staff_id_fkey'
            columns: ['staff_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
        ]
      }
      compensation_rules: {
        Row: {
          id: string
          assignment_id: string
          rule_type: string
          name: string
          params: Json
          priority: number
          is_active: boolean
          effective_from: string | null
          effective_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          assignment_id: string
          rule_type: string
          name: string
          params: Json
          priority?: number
          is_active?: boolean
          effective_from?: string | null
          effective_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          assignment_id?: string
          rule_type?: string
          name?: string
          params?: Json
          priority?: number
          is_active?: boolean
          effective_from?: string | null
          effective_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'compensation_rules_assignment_id_fkey'
            columns: ['assignment_id']
            isOneToOne: false
            referencedRelation: 'project_assignments'
            referencedColumns: ['id']
          },
        ]
      }
      shifts: {
        Row: {
          id: string
          staff_id: string
          project_id: string | null
          date: string
          start_time: string | null
          end_time: string | null
          break_minutes: number
          shift_type: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          project_id?: string | null
          date: string
          start_time?: string | null
          end_time?: string | null
          break_minutes?: number
          shift_type?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          project_id?: string | null
          date?: string
          start_time?: string | null
          end_time?: string | null
          break_minutes?: number
          shift_type?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shifts_staff_id_fkey'
            columns: ['staff_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shifts_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      work_reports: {
        Row: {
          id: string
          staff_id: string
          project_id: string | null
          year_month: string
          total_hours: number
          overtime_hours: number
          working_days: number
          standby_hours: number
          standby_days: number
          status: string
          submitted_at: string | null
          approved_at: string | null
          approved_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          project_id?: string | null
          year_month: string
          total_hours?: number
          overtime_hours?: number
          working_days?: number
          standby_hours?: number
          standby_days?: number
          status?: string
          submitted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          project_id?: string | null
          year_month?: string
          total_hours?: number
          overtime_hours?: number
          working_days?: number
          standby_hours?: number
          standby_days?: number
          status?: string
          submitted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'work_reports_staff_id_fkey'
            columns: ['staff_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'work_reports_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'work_reports_approved_by_fkey'
            columns: ['approved_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      performance_reports: {
        Row: {
          id: string
          staff_id: string
          project_id: string | null
          year_month: string
          call_count: number
          appointment_count: number
          other_counts: Json | null
          status: string
          submitted_at: string | null
          approved_at: string | null
          approved_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          project_id?: string | null
          year_month: string
          call_count?: number
          appointment_count?: number
          other_counts?: Json | null
          status?: string
          submitted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          project_id?: string | null
          year_month?: string
          call_count?: number
          appointment_count?: number
          other_counts?: Json | null
          status?: string
          submitted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'performance_reports_staff_id_fkey'
            columns: ['staff_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'performance_reports_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'performance_reports_approved_by_fkey'
            columns: ['approved_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      payment_calculations: {
        Row: {
          id: string
          staff_id: string
          year_month: string
          total_amount: number
          status: string
          calculated_at: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          issued_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          year_month: string
          total_amount?: number
          status?: string
          calculated_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          issued_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          year_month?: string
          total_amount?: number
          status?: string
          calculated_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          issued_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payment_calculations_staff_id_fkey'
            columns: ['staff_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payment_calculations_confirmed_by_fkey'
            columns: ['confirmed_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      payment_calculation_lines: {
        Row: {
          id: string
          payment_calculation_id: string
          compensation_rule_id: string | null
          rule_name: string
          rule_type: string
          amount: number
          input_data: Json | null
          detail: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          payment_calculation_id: string
          compensation_rule_id?: string | null
          rule_name: string
          rule_type: string
          amount: number
          input_data?: Json | null
          detail?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          payment_calculation_id?: string
          compensation_rule_id?: string | null
          rule_name?: string
          rule_type?: string
          amount?: number
          input_data?: Json | null
          detail?: string | null
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payment_calculation_lines_payment_calculation_id_fkey'
            columns: ['payment_calculation_id']
            isOneToOne: false
            referencedRelation: 'payment_calculations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payment_calculation_lines_compensation_rule_id_fkey'
            columns: ['compensation_rule_id']
            isOneToOne: false
            referencedRelation: 'compensation_rules'
            referencedColumns: ['id']
          },
        ]
      }
      notification_history: {
        Row: {
          id: string
          staff_id: string | null
          type: string
          subject: string
          body: string | null
          delivery_method: string
          delivery_status: string
          sent_at: string | null
          error_message: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          staff_id?: string | null
          type: string
          subject: string
          body?: string | null
          delivery_method?: string
          delivery_status?: string
          sent_at?: string | null
          error_message?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          staff_id?: string | null
          type?: string
          subject?: string
          body?: string | null
          delivery_method?: string
          delivery_status?: string
          sent_at?: string | null
          error_message?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notification_history_staff_id_fkey'
            columns: ['staff_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
        ]
      }
      retirement_records: {
        Row: {
          id: string
          staff_id: string
          retirement_date: string
          reason: string | null
          documents_sent: boolean
          documents_signed: boolean
          external_sign_id: string | null
          signed_document_url: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          retirement_date: string
          reason?: string | null
          documents_sent?: boolean
          documents_signed?: boolean
          external_sign_id?: string | null
          signed_document_url?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          retirement_date?: string
          reason?: string | null
          documents_sent?: boolean
          documents_signed?: boolean
          external_sign_id?: string | null
          signed_document_url?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'retirement_records_staff_id_fkey'
            columns: ['staff_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'retirement_records_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      alerts: {
        Row: {
          id: string
          type: string
          severity: string
          title: string
          description: string | null
          related_staff_id: string | null
          related_entity_type: string | null
          related_entity_id: string | null
          is_resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          type: string
          severity?: string
          title: string
          description?: string | null
          related_staff_id?: string | null
          related_entity_type?: string | null
          related_entity_id?: string | null
          is_resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          type?: string
          severity?: string
          title?: string
          description?: string | null
          related_staff_id?: string | null
          related_entity_type?: string | null
          related_entity_id?: string | null
          is_resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'alerts_related_staff_id_fkey'
            columns: ['related_staff_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'alerts_resolved_by_fkey'
            columns: ['resolved_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          resource: string
          resource_id: string | null
          old_data: Json | null
          new_data: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          resource: string
          resource_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          resource?: string
          resource_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_logs_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          id: string
          entity_type: string
          field_name: string
          field_label: string
          field_type: string
          options: Json | null
          is_required: boolean
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          field_name: string
          field_label: string
          field_type: string
          options?: Json | null
          is_required?: boolean
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          entity_type?: string
          field_name?: string
          field_label?: string
          field_type?: string
          options?: Json | null
          is_required?: boolean
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_estimates: {
        Row: {
          id: string
          project_id: string
          estimate_number: string
          title: string
          client_name: string
          client_address: string | null
          client_contact_person: string | null
          client_email: string | null
          description: string | null
          items: Array<{
            name: string
            description?: string
            quantity: number
            unit: string
            unit_price: number
            amount: number
          }>
          subtotal: number
          tax_rate: number
          tax_amount: number
          total_amount: number
          valid_until: string | null
          notes: string | null
          status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          estimate_number: string
          title: string
          client_name: string
          client_address?: string | null
          client_contact_person?: string | null
          client_email?: string | null
          description?: string | null
          items?: Array<{
            name: string
            description?: string
            quantity: number
            unit: string
            unit_price: number
            amount: number
          }>
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          total_amount?: number
          valid_until?: string | null
          notes?: string | null
          status?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          estimate_number?: string
          title?: string
          client_name?: string
          client_address?: string | null
          client_contact_person?: string | null
          client_email?: string | null
          description?: string | null
          items?: Array<{
            name: string
            description?: string
            quantity: number
            unit: string
            unit_price: number
            amount: number
          }>
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          total_amount?: number
          valid_until?: string | null
          notes?: string | null
          status?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_estimates_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_estimates_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      project_contracts: {
        Row: {
          id: string
          project_id: string
          estimate_id: string | null
          contract_number: string
          title: string
          client_name: string
          client_address: string | null
          client_contact_person: string | null
          client_email: string | null
          content: string | null
          items: Array<{
            name: string
            description?: string
            quantity: number
            unit: string
            unit_price: number
            amount: number
          }>
          subtotal: number
          tax_rate: number
          tax_amount: number
          total_amount: number
          start_date: string | null
          end_date: string | null
          payment_terms: string | null
          notes: string | null
          status: 'draft' | 'pending_signature' | 'signed' | 'active' | 'expired' | 'terminated'
          external_sign_id: string | null
          signed_at: string | null
          signed_document_url: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          estimate_id?: string | null
          contract_number: string
          title: string
          client_name: string
          client_address?: string | null
          client_contact_person?: string | null
          client_email?: string | null
          content?: string | null
          items?: Array<{
            name: string
            description?: string
            quantity: number
            unit: string
            unit_price: number
            amount: number
          }>
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          total_amount?: number
          start_date?: string | null
          end_date?: string | null
          payment_terms?: string | null
          notes?: string | null
          status?: 'draft' | 'pending_signature' | 'signed' | 'active' | 'expired' | 'terminated'
          external_sign_id?: string | null
          signed_at?: string | null
          signed_document_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          estimate_id?: string | null
          contract_number?: string
          title?: string
          client_name?: string
          client_address?: string | null
          client_contact_person?: string | null
          client_email?: string | null
          content?: string | null
          items?: Array<{
            name: string
            description?: string
            quantity: number
            unit: string
            unit_price: number
            amount: number
          }>
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          total_amount?: number
          start_date?: string | null
          end_date?: string | null
          payment_terms?: string | null
          notes?: string | null
          status?: 'draft' | 'pending_signature' | 'signed' | 'active' | 'expired' | 'terminated'
          external_sign_id?: string | null
          signed_at?: string | null
          signed_document_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_contracts_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_contracts_estimate_id_fkey'
            columns: ['estimate_id']
            isOneToOne: false
            referencedRelation: 'project_estimates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_contracts_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      project_invoices: {
        Row: {
          id: string
          project_id: string
          contract_id: string | null
          invoice_number: string
          title: string
          client_name: string
          client_address: string | null
          client_contact_person: string | null
          client_email: string | null
          description: string | null
          items: Array<{
            name: string
            description?: string
            quantity: number
            unit: string
            unit_price: number
            amount: number
          }>
          subtotal: number
          tax_rate: number
          tax_amount: number
          total_amount: number
          issue_date: string
          due_date: string | null
          payment_method: string | null
          bank_info: string | null
          notes: string | null
          status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
          sent_at: string | null
          paid_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          contract_id?: string | null
          invoice_number: string
          title: string
          client_name: string
          client_address?: string | null
          client_contact_person?: string | null
          client_email?: string | null
          description?: string | null
          items?: Array<{
            name: string
            description?: string
            quantity: number
            unit: string
            unit_price: number
            amount: number
          }>
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          total_amount?: number
          issue_date?: string
          due_date?: string | null
          payment_method?: string | null
          bank_info?: string | null
          notes?: string | null
          status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
          sent_at?: string | null
          paid_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          contract_id?: string | null
          invoice_number?: string
          title?: string
          client_name?: string
          client_address?: string | null
          client_contact_person?: string | null
          client_email?: string | null
          description?: string | null
          items?: Array<{
            name: string
            description?: string
            quantity: number
            unit: string
            unit_price: number
            amount: number
          }>
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          total_amount?: number
          issue_date?: string
          due_date?: string | null
          payment_method?: string | null
          bank_info?: string | null
          notes?: string | null
          status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
          sent_at?: string | null
          paid_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_invoices_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_invoices_contract_id_fkey'
            columns: ['contract_id']
            isOneToOne: false
            referencedRelation: 'project_contracts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_invoices_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
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
      employment_type: 'employee' | 'contractor' | 'freelancer'
      staff_status:
        | 'pre_contract'
        | 'contract_sent'
        | 'pending_signature'
        | 'active'
        | 'on_leave'
        | 'retired'
      contract_status:
        | 'draft'
        | 'pending_signature'
        | 'signed'
        | 'active'
        | 'expired'
        | 'terminated'
      project_status: 'planning' | 'active' | 'paused' | 'completed' | 'archived'
      assignment_status: 'pending' | 'active' | 'suspended' | 'ended'
      compensation_rule_type:
        | 'time_rate'
        | 'count_rate'
        | 'standby_rate'
        | 'monthly_fixed'
        | 'fixed_plus_variable'
        | 'percentage'
        | 'adjustment'
      report_status: 'draft' | 'submitted' | 'approved' | 'rejected'
      payment_status:
        | 'draft'
        | 'aggregated'
        | 'needs_review'
        | 'confirmed'
        | 'issued'
      notification_type:
        | 'payment_notification'
        | 'contract_reminder'
        | 'alert'
        | 'retirement_document'
      notification_delivery_status: 'pending' | 'sent' | 'failed' | 'resent'
      alert_type:
        | 'unreported_work'
        | 'shift_discrepancy'
        | 'unsigned_contract'
        | 'failed_notification'
        | 'unsigned_retirement_doc'
        | 'anomaly_detected'
      alert_severity: 'info' | 'warning' | 'critical'
      field_type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea'
      estimate_status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
      project_contract_status:
        | 'draft'
        | 'pending_signature'
        | 'signed'
        | 'active'
        | 'expired'
        | 'terminated'
      invoice_status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for easier usage
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]
