// Realistic seed data for DrivnDashboard
// Run: node scripts/seed-data.mjs

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY
const USER_ID        = process.env.SEED_USER_ID   // set this to your user UUID

if (!SUPABASE_URL || !SERVICE_KEY || !USER_ID) {
  console.error('Missing env vars. Run with:\n  SEED_USER_ID=<your-uuid> node -r dotenv/config scripts/seed-data.mjs')
  process.exit(1)
}

const headers = {
  'Content-Type':  'application/json',
  'apikey':        SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Prefer':        'return=representation',
}

async function req(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function hoursAgo(n) {
  return new Date(Date.now() - n * 3600_000).toISOString()
}

const SOURCES = ['instagram_reel', 'ig_story', 'manychat', 'referral', 'bio_link', 'ig_post']
const FIRST   = ['Sophie','Emma','Lena','Nina','Sara','Julia','Mia','Laura','Anna','Hannah',
                  'Lisa','Kira','Nora','Ida','Pia','Tina','Lea','Eva','Maja','Rosa',
                  'Marcus','Jonas','Emil','Noah','Luca','Max','Oscar','Erik','Adam','Tim']
const LAST    = ['Hansen','Berg','Andersen','Nilsen','Lie','Johansen','Kristiansen','Larsen',
                 'Olsen','Solberg','Lund','Haugen','Strand','Moe','Dahl']
const NOTES   = [
  'Lost 15kg last year, wants to build muscle now',
  'New mom, wants to get back in shape post-partum',
  'Has a wedding in 4 months — serious motivation',
  'Reacted to the "protein on a budget" reel twice',
  'Struggling with consistency, been trying for 2 years',
  'Personal trainer themselves, wants advanced programming',
  'Replied "this is exactly what I needed 🔥"',
  'Asked about macros, clearly knows the basics',
  'Wants transformation before summer, very motivated',
  'DM\'d asking about price — already warm',
  '',
  'Mentioned she follows 3 other coaches too',
  'Very engaged, liked 8 posts this month',
]

function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function ig()     { return (rnd(FIRST) + '_' + rnd(LAST)).toLowerCase() }
function fullName() { return rnd(FIRST) + ' ' + rnd(LAST) }

// ── Clear existing seed data ──────────────────────────────────────────────────

async function clearExisting() {
  console.log('🗑  Clearing existing leads & clients for Andreas...')
  // delete clients first (FK → leads)
  await req('DELETE', `/clients?user_id=eq.${USER_ID}`, null)
  await req('DELETE', `/leads?user_id=eq.${USER_ID}`, null)
  console.log('   Done.\n')
}

// ── Seed leads ─────────────────────────────────────────────────────────────────

async function seedLeads() {
  console.log('👤 Seeding leads...')

  const leads = []

  // ── Followers (18) — entered pipeline this month ─────────────────────────
  for (let i = 0; i < 18; i++) {
    leads.push({
      user_id: USER_ID, ig_username: ig(), full_name: fullName(),
      stage: 'follower', tier: rnd([1,2,2,3,3,null]),
      source: rnd(SOURCES), setter_notes: rnd(NOTES),
      created_at: daysAgo(Math.floor(Math.random() * 28)),
    })
  }

  // ── Replied (10) ──────────────────────────────────────────────────────────
  for (let i = 0; i < 10; i++) {
    leads.push({
      user_id: USER_ID, ig_username: ig(), full_name: fullName(),
      stage: 'replied', tier: rnd([1,2,2,3]),
      source: rnd(SOURCES), setter_notes: rnd(NOTES),
      last_contact_at: daysAgo(Math.floor(Math.random() * 14)),
      created_at: daysAgo(Math.floor(Math.random() * 28)),
    })
  }

  // ── Freebie sent (8) ─────────────────────────────────────────────────────
  for (let i = 0; i < 8; i++) {
    const dCA = Math.floor(Math.random() * 25)
    leads.push({
      user_id: USER_ID, ig_username: ig(), full_name: fullName(),
      stage: 'freebie_sent', tier: rnd([1,2,3]),
      source: rnd(SOURCES), setter_notes: rnd(NOTES),
      freebie_sent_at: daysAgo(dCA),
      last_contact_at: daysAgo(Math.max(0, dCA - 2)),
      created_at: daysAgo(dCA + 2),
    })
  }

  // ── Call booked — upcoming (5) ───────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    const dCA = Math.floor(Math.random() * 20)
    leads.push({
      user_id: USER_ID, ig_username: ig(), full_name: fullName(),
      stage: 'call_booked', tier: rnd([1,2,3]),
      source: rnd(SOURCES), setter_notes: rnd(NOTES),
      freebie_sent_at: daysAgo(dCA + 5),
      call_booked_at: daysAgo(dCA),
      created_at: daysAgo(dCA + 7),
    })
  }

  // ── Showed — closed (6) ──────────────────────────────────────────────────
  for (let i = 0; i < 6; i++) {
    const dCA = Math.floor(Math.random() * 28)
    leads.push({
      user_id: USER_ID, ig_username: ig(), full_name: fullName(),
      stage: 'closed', tier: rnd([1,2]),
      source: rnd(SOURCES),
      freebie_sent_at: daysAgo(dCA + 8),
      call_booked_at: daysAgo(dCA + 3),
      call_outcome: 'showed', call_closed: true,
      setter_notes: rnd(NOTES), call_notes: 'Great call. High motivation, bought immediately.',
      created_at: daysAgo(dCA + 10),
    })
  }

  // ── Showed — not closed (3) ───────────────────────────────────────────────
  for (let i = 0; i < 3; i++) {
    const dCA = Math.floor(Math.random() * 20) + 3
    leads.push({
      user_id: USER_ID, ig_username: ig(), full_name: fullName(),
      stage: 'nurture', tier: 2,
      source: rnd(SOURCES),
      freebie_sent_at: daysAgo(dCA + 6),
      call_booked_at: daysAgo(dCA + 2),
      call_outcome: 'showed', call_closed: false,
      call_objection: rnd(['money','timing','partner']),
      setter_notes: 'Was close, needs follow-up next week',
      created_at: daysAgo(dCA + 8),
    })
  }

  // ── No-shows (3) ──────────────────────────────────────────────────────────
  for (let i = 0; i < 3; i++) {
    const dCA = Math.floor(Math.random() * 20) + 3
    leads.push({
      user_id: USER_ID, ig_username: ig(), full_name: fullName(),
      stage: 'nurture', tier: rnd([2,3]),
      source: rnd(SOURCES),
      call_booked_at: daysAgo(dCA + 1),
      call_outcome: 'no_show', call_closed: false,
      setter_notes: 'No-showed. Re-booked for next week.',
      created_at: daysAgo(dCA + 5),
    })
  }

  // ── Bad fit / not interested (4) ─────────────────────────────────────────
  for (let i = 0; i < 2; i++) {
    leads.push({
      user_id: USER_ID, ig_username: ig(), full_name: fullName(),
      stage: 'bad_fit', source: rnd(SOURCES),
      call_outcome: 'showed', call_closed: false,
      call_objection: 'other',
      setter_notes: 'Not a good fit for the program.',
      created_at: daysAgo(Math.floor(Math.random() * 28)),
    })
    leads.push({
      user_id: USER_ID, ig_username: ig(), full_name: fullName(),
      stage: 'not_interested', source: rnd(SOURCES),
      not_interested: true,
      setter_notes: 'Said not interested for now.',
      created_at: daysAgo(Math.floor(Math.random() * 28)),
    })
  }

  // Normalise: PostgREST batch insert requires identical keys across all rows
  const LEAD_DEFAULTS = {
    user_id: null, ig_username: '', full_name: '', phone: '', source: '',
    stage: 'follower', tier: null, setter_id: null, closer_id: null,
    setter_notes: '', call_booked_at: null, call_outcome: null,
    call_closed: false, call_objection: null, call_notes: '',
    freebie_sent_at: null, last_contact_at: null, source_flow: '',
    not_interested: false, created_at: null,
  }
  const normLeads = leads.map(l => ({ ...LEAD_DEFAULTS, ...l }))

  // Insert in batches of 10
  const inserted = []
  for (let i = 0; i < normLeads.length; i += 10) {
    const batch = normLeads.slice(i, i + 10)
    const rows = await req('POST', '/leads', batch)
    inserted.push(...rows)
    process.stdout.write('.')
  }
  console.log(`\n   ✓ ${inserted.length} leads inserted.\n`)
  return inserted
}

// ── Seed clients ───────────────────────────────────────────────────────────────

async function seedClients(leads) {
  console.log('💰 Seeding clients...')

  // Use the closed leads to create matching client records
  const closedLeads = leads.filter(l => l.stage === 'closed')
  const clientRows  = []

  const types = ['pif','pif','split','plan','plan','plan']
  for (const [i, lead] of closedLeads.entries()) {
    const ptype = types[i % types.length]
    const totalAmt = rnd([12000, 14000, 18000, 24000, 9000, 21000])
    const months   = ptype === 'pif' ? null : ptype === 'split' ? 2 : rnd([3,4,6])
    const monthly  = months ? Math.round(totalAmt / months) : null
    clientRows.push({
      user_id: USER_ID,
      lead_id: lead.id,
      ig_username: lead.ig_username,
      full_name:   lead.full_name,
      payment_type: ptype,
      plan_months:  months,
      monthly_amount: monthly,
      total_amount: totalAmt,
      currency: 'NOK',
      started_at: daysAgo(Math.floor(Math.random() * 25)),
      notes: 'Closed via DM pipeline.',
      active: true,
    })
  }

  // Extra 3 clients from before this month (old revenue)
  for (let i = 0; i < 3; i++) {
    const totalAmt = rnd([14000, 16000, 20000])
    const months   = rnd([3,4,6])
    clientRows.push({
      user_id: USER_ID,
      ig_username: ig(), full_name: fullName(),
      payment_type: 'plan',
      plan_months: months,
      monthly_amount: Math.round(totalAmt / months),
      total_amount: totalAmt,
      currency: 'NOK',
      started_at: daysAgo(40 + i * 10),
      notes: 'Older client, still active.',
      active: true,
    })
  }

  // Normalise client rows
  const CLIENT_DEFAULTS = {
    user_id: null, lead_id: null, ig_username: '', full_name: '',
    payment_type: 'pif', plan_months: null, monthly_amount: null,
    total_amount: 0, currency: 'NOK', started_at: null, closer_id: null,
    upsell_reminder_month: null, upsell_reminder_set: false,
    notes: '', active: true,
  }
  const normClients = clientRows.map(c => ({ ...CLIENT_DEFAULTS, ...c }))
  const insertedClients = await req('POST', '/clients', normClients)
  console.log(`   ✓ ${insertedClients.length} clients inserted.`)

  // ── Seed payment installments for plan/split clients ─────────────────────
  console.log('💳 Seeding payment installments...')
  const installments = []

  for (const client of insertedClients) {
    if (client.payment_type === 'pif') {
      // Single paid installment
      installments.push({
        client_id: client.id,
        month_number: 1,
        due_date: client.started_at?.split('T')[0] ?? new Date().toISOString().split('T')[0],
        amount: client.total_amount,
        paid: true,
        paid_at: client.started_at,
        manually_confirmed: true,
      })
    } else {
      const months = client.plan_months ?? 2
      const startDate = new Date(client.started_at ?? new Date())
      for (let m = 0; m < months; m++) {
        const due = new Date(startDate)
        due.setMonth(due.getMonth() + m)
        const isPast = due <= new Date()
        const paid   = isPast && Math.random() > 0.15  // 85% paid if past due
        installments.push({
          client_id: client.id,
          month_number: m + 1,
          due_date: due.toISOString().split('T')[0],
          amount: client.monthly_amount,
          paid,
          paid_at: paid ? due.toISOString() : null,
          manually_confirmed: paid,
        })
      }
    }
  }

  // Insert in batches
  for (let i = 0; i < installments.length; i += 20) {
    await req('POST', '/payment_installments', installments.slice(i, i + 20))
    process.stdout.write('.')
  }
  console.log(`\n   ✓ ${installments.length} installments inserted.\n`)

  return insertedClients
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 DrivnDashboard — Realistic seed data\n')
  await clearExisting()
  const leads   = await seedLeads()
  const clients = await seedClients(leads)

  console.log('─────────────────────────────────────────')
  console.log(`✅ Seed complete!`)
  console.log(`   Leads:    ${leads.length}`)
  console.log(`   Clients:  ${clients.length}`)
  console.log('')
  console.log('Funnel breakdown:')
  const stages = {}
  for (const l of leads) stages[l.stage] = (stages[l.stage] ?? 0) + 1
  for (const [s, n] of Object.entries(stages)) console.log(`   ${s.padEnd(16)} ${n}`)
}

main().catch(e => { console.error(e); process.exit(1) })
