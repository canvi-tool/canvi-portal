import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const client = new pg.Client({
  host: 'db.sotajekzgypiuialanmi.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'Canvi0310ca',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
})

const migrationFiles = [
  '00001_create_auth_rbac.sql',
  '00002_create_staff.sql',
  '00003_create_contracts.sql',
  '00004_create_projects.sql',
  '00005_create_shifts.sql',
  '00006_create_reports.sql',
  '00007_create_payments.sql',
  '00008_create_notifications.sql',
  '00009_create_retirement.sql',
  '00010_create_custom_fields.sql',
  '00011_create_audit_log.sql',
  '00012_create_alerts.sql',
  '00013_create_project_documents.sql',
  '00014_add_shift_approval_mode.sql',
  '00015_create_account_management.sql',
]

async function main() {
  console.log('Connecting to Supabase PostgreSQL...')
  await client.connect()
  console.log('Connected!\n')

  for (const file of migrationFiles) {
    const filePath = path.join(__dirname, '..', 'supabase', 'migrations', file)
    const sql = fs.readFileSync(filePath, 'utf-8')
    console.log(`Running: ${file}...`)
    try {
      await client.query(sql)
      console.log(`  ✓ ${file} OK`)
    } catch (err) {
      console.error(`  ✗ ${file} FAILED: ${err.message}`)
      // Continue with remaining migrations
    }
  }

  console.log('\nDone! Verifying tables...')
  const res = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `)
  console.log('\nCreated tables:')
  res.rows.forEach(r => console.log(`  - ${r.table_name}`))

  await client.end()
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
