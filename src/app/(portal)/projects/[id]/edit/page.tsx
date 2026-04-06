'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProjectForm } from '../../_components/project-form'
import { useProject, useUpdateProject } from '@/hooks/use-projects'
import type { ProjectFormValues } from '@/lib/validations/project'
import { ArrowLeft } from 'lucide-react'

interface PageProps {
  params: { id: string }
}

export default function EditProjectPage({ params }: PageProps) {
  const { id } = params
  const router = useRouter()

  const { data: project, isLoading } = useProject(id)
  const updateProject = useUpdateProject(id)

  const handleSubmit = async (data: ProjectFormValues) => {
    try {
      await updateProject.mutateAsync(data)
      toast.success('プロジェクトを更新しました')
      router.push(`/projects/${id}`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'プロジェクトの更新に失敗しました'
      )
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="プロジェクト編集" />
        <LoadingSkeleton variant="form" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <PageHeader title="プロジェクトが見つかりません" />
        <Button variant="outline" onClick={() => router.push('/projects')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          一覧に戻る
        </Button>
      </div>
    )
  }

  const customFields = project.custom_fields as Record<string, string> | null

  const defaultValues: Partial<ProjectFormValues> = {
    project_type: (project.project_type || 'BPO') as ProjectFormValues['project_type'],
    project_number: project.project_number || '',
    project_code: project.project_code || '',
    name: project.name,
    description: project.description || '',
    status: project.status as ProjectFormValues['status'],
    client_id: project.client_id || '',
    client_name: project.client_name || '',
    start_date: project.start_date || '',
    end_date: project.end_date || '',
    google_calendar_id: customFields?.google_calendar_id || '',
    slack_channel_id: project.slack_channel_id || '',
    slack_channel_name: project.slack_channel_name || '',
    shift_approval_mode: (project.shift_approval_mode || 'AUTO') as 'AUTO' | 'APPROVAL',
    calendar_display_name: customFields?.calendar_display_name || '',
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="プロジェクト編集"
        description={`${project.name} の情報を編集します`}
        actions={
          <Button variant="outline" onClick={() => router.push(`/projects/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            詳細に戻る
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <ProjectForm
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/projects/${id}`)}
            isSubmitting={updateProject.isPending}
            submitLabel="更新"
          />
        </CardContent>
      </Card>
    </div>
  )
}
