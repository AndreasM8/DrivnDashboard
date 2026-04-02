import Link from 'next/link'

export default function AskPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 bg-white">
        <h1 className="text-xl font-bold text-gray-900">Your AI coaches</h1>
        <p className="text-sm text-gray-500 mt-0.5">Get instant advice from Andreas or Sebastian</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Andreas card */}
          <Link href="/ask/andreas" className="block">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">
                  🎯
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-gray-900">Andreas</h2>
                    <span className="text-xs font-semibold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Content & Brand</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Expert in Instagram growth, reels, content strategy, and personal branding for fitness coaches. Ask Andreas anything about creating content that converts.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {['Reel scripts', 'Hook generator', 'Content calendar', 'Caption writing'].map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-300 group-hover:text-gray-400 flex-shrink-0 mt-1 transition-colors">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Sebastian card */}
          <Link href="/ask/sebastian" className="block">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">
                  💼
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-gray-900">Sebastian</h2>
                    <span className="text-xs font-semibold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Sales & DMs</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Expert in DM conversations, sales calls, objection handling, and closing high-ticket coaching clients. Ask Sebastian for scripts and frameworks that actually close.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {['DM openers', 'Objection handling', 'Follow-up sequences', 'Sales scripts'].map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-300 group-hover:text-gray-400 flex-shrink-0 mt-1 transition-colors">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Info banner */}
          <div className="flex items-start gap-3 bg-gray-50 rounded-xl border border-gray-200 p-4 mt-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-gray-500 leading-relaxed">
              Both advisors learn from your conversations and remember your niche, goals, and challenges over time — so advice gets more personalised with every session.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
