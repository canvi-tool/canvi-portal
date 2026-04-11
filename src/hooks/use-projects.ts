'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Tables } from '@/lib/types/database'
import type { ProjectFormValues } from '@/lib/validations/project'
import type { AssignmentFormValues, CompensationRuleFormValues } from '@/lib/validations/assignment'

// ---- Types ----

export type Project = Tables<'projects'> & {
  metadata: {
    project_code?: string
  } | null
  assignment_count?: number
  assignment_names?: string[]
}

export type ProjectAssignment = Tables<'project_assignments'> & {
  staff?: Tables<'staff'> | null
  compensation_rules?: Tables<'compensation_rules'>[]
}

export type CompensationRule = Tables<'compensation_rules'>

// ---- Fetchers ----

async function fetchProjects(params?: {
  search?: string
  status?: string
}): Promise<Project[]> {
  const searchParams = new URLSearchParams()
  if (params?.search) searchParams.set('search', params.search)
  if (params?.status) searchParams.set('status', params.status)
  const res = await fetch(`/api/projects?${searchParams.toString()}`)
  if (!res.ok) throw new Error('プロジェクトの取得に失敗しました')
  return res.json()
}

async function fetchProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`)
  if (!res.ok) throw new Error('プロジェクトの取得に失敗しました')
  return res.json()
}

async function createProject(data: ProjectFormValues): Promise<Project> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'プロジェクトの作成に失敗しました')
  }
  return res.json()
}

async function updateProject(id: string, data: ProjectFormValues): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'プロジェクトの更新に失敗しました')
  }
  return res.json()
}

async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('プロジェクトの削除に失敗しました')
}

async function fetchAssignments(projectId: string): Promise<ProjectAssignment[]> {
  const res = await fetch(`/api/projects/${projectId}/assignments`)
  if (!res.ok) throw new Error('アサインの取得に失敗しました')
  return res.json()
}

async function createAssignment(
  projectId: string,
  data: AssignmentFormValues
): Promise<ProjectAssignment> {
  const res = await fetch(`/api/projects/${projectId}/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'アサインの作成に失敗しました')
  }
  return res.json()
}

async function updateAssignment(
  projectId: string,
  assignmentId: string,
  data: Partial<AssignmentFormValues>
): Promise<ProjectAssignment> {
  const res = await fetch(`/api/projects/${projectId}/assignments/${assignmentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'アサインの更新に失敗しました')
  }
  return res.json()
}

async function deleteAssignment(projectId: string, assignmentId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/assignments/${assignmentId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('アサインの削除に失敗しました')
}

async function fetchCompensationRules(
  projectId: string,
  assignmentId: string
): Promise<CompensationRule[]> {
  const res = await fetch(
    `/api/projects/${projectId}/assignments/${assignmentId}/compensation-rules`
  )
  if (!res.ok) throw new Error('報酬ルールの取得に失敗しました')
  return res.json()
}

async function createCompensationRule(
  projectId: string,
  assignmentId: string,
  data: CompensationRuleFormValues
): Promise<CompensationRule> {
  const res = await fetch(
    `/api/projects/${projectId}/assignments/${assignmentId}/compensation-rules`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '報酬ルールの作成に失敗しました')
  }
  return res.json()
}

async function updateCompensationRule(
  projectId: string,
  assignmentId: string,
  ruleId: string,
  data: CompensationRuleFormValues
): Promise<CompensationRule> {
  const res = await fetch(
    `/api/projects/${projectId}/assignments/${assignmentId}/compensation-rules/${ruleId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '報酬ルールの更新に失敗しました')
  }
  return res.json()
}

async function deleteCompensationRule(
  projectId: string,
  assignmentId: string,
  ruleId: string
): Promise<void> {
  const res = await fetch(
    `/api/projects/${projectId}/assignments/${assignmentId}/compensation-rules/${ruleId}`,
    { method: 'DELETE' }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '報酬ルールの削除に失敗しました')
  }
}

async function fetchStaffList(): Promise<Tables<'staff'>[]> {
  const res = await fetch('/api/staff?status=active')
  if (!res.ok) throw new Error('スタッフの取得に失敗しました')
  const json = await res.json()
  // staff APIは {data: [...], total: ...} 形式で返すため、配列を取り出す
  return Array.isArray(json) ? json : (json.data || [])
}

// ---- Query Keys ----

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (params?: { search?: string; status?: string }) =>
    [...projectKeys.lists(), params] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  assignments: (projectId: string) =>
    [...projectKeys.detail(projectId), 'assignments'] as const,
  compensationRules: (projectId: string, assignmentId: string) =>
    [...projectKeys.assignments(projectId), assignmentId, 'compensation-rules'] as const,
}

// ---- Hooks ----

export function useProjects(params?: { search?: string; status?: string }) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => fetchProjects(params),
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => fetchProject(id),
    enabled: !!id,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
  })
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ProjectFormValues) => updateProject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
  })
}

async function bulkUpdateProjectStatus({ ids, status }: { ids: string[]; status: string }): Promise<{ updated: number; status: string }> {
  const res = await fetch('/api/projects/bulk', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, status }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '一括更新に失敗しました' }))
    throw new Error(err.error || '一括更新に失敗しました')
  }
  return res.json()
}

export function useBulkUpdateProjectStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: bulkUpdateProjectStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
  })
}

export function useAssignments(projectId: string) {
  return useQuery({
    queryKey: projectKeys.assignments(projectId),
    queryFn: () => fetchAssignments(projectId),
    enabled: !!projectId,
  })
}

export function useCreateAssignment(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: AssignmentFormValues) => createAssignment(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.assignments(projectId) })
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
    },
  })
}

export function useUpdateAssignment(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      assignmentId,
      data,
    }: {
      assignmentId: string
      data: Partial<AssignmentFormValues>
    }) => updateAssignment(projectId, assignmentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.assignments(projectId) })
    },
  })
}

export function useDeleteAssignment(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (assignmentId: string) => deleteAssignment(projectId, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.assignments(projectId) })
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
    },
  })
}

export function useCompensationRules(projectId: string, assignmentId: string) {
  return useQuery({
    queryKey: projectKeys.compensationRules(projectId, assignmentId),
    queryFn: () => fetchCompensationRules(projectId, assignmentId),
    enabled: !!projectId && !!assignmentId,
  })
}

export function useCreateCompensationRule(projectId: string, assignmentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CompensationRuleFormValues) =>
      createCompensationRule(projectId, assignmentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.compensationRules(projectId, assignmentId),
      })
      queryClient.invalidateQueries({ queryKey: projectKeys.assignments(projectId) })
    },
  })
}

export function useUpdateCompensationRule(projectId: string, assignmentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ruleId, data }: { ruleId: string; data: CompensationRuleFormValues }) =>
      updateCompensationRule(projectId, assignmentId, ruleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.compensationRules(projectId, assignmentId),
      })
      queryClient.invalidateQueries({ queryKey: projectKeys.assignments(projectId) })
    },
  })
}

export function useDeleteCompensationRule(projectId: string, assignmentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ruleId: string) =>
      deleteCompensationRule(projectId, assignmentId, ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.compensationRules(projectId, assignmentId),
      })
      queryClient.invalidateQueries({ queryKey: projectKeys.assignments(projectId) })
    },
  })
}

export function useBulkCreateCompensationRule(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      assignmentIds,
      data,
    }: {
      assignmentIds: string[]
      data: CompensationRuleFormValues
    }) =>
      Promise.allSettled(
        assignmentIds.map((aid) => createCompensationRule(projectId, aid, data))
      ).then((results) => {
        const created = results.filter((r) => r.status === 'fulfilled').length
        if (created === 0) throw new Error('一括追加に失敗しました')
        return { created }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.assignments(projectId) })
    },
  })
}

export function useStaffList() {
  return useQuery({
    queryKey: ['staff', 'active'],
    queryFn: fetchStaffList,
  })
}
