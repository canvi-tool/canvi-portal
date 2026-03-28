'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { ProjectForm } from '../_components/project-form'
import { useCreateProject } from '@/hooks/use-projects'
import type { ProjectFormValues } from '@/lib/validations/project'

export default function NewProjectPage() {
  const router = useRouter()
  const createProject = useCreateProject()

  const handleSubmit = async (data: ProjectFormValues) => {
    try {
      const project = await createProject.mutateAsync(data)
      toast.success('プロジェクトを作成しました')
      router.push(`/projects/${project.id}`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'プロジェクトの作成に失敗しました'
      )
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="プロジェクト新規作成"
        description="新しいプロジェクトを作成します"
      />

      <Card>
        <CardContent className="pt-6">
          <ProjectForm
            onSubmit={handleSubmit}
            onCancel={() => router.push('/projects')}
            isSubmitting={createProject.isPending}
            submitLabel="作成"
          />
        </CardContent>
      </Card>
    </div>
  )
}
