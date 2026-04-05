/**
 * Slack thread_ts をattendance_recordsのnoteフィールドに埋め込む/抽出するユーティリティ
 * DBに slack_thread_ts カラムが追加されるまでの暫定対応
 */

const THREAD_TS_MARKER = '[__slack_ts:'
const THREAD_TS_REGEX = /\[__slack_ts:([^\]]+)\]/

/** noteフィールドにthread_tsを埋め込む */
export function embedSlackThreadTs(note: string | null, threadTs: string): string {
  const clean = stripSlackThreadTs(note)
  return `${clean ? clean + '\n' : ''}${THREAD_TS_MARKER}${threadTs}]`
}

/** noteフィールドからthread_tsを抽出する */
export function extractSlackThreadTs(note: string | null): string | null {
  if (!note) return null
  const match = note.match(THREAD_TS_REGEX)
  return match?.[1] || null
}

/** noteフィールドからthread_tsマーカーを除去する（表示用） */
export function stripSlackThreadTs(note: string | null): string | null {
  if (!note) return null
  return note.replace(THREAD_TS_REGEX, '').replace(/\n$/, '').trim() || null
}
