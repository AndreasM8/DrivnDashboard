// ─── Agent tool definitions ───────────────────────────────────────────────────

export interface AgentField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select'
  placeholder?: string
  options?: string[]
}

export interface AgentDef {
  id: string
  label: string
  description: string
  icon: string
  fields: AgentField[]
  prompt: string  // template with {field_id} and {USER_MEMORY} placeholders
}

// ─── Andreas agents ───────────────────────────────────────────────────────────

export const ANDREAS_AGENTS: AgentDef[] = [
  {
    id: 'reel_generator',
    label: 'Reel script',
    description: 'Full script for a viral-style reel',
    icon: '🎬',
    fields: [
      {
        id: 'topic',
        label: 'What is the reel about?',
        type: 'textarea',
        placeholder: 'e.g. Why your clients are failing to lose weight (hint: it\'s not the diet)',
      },
      {
        id: 'target',
        label: 'Who is the target viewer?',
        type: 'text',
        placeholder: 'e.g. Busy mums who have tried every diet',
      },
      {
        id: 'cta',
        label: 'Call to action',
        type: 'text',
        placeholder: 'e.g. DM me "RESET" to get my free 5-day plan',
      },
    ],
    prompt: `You are Andreas, expert in Instagram content for fitness coaches.

Create a complete reel script for this coach.

Topic: {topic}
Target viewer: {target}
CTA: {cta}

What you know about this coach:
{USER_MEMORY}

Write:
1. HOOK (first 2-3 seconds — must stop the scroll, no "Hey guys" openings)
2. BODY (3-5 punchy points, each under 10 seconds of speaking time)
3. CTA (natural, non-desperate)

Format each section clearly. Include on-screen text suggestions in [brackets]. Keep total speaking time under 60 seconds.`,
  },
  {
    id: 'hook_generator',
    label: 'Hook generator',
    description: '10 scroll-stopping hooks for your next post',
    icon: '🪝',
    fields: [
      {
        id: 'topic',
        label: 'Post topic',
        type: 'textarea',
        placeholder: 'e.g. Why most fitness coaches fail in their first year',
      },
      {
        id: 'format',
        label: 'Format',
        type: 'select',
        options: ['Reel', 'Carousel', 'Static post', 'Story'],
      },
    ],
    prompt: `You are Andreas, expert in Instagram growth for fitness coaches.

Generate 10 high-performing hooks for this coach.

Topic: {topic}
Format: {format}

What you know about this coach:
{USER_MEMORY}

Rules for great hooks:
- Pattern interrupt — say something unexpected
- Speak directly to the pain or desire
- Create curiosity or controversy
- First 3 words must grab attention
- No "Hey guys" or "Today I want to talk about"

Give 10 hooks across different angles: pain, transformation, controversy, curiosity, bold claim, story, mistake, secret, contrast, challenge. Label each type.`,
  },
  {
    id: 'caption_writer',
    label: 'Caption writer',
    description: 'Engaging caption that drives saves and DMs',
    icon: '✍️',
    fields: [
      {
        id: 'hook',
        label: 'Your hook / first line',
        type: 'text',
        placeholder: 'e.g. Most fitness coaches are broke for a simple reason.',
      },
      {
        id: 'message',
        label: 'Core message / lesson',
        type: 'textarea',
        placeholder: 'What do you want them to take away?',
      },
      {
        id: 'cta',
        label: 'CTA',
        type: 'text',
        placeholder: 'e.g. Comment "GUIDE" for my free resource',
      },
    ],
    prompt: `You are Andreas, expert in Instagram content for fitness coaches.

Write a full Instagram caption for this coach.

Hook (first line): {hook}
Core message: {message}
CTA: {cta}

What you know about this coach:
{USER_MEMORY}

Caption structure:
- Hook (their line, exactly as written)
- 2-3 short punchy paragraphs expanding the message
- Relatable or specific detail that builds trust
- CTA (their line, naturally integrated)

Keep paragraphs short (2-3 lines max). Use line breaks generously — Instagram captions need white space. Tone should match this coach's brand voice based on what you know about them.`,
  },
  {
    id: 'content_planner',
    label: 'Content plan',
    description: '30-day content calendar with topics and formats',
    icon: '📅',
    fields: [
      {
        id: 'niche',
        label: 'Your niche (if different from usual)',
        type: 'text',
        placeholder: 'Leave blank to use your saved niche',
      },
      {
        id: 'goal',
        label: 'Main goal this month',
        type: 'select',
        options: ['Get more followers', 'Generate DM conversations', 'Build authority', 'Promote a specific offer', 'Stay consistent'],
      },
      {
        id: 'posts_per_week',
        label: 'Posts per week',
        type: 'select',
        options: ['3', '4', '5', '7'],
      },
    ],
    prompt: `You are Andreas, expert in Instagram growth for fitness coaches.

Create a 30-day content calendar.

Niche: {niche}
Goal this month: {goal}
Posts per week: {posts_per_week}

What you know about this coach:
{USER_MEMORY}

For each post include:
- Day number
- Format (Reel / Carousel / Static / Story)
- Content pillar (Education / Entertainment / Personal / Social proof / Offer)
- Topic/title
- One-line hook idea

Organise into 4 weeks. Ensure variety across pillars and formats. Put the highest-converting content types (reels) on peak engagement days. Include 2-3 offer-related posts spread naturally through the month.`,
  },
]

// ─── Sebastian agents ─────────────────────────────────────────────────────────

export const SEBASTIAN_AGENTS: AgentDef[] = [
  {
    id: 'dm_opener',
    label: 'DM opener',
    description: 'Personalised openers that actually get replies',
    icon: '💬',
    fields: [
      {
        id: 'prospect_context',
        label: 'What do you know about this prospect?',
        type: 'textarea',
        placeholder: 'e.g. Personal trainer, posts about marathon running, has 2k followers, commented on my reel about mindset',
      },
      {
        id: 'offer',
        label: 'Your coaching offer',
        type: 'text',
        placeholder: 'e.g. 12-week 1:1 online coaching, £2k',
      },
      {
        id: 'style',
        label: 'Opener style',
        type: 'select',
        options: ['Genuine compliment + question', 'Content reference', 'Shared pain point', 'Bold and direct', 'Value first'],
      },
    ],
    prompt: `You are Sebastian, expert in high-ticket DM sales for fitness coaches.

Write 5 DM openers for this prospect.

Prospect context: {prospect_context}
Coaching offer: {offer}
Style preference: {style}

What you know about this coach:
{USER_MEMORY}

Rules:
- No "Hey I love your content!" without specifics
- Reference something real and specific about them
- End with a question that's easy to answer
- Maximum 3 sentences
- Don't pitch the offer in the opener — open the conversation

Give 5 variations, label them 1-5. Include a note on when to use each.`,
  },
  {
    id: 'objection_handler',
    label: 'Objection handler',
    description: 'Word-for-word responses to common sales objections',
    icon: '🛡️',
    fields: [
      {
        id: 'objection',
        label: 'What objection did they give?',
        type: 'select',
        options: [
          "It's too expensive / I can't afford it",
          'I need to think about it',
          'I need to speak to my partner/spouse',
          'I don\'t have time right now',
          'I\'ve tried coaching before and it didn\'t work',
          'Can you do a discount?',
          'Let me see some results first',
          'I\'m not ready yet',
        ],
      },
      {
        id: 'context',
        label: 'What happened before the objection?',
        type: 'textarea',
        placeholder: 'e.g. We had a 30min discovery call, they seemed excited, then said they need to think about it',
      },
      {
        id: 'channel',
        label: 'Where is the conversation?',
        type: 'select',
        options: ['Instagram DM', 'Sales call (verbal)', 'WhatsApp', 'Email'],
      },
    ],
    prompt: `You are Sebastian, expert in high-ticket sales for fitness coaches.

Handle this objection.

Objection: {objection}
Context: {context}
Channel: {channel}

What you know about this coach:
{USER_MEMORY}

Give:
1. Why they're REALLY saying this (the psychology behind the objection)
2. A word-for-word response tailored to the channel
3. A follow-up if they don't respond within 48 hours
4. One thing NOT to say (common mistake)

Be direct. Give the actual script, not a framework.`,
  },
  {
    id: 'followup_sequence',
    label: 'Follow-up sequence',
    description: 'Multi-touch follow-up that keeps the conversation alive',
    icon: '🔄',
    fields: [
      {
        id: 'situation',
        label: 'Where did the conversation stop?',
        type: 'textarea',
        placeholder: 'e.g. Had a discovery call on Monday, they said they\'d let me know by Friday, haven\'t heard back',
      },
      {
        id: 'days_since',
        label: 'Days since last contact',
        type: 'select',
        options: ['1-2 days', '3-5 days', '1 week', '2 weeks', '1 month+'],
      },
      {
        id: 'channel',
        label: 'Channel',
        type: 'select',
        options: ['Instagram DM', 'WhatsApp', 'Email'],
      },
    ],
    prompt: `You are Sebastian, expert in high-ticket sales follow-up for fitness coaches.

Write a follow-up sequence for this situation.

Situation: {situation}
Days since last contact: {days_since}
Channel: {channel}

What you know about this coach:
{USER_MEMORY}

Write a 3-message sequence:
Message 1: Send now — re-open the conversation without being desperate
Message 2: Send 3-4 days later if no reply — add value or create urgency
Message 3: Send 7 days later — breakup message that often triggers a response

For each message:
- Exact words to send
- Subject line (if email)
- Best time to send
- What to do if they reply

Keep messages short. No essays. The goal is a response, not a monologue.`,
  },
]

export const ALL_AGENTS: Record<string, AgentDef[]> = {
  andreas: ANDREAS_AGENTS,
  sebastian: SEBASTIAN_AGENTS,
}
