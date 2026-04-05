import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/rbac'

export async function DELETE(request: NextRequest) {
  // CRON_SECRET or admin auth
  const authHeader = request.headers.get('authorization')
  const isCronAuth = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isCronAuth) {
    try {
      await requireAdmin()
    } catch {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      )
    }
  }

  try {
    const body = await request.json()
    const { type, project_codes, staff_name } = body as {
      type: 'projects' | 'staff'
      project_codes?: string[]
      staff_name?: string
    }

    const supabase = createAdminClient()

    if (type === 'projects') {
      if (!project_codes || project_codes.length === 0) {
        return NextResponse.json(
          { error: 'project_codes が必要です' },
          { status: 400 }
        )
      }

      // First delete related project_assignments
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .in('project_code', project_codes)

      if (projects && projects.length > 0) {
        const projectIds = projects.map((p) => p.id)

        // Delete project_assignments for these projects
        await supabase
          .from('project_assignments')
          .delete()
          .in('project_id', projectIds)

        // Delete the projects themselves
        const { data: deleted, error } = await supabase
          .from('projects')
          .delete()
          .in('project_code', project_codes)
          .select('id')

        if (error) {
          console.error('プロジェクト削除エラー:', error.message)
          return NextResponse.json(
            { error: 'プロジェクト削除エラーが発生しました' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          type: 'projects',
          deleted_count: deleted?.length ?? 0,
          project_codes,
        })
      }

      return NextResponse.json({
        success: true,
        type: 'projects',
        deleted_count: 0,
        message: '該当するプロジェクトが見つかりませんでした',
      })
    }

    if (type === 'staff') {
      if (!staff_name) {
        return NextResponse.json(
          { error: 'staff_name が必要です' },
          { status: 400 }
        )
      }

      // Find staff by concatenated last_name + first_name
      const { data: allStaff } = await supabase
        .from('staff')
        .select('id, last_name, first_name')

      const matchingStaff = allStaff?.filter(
        (s) => `${s.last_name}${s.first_name}` === staff_name
      )

      if (matchingStaff && matchingStaff.length > 0) {
        const staffIds = matchingStaff.map((s) => s.id)

        // Delete related project_assignments
        await supabase
          .from('project_assignments')
          .delete()
          .in('staff_id', staffIds)

        // Delete related contracts
        await supabase
          .from('contracts')
          .delete()
          .in('staff_id', staffIds)

        // Delete the staff records
        const { data: deleted, error } = await supabase
          .from('staff')
          .delete()
          .in('id', staffIds)
          .select('id')

        if (error) {
          console.error('スタッフ削除エラー:', error.message)
          return NextResponse.json(
            { error: 'スタッフ削除エラーが発生しました' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          type: 'staff',
          deleted_count: deleted?.length ?? 0,
          staff_name,
        })
      }

      return NextResponse.json({
        success: true,
        type: 'staff',
        deleted_count: 0,
        message: '該当するスタッフが見つかりませんでした',
      })
    }

    return NextResponse.json(
      { error: 'type は "projects" または "staff" を指定してください' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json(
      { error: 'クリーンアップ処理でエラーが発生しました' },
      { status: 500 }
    )
  }
}
