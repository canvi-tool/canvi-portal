'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { workReportFormSchema, type WorkReportFormValues } from '@/lib/validations/report'
import type { Tables } from '@/lib/types/database'
import type {
  TimeRateParams,
  CountRateParams,
  StandbyRateParams,
} from '@/lib/types/compensation'

interface DynamicReportFormProps {
  staffList: Tables<'staff'>[]
  projectList: Tables<'projects'>[]
  compensationRules: Tables<'compensation_rules'>[]
  loadingRules: boolean
  onAssignmentChange: (staffId: string, projectId: string) => void
  onSubmit: (data: WorkReportFormValues) => void
  isSubmitting: boolean
  defaultValues?: Partial<WorkReportFormValues>
}

export function DynamicReportForm({
  staffList,
  projectList,
  compensationRules,
  loadingRules,
  onAssignmentChange,
  onSubmit,
  isSubmitting,
  defaultValues,
}: DynamicReportFormProps) {
  const [countFields, setCountFields] = useState<
    { key: string; label: string; unitName: string }[]
  >([])

  const form = useForm<WorkReportFormValues>({
    resolver: zodResolver(workReportFormSchema),
    defaultValues: {
      staff_id: '',
      project_id: '',
      year_month: new Date().toISOString().slice(0, 7),
      total_hours: 0,
      overtime_hours: 0,
      working_days: 0,
      standby_hours: 0,
      standby_days: 0,
      notes: '',
      qualitative_report: '',
      deliverable_url: '',
      count_data: {},
      ...defaultValues,
    },
  })

  const staffId = form.watch('staff_id')
  const projectId = form.watch('project_id')

  useEffect(() => {
    if (staffId && projectId) {
      onAssignmentChange(staffId, projectId)
    }
  }, [staffId, projectId, onAssignmentChange])

  // Determine which fields to show based on compensation rules
  const hasTimeRate = compensationRules.some((r) => r.rule_type === 'time_rate')
  const hasStandbyRate = compensationRules.some((r) => r.rule_type === 'standby_rate')
  const countRateRules = compensationRules.filter((r) => r.rule_type === 'count_rate')

  useEffect(() => {
    const fields = countRateRules.map((rule) => {
      const params = rule.params as unknown as CountRateParams
      return {
        key: rule.id,
        label: rule.name,
        unitName: params.unit_name || rule.name,
      }
    })
    setCountFields(fields)
  }, [compensationRules])

  const handleFormSubmit = form.handleSubmit((data) => {
    onSubmit(data)
  })

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {/* Basic selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="staff_id">スタッフ</Label>
              <Select
                value={form.watch('staff_id')}
                onValueChange={(v) => form.setValue('staff_id', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="スタッフを選択" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.last_name} {staff.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.staff_id && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.staff_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="project_id">プロジェクト</Label>
              <Select
                value={form.watch('project_id') || ''}
                onValueChange={(v) => form.setValue('project_id', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="プロジェクトを選択" />
                </SelectTrigger>
                <SelectContent>
                  {projectList.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="year_month">対象年月</Label>
              <Input
                type="month"
                {...form.register('year_month')}
              />
              {form.formState.errors.year_month && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.year_month.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic fields based on compensation rules */}
      {loadingRules ? (
        <Card>
          <CardContent className="py-6">
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Time-based fields */}
          {(hasTimeRate || compensationRules.length === 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">勤務時間</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="working_days">勤務日数</Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      {...form.register('working_days')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="total_hours">総勤務時間(h)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      {...form.register('total_hours')}
                    />
                    {compensationRules
                      .filter((r) => r.rule_type === 'time_rate')
                      .map((rule) => {
                        const params = rule.params as unknown as TimeRateParams
                        return (
                          <p key={rule.id} className="text-xs text-muted-foreground">
                            {rule.name}: {params.rate_per_hour?.toLocaleString('ja-JP')}円/h
                            {params.overtime_threshold_hours &&
                              ` (残業: ${params.overtime_threshold_hours}h超)`}
                          </p>
                        )
                      })}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overtime_hours">残業時間(h)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      {...form.register('overtime_hours')}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Count-based fields */}
          {countFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">件数実績</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {countFields.map((field) => {
                    const rule = countRateRules.find((r) => r.id === field.key)
                    const params = rule?.params as unknown as CountRateParams | undefined

                    return (
                      <div key={field.key} className="space-y-2">
                        <Label>{field.label}</Label>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          value={(form.watch(`count_data.${field.key}`) as number) || 0}
                          onChange={(e) =>
                            form.setValue(
                              `count_data.${field.key}`,
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
                        {params && (
                          <p className="text-xs text-muted-foreground">
                            {params.rate_per_unit?.toLocaleString('ja-JP')}円/{field.unitName}
                            {params.minimum_count ? ` (最低${params.minimum_count}件)` : ''}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Standby fields */}
          {hasStandbyRate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">待機時間</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="standby_hours">待機時間(h)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      {...form.register('standby_hours')}
                    />
                    {compensationRules
                      .filter((r) => r.rule_type === 'standby_rate')
                      .map((rule) => {
                        const params = rule.params as unknown as StandbyRateParams
                        return (
                          <p key={rule.id} className="text-xs text-muted-foreground">
                            {rule.name}:{' '}
                            {params.rate_per_hour
                              ? `${params.rate_per_hour.toLocaleString('ja-JP')}円/h`
                              : params.rate_per_day
                                ? `${params.rate_per_day.toLocaleString('ja-JP')}円/日`
                                : ''}
                          </p>
                        )
                      })}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="standby_days">待機日数</Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      {...form.register('standby_days')}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Qualitative report */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">定性報告</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qualitative_report">定性報告</Label>
            <Textarea
              rows={6}
              placeholder="業務の所感、成果、課題などを記入してください"
              {...form.register('qualitative_report')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliverable_url">成果物URL</Label>
            <Input
              type="url"
              placeholder="https://..."
              {...form.register('deliverable_url')}
            />
            {form.formState.errors.deliverable_url && (
              <p className="text-xs text-destructive">
                {form.formState.errors.deliverable_url.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">備考</Label>
            <Textarea
              rows={3}
              placeholder="その他備考"
              {...form.register('notes')}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '送信中...' : '保存する'}
        </Button>
      </div>
    </form>
  )
}
