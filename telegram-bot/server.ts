// Load .env.local before anything else
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import TelegramBot from 'node-telegram-bot-api'
import { exec } from 'child_process'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const ALLOWED_USER_ID = parseInt(process.env.TELEGRAM_ALLOWED_USER_ID!)

if (!BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN in .env.local')
if (!ALLOWED_USER_ID) throw new Error('Missing TELEGRAM_ALLOWED_USER_ID in .env.local')

const bot = new TelegramBot(BOT_TOKEN, { polling: true })

// Project root — always run commands from here
const PROJECT_ROOT = path.resolve(__dirname, '..')

// Security check — only respond to the owner
function isOwner(userId: number): boolean {
  return userId === ALLOWED_USER_ID
}

// Send long messages in chunks (Telegram has 4096 char limit)
async function sendLongMessage(chatId: number, text: string) {
  const chunkSize = 4000
  for (let i = 0; i < text.length; i += chunkSize) {
    await bot.sendMessage(chatId, text.slice(i, i + chunkSize), {
      parse_mode: 'Markdown',
    })
  }
}

// Run a shell command and return output
function runCommand(command: string): Promise<string> {
  return new Promise((resolve) => {
    exec(command, { cwd: PROJECT_ROOT, timeout: 60000 }, (error, stdout, stderr) => {
      if (error) resolve(`Error: ${error.message}\n${stderr}`)
      else resolve(stdout || stderr || 'Done — no output')
    })
  })
}

// Handle incoming messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const userId = msg.from?.id
  const text = msg.text || ''

  // Security check
  if (!userId || !isOwner(userId)) {
    await bot.sendMessage(chatId, '❌ Unauthorized')
    return
  }

  // /start or /help
  if (text === '/start' || text === '/help') {
    await bot.sendMessage(
      chatId,
      `*DrivnDashboardr Dev Bot* 🚀\n\nSend any instruction and I'll run it on your project via Claude Code.\n\n*Quick commands:*\n/status — git status\n/log — last 10 commits\n/diff — current changes\n/build — run build check\n/errors — TypeScript errors\n\n*Or type any instruction like:*\n"Fix the pipeline card hover animation"\n"Add mobile styles to Numbers page"\n"Check why ROAS section is not showing"`,
      { parse_mode: 'Markdown' },
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
    const output = await runCommand('npm run build 2>&1 | tail -30')
    await sendLongMessage(chatId, `\`\`\`\n${output}\n\`\`\``)
    return
  }

  if (text === '/errors') {
    await bot.sendMessage(chatId, '⏳ Checking TypeScript errors...')
    const output = await runCommand('npx tsc --noEmit 2>&1 | head -50')
    await sendLongMessage(chatId, `\`\`\`\n${output}\n\`\`\``)
    return
  }

  // Pass any other message to Claude Code as an instruction
  await bot.sendMessage(chatId, `⏳ Sending to Claude Code:\n_"${text}"_`, { parse_mode: 'Markdown' })

  const escaped = text.replace(/"/g, '\\"').replace(/`/g, '\\`')
  const claudeCommand = `claude --print "${escaped}" 2>&1`
  const output = await runCommand(claudeCommand)
  await sendLongMessage(chatId, output || '✅ Done — no output returned')
})

bot.on('polling_error', (error) => {
  console.error('Telegram polling error:', error)
})

console.log('🤖 Telegram bot running — waiting for messages from your phone...')
console.log(`📁 Project root: ${PROJECT_ROOT}`)
