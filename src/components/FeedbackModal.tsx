import { useState, useEffect } from 'react'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface Props {
  onClose: () => void
  getCurrentCode: () => string
}

type Tab = 'feedback' | 'bug'

const RATINGS = ['😕', '😐', '🙂', '😊', '😍']

function getSupabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function getBrowserInfo(): { browser: string; os: string } {
  const ua = navigator.userAgent
  const browser =
    /Firefox\//.test(ua) ? 'Firefox' :
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\//.test(ua) ? 'Opera' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' : 'Other'
  const os =
    /Windows/.test(ua) ? 'Windows' :
    /Mac OS X/.test(ua) ? 'macOS' :
    /Linux/.test(ua) ? 'Linux' :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad/.test(ua) ? 'iOS' : 'Other'
  return { browser, os }
}

export function FeedbackModal({ onClose, getCurrentCode }: Props) {
  const [tab, setTab] = useState<Tab>('feedback')

  // Feedback form
  const [rating, setRating] = useState<number | null>(null)
  const [easeOfUse, setEaseOfUse] = useState<number | null>(null)
  const [wouldUse, setWouldUse] = useState<boolean | null>(null)
  const [role, setRole] = useState('student')
  const [comment, setComment] = useState('')

  // Bug form
  const [bugDesc, setBugDesc] = useState('')
  const [includeCode, setIncludeCode] = useState(true)

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function submitFeedback() {
    if (!rating) { setError('براہ کرم ریٹنگ دیں'); return }
    setLoading(true); setError('')
    const sb = getSupabase()
    if (!sb) {
      // Fallback: log to console in dev, silently succeed
      console.info('[feedback]', { rating, easeOfUse, wouldUse, role, comment, source: 'ide' })
      setSubmitted(true); setLoading(false); return
    }
    const { error: err } = await sb.from('survey_responses').insert({
      rating,
      ease_of_use: easeOfUse ?? null,
      would_use: wouldUse ?? null,
      role,
      comments: comment || null,
      source: 'ide',
    })
    setLoading(false)
    if (err) { setError('مسئلہ ہوا، دوبارہ کوشش کریں'); console.error(err) }
    else setSubmitted(true)
  }

  async function submitBug() {
    if (!bugDesc.trim()) { setError('غلطی کی وضاحت ضروری ہے'); return }
    setLoading(true); setError('')
    const { browser, os } = getBrowserInfo()
    const code = includeCode ? getCurrentCode() : null
    const sb = getSupabase()
    if (!sb) {
      console.info('[bug-report]', { description: bugDesc, code_snippet: code, source: 'ide', browser, os })
      setSubmitted(true); setLoading(false); return
    }
    const { error: err } = await sb.from('bug_reports').insert({
      description: bugDesc,
      code_snippet: code,
      source: 'ide',
      browser,
      os,
    })
    setLoading(false)
    if (err) { setError('مسئلہ ہوا، دوبارہ کوشش کریں'); console.error(err) }
    else setSubmitted(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm" dir="rtl">
        {submitted ? (
          <div className="text-center py-8 px-6">
            <div className="text-4xl mb-3">✓</div>
            <p className="text-white font-semibold mb-1">شکریہ!</p>
            <p className="text-gray-400 text-sm mb-5">آپ کا تاثر موصول ہوا</p>
            <a
              href="https://forms.gle/PHuVFEkVNWvNGHRS8"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-green-700 hover:bg-green-600 text-white text-sm font-semibold py-2 rounded-lg transition-colors mb-3"
            >
              مکمل فارم بھریں ↗
            </a>
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-300">
              بند کریں
            </button>
          </div>
        ) : (
          <>
            {/* Header + tabs */}
            <div className="flex items-center justify-between px-4 pt-4 pb-0">
              <div className="flex gap-1">
                <button
                  onClick={() => setTab('feedback')}
                  className={`px-3 py-1.5 rounded-t text-xs font-semibold transition-colors ${
                    tab === 'feedback' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  تاثر
                </button>
                <button
                  onClick={() => setTab('bug')}
                  className={`px-3 py-1.5 rounded-t text-xs font-semibold transition-colors ${
                    tab === 'bug' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  غلطی رپورٹ
                </button>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-200 text-xl leading-none pb-1">×</button>
            </div>

            <div className="bg-gray-800 rounded-b-none rounded-t-none p-4 mx-4 rounded-lg space-y-4">

              {tab === 'feedback' ? (
                <>
                  {/* Rating */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2">ادا کیسا لگا؟</p>
                    <div className="flex gap-2">
                      {RATINGS.map((emoji, i) => (
                        <button
                          key={i}
                          onClick={() => setRating(i + 1)}
                          className={`w-10 h-10 rounded-full text-xl transition-all ${
                            rating === i + 1
                              ? 'bg-blue-600 ring-2 ring-blue-400 scale-110'
                              : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ease of use */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2">کتنا آسان تھا؟</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => setEaseOfUse(n)}
                          className={`w-8 h-8 rounded text-xs font-mono transition-all ${
                            easeOfUse === n
                              ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Would use again */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2">کیا آپ دوبارہ استعمال کریں گے؟</p>
                    <div className="flex gap-2">
                      {[{ v: true, label: 'جی ہاں' }, { v: false, label: 'نہیں' }].map(({ v, label }) => (
                        <button
                          key={String(v)}
                          onClick={() => setWouldUse(v)}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                            wouldUse === v
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Role */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2">آپ کون ہیں؟</p>
                    <select
                      value={role}
                      onChange={e => setRole(e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="student">طالب علم</option>
                      <option value="teacher">استاد</option>
                      <option value="other">دیگر</option>
                    </select>
                  </div>

                  {/* Comment */}
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="کوئی تجویز یا مشکل؟ (اختیاری)"
                    rows={2}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </>
              ) : (
                <>
                  {/* Bug description */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2">غلطی کی وضاحت کریں</p>
                    <textarea
                      value={bugDesc}
                      onChange={e => setBugDesc(e.target.value)}
                      placeholder="مثلاً: جب میں نے یہ لکھا تو ایسا ہوا..."
                      rows={4}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  {/* Include code toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeCode}
                      onChange={e => setIncludeCode(e.target.checked)}
                      className="rounded accent-blue-500"
                    />
                    <span className="text-xs text-gray-300">موجودہ کوڈ شامل کریں</span>
                  </label>
                </>
              )}

              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            {/* Submit */}
            <div className="px-4 pb-4 pt-3 space-y-2">
              <button
                onClick={tab === 'feedback' ? submitFeedback : submitBug}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                {loading ? 'بھیجا جا رہا ہے...' : 'بھیجیں'}
              </button>
              <a
                href="https://forms.gle/PHuVFEkVNWvNGHRS8"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center text-xs text-gray-500 hover:text-green-400 transition-colors py-1"
              >
                مکمل فارم بھریں ↗
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
