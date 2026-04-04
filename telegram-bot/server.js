// Load .env.local before anything else
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })

const TelegramBot = require('node-telegram-bot-api')
const Anthropic = require('@anthropic-ai/sdk')
const { exec } = require('child_process')
const path = require('path')

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const ALLOWED_USER_ID = parseInt(process.env.TELEGRAM_ALLOWED_USER_ID || '0')

if (!BOT_TOKEN) { console.error('❌ Missing TELEGRAM_BOT_TOKEN in .env.local'); process.exit(1) }
if (!ALLOWED_USER_ID) { console.error('❌ Missing TELEGRAM_ALLOWED_USER_ID in .env.local'); process.exit(1) }

const PROJECT_ROOT = path.resolve(__dirname, '..')
const bot = new TelegramBot(BOT_TOKEN, { polling: true })

function isOwner(userId) { return userId === ALLOWED_USER_ID }

async function sendLongMessage(chatId, text) {
  const chunkSize = 4000
  for (let i = 0; i < text.length; i += chunkSize) {
    await bot.sendMessage(chatId, text.slice(i, i + chunkSize), { parse_mode: 'Markdown' })
  }
}

function runCommand(command) {
  return new Promise((resolve) => {
    exec(command, { cwd: PROJECT_ROOT, timeout: 60000 }, (error, stdout, stderr) => {
      if (error) resolve(`Error: ${error.message}\n${stderr}`)
      else resolve(stdout || stderr || 'Done — no output')
    })
  })
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const userId = msg.from?.id
  const text = msg.text || ''

  // Temporary: show user ID so you can add it to .env.local
  if (!ALLOWED_USER_ID) {
    await bot.sendMessage(chatId, `Your Telegram user ID is: \`${userId}\`\n\nAdd this to .env.local:\nTELEGRAM_ALLOWED_USER_ID=${userId}`, { parse_mode: 'Markdown' })
    return
  }

  if (!userId || !isOwner(userId)) {
    await bot.sendMessage(chatId, '❌ Unauthorized')
    return
  }

  if (text === '/start' || text === '/help') {
    await bot.sendMessage(chatId,
      `*DrivnDashboardr Dev Bot* 🚀\n\nSend any instruction and I'll run it via Claude Code.\n\n*Quick commands:*\n/status — git status\n/log — last 10 commits\n/diff — current changes\n/build — run build check\n/errors — TypeScript errors\n\n*Or type any instruction like:*\n"Fix the pipeline card animation"\n"Check why ROAS section is not showing"`,
      { parse_mode: 'Markdown' }
    )
    return
  }

  if (text === '/status') {
    await bot.sendMessage(chatId, '⏳ Checking git status...')
    const output = await runCommand('git status')
    await sendLongMessage(chatId, `\`\`\`\n${output}\n\`\`\``)
    return
  }

  if (text === '/log') {
    await bot.sendMessage(chatId, '⏳ Getting recent commits...')
    const output = await runCommand('git log --oneline -10')
    await sendLongMessage(chatId, `\`\`\`\n${output}\n\`\`\``)
    return
  }

  if (text === '/diff') {
    await bot.sendMessage(chatId, '⏳ Getting current changes...')
    const output = await runCommand('git diff --stat')
    await sendLongMessage(chatId, `\`\`\`\n${output}\n\`\`\``)
    return
  }

  if (text === '/build') {
    await bot.sendMessage(chatId, '⏳ Running build check (may take ~30s)...')
    const output = await runCommand('npm run build 2>&1 | tail -20')
    await sendLongMessage(chatId, `\`\`\`\n${output}\n\`\`\``)
    return
  }

  if (text === '/errors') {
    await bot.sendMessage(chatId, '⏳ Checking TypeScript errors...')
    const output = await runCommand('npx tsc --noEmit 2>&1 | head -50')
    await sendLongMessage(chatId, `\`\`\`\n${output}\n\`\`\``)
    return
  }

  // Pass any other message to Claude via Anthropic SDK
  if (!process.env.ANTHROPIC_API_KEY) {
    await bot.sendMessage(chatId,
      '⚠️ Add `ANTHROPIC_API_KEY` to `.env.local` to enable free-text instructions.\n\nGet one at: console.anthropic.com → API Keys\n\nQuick commands still work:\n/status /log /diff /build /errors',
      { parse_mode: 'Markdown' }
    )
    return
  }

  await bot.sendMessage(chatId, `⏳ Thinking...\n_"${text}"_`, { parse_mode: 'Markdown' })

  try {
    const gitStatus = await runCommand('git status --short')
    const gitLog    = await runCommand('git log --oneline -5')
    const client    = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: `You are a coding assistant for DrivnDashboardr — a Next.js 16 CRM for online fitness coaches. Tech: Next.js 16 App Router, TypeScript, Supabase, Tailwind CSS v4, Vercel. Project root: ${PROJECT_ROOT}\n\nGit status:\n${gitStatus}\nRecent commits:\n${gitLog}\n\nBe concise and actionable.`,
      messages: [{ role: 'user', content: text }],
    })

    const answer = response.content[0]?.type === 'text' ? response.content[0].text : '✅ Done'
    await sendLongMessage(chatId, answer)
  } catch (err) {
    await bot.sendMessage(chatId, `❌ Error: ${err.message}`)
  }
})

bot.on('polling_error', (error) => console.error('Polling error:', error))

console.log('🤖 Telegram bot running...')
console.log(`📁 Project root: ${PROJECT_ROOT}`)
