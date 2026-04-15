import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSession, postResearch } from './api/client.js'
import { highlightTerms, snippet } from './utils/highlight.jsx'

const SESSION_KEY = 'mra_session_id'

function loadSessionId() {
  try {
    return localStorage.getItem(SESSION_KEY) || ''
  } catch {
    return ''
  }
}

function saveSessionId(id) {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id)
  } catch {
    /* ignore */
  }
}

export default function App() {
  const [patientName, setPatientName] = useState('')
  const [disease, setDisease] = useState('')
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [sessionId, setSessionId] = useState(loadSessionId)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    saveSessionId(sessionId)
  }, [sessionId])

  useEffect(() => {
    const id = loadSessionId()
    if (!id) {
      setHydrated(true)
      return
    }
    setSessionId(id)
    getSession(id)
      .then((sess) => {
        if (sess?.diseaseContext) {
          setPatientName(sess.diseaseContext.patientName || '')
          setDisease(sess.diseaseContext.disease || '')
          setLocation(sess.diseaseContext.location || '')
        }
        if (sess?.chatHistory?.length) {
          setMessages(
            sess.chatHistory.map((m) => ({
              role: m.role,
              content: m.content,
              ts: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
              payload:
                m.role === 'assistant' && m.meta?.topPublications
                  ? {
                      structuredAnswer: m.content,
                      researchPapers: m.meta.topPublications,
                      clinicalTrials: m.meta.topTrials,
                      sources: m.meta.sources,
                    }
                  : undefined,
            }))
          )
        }
      })
      .catch(() => {
        /* session missing or API down */
      })
      .finally(() => setHydrated(true))
  }, [])

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      if (!query.trim()) {
        setError('Please enter a research question.')
        return
      }
      setError('')
      setLoading(true)
      const userText = [patientName && `Name: ${patientName}`, disease && `Condition: ${disease}`, location && `Location: ${location}`, `Query: ${query}`]
        .filter(Boolean)
        .join('\n')

      setMessages((m) => [...m, { role: 'user', content: userText, ts: Date.now() }])

      try {
        const data = await postResearch({
          patientName: patientName.trim(),
          disease: disease.trim(),
          query: query.trim(),
          location: location.trim(),
          sessionId: sessionId || undefined,
        })
        if (data.sessionId) setSessionId(data.sessionId)
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: data.structuredAnswer,
            ts: Date.now(),
            payload: data,
          },
        ])
      } catch (err) {
        const msg =
          err.response?.data?.error ||
          err.message ||
          'Request failed. Is the API running?'
        setError(msg)
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: `Error: ${msg}`,
            ts: Date.now(),
            error: true,
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [patientName, disease, query, location, sessionId]
  )

  const chatHistory = useMemo(() => messages, [messages])

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 pb-16">
      <header className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-sky-700">
          Evidence-grounded assistant
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          Medical Research Assistant
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          Structured queries across PubMed, OpenAlex, and ClinicalTrials.gov — ranked,
          synthesized with a local open-source model (Ollama), never raw API dumps.
        </p>
      </header>

      <div className="grid flex-1 gap-8 lg:grid-cols-[minmax(0,340px)_1fr]">
        <aside className="h-fit rounded-2xl border border-sky-100 bg-white/90 p-6 shadow-lg shadow-sky-900/5 backdrop-blur">
          <h2 className="text-lg font-semibold text-slate-800">Session & query</h2>
          <p className="mt-1 text-sm text-slate-500">
            Multi-turn: disease context is remembered when you return with the same session.
          </p>
          <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
            <label className="block text-left text-sm font-medium text-slate-700">
              Name (optional)
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-sky-500/30 focus:ring-2"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Patient or clinician name"
              />
            </label>
            <label className="block text-left text-sm font-medium text-slate-700">
              Disease / condition
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-sky-500/30 focus:ring-2"
                value={disease}
                onChange={(e) => setDisease(e.target.value)}
                placeholder="e.g. non-small cell lung cancer"
              />
            </label>
            <label className="block text-left text-sm font-medium text-slate-700">
              Research question <span className="text-red-600">*</span>
              <textarea
                required
                rows={3}
                className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-sky-500/30 focus:ring-2"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='e.g. "Latest treatment for lung cancer"'
              />
            </label>
            <label className="block text-left text-sm font-medium text-slate-700">
              Location (optional, for trials)
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-sky-500/30 focus:ring-2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, country"
              />
            </label>
            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Analyzing research…' : 'Run research'}
            </button>
          </form>
          {sessionId ? (
            <p className="mt-4 break-all text-xs text-slate-400">
              Session: {sessionId.slice(0, 8)}…
            </p>
          ) : null}
        </aside>

        <main className="min-h-[480px] rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-xl shadow-slate-900/5">
          <h2 className="text-lg font-semibold text-slate-800">Conversation & results</h2>
          <div className="mt-4 max-h-[70vh] space-y-6 overflow-y-auto pr-1">
            {!hydrated ? (
              <p className="text-slate-500">Loading session…</p>
            ) : chatHistory.length === 0 && !loading ? (
              <p className="text-slate-500">
                Submit a question to retrieve ranked literature and trials, then read the
                structured synthesis and sources.
              </p>
            ) : null}
            {chatHistory.map((msg, idx) =>
              msg.role === 'user' ? (
                <UserBubble key={idx} content={msg.content} />
              ) : (
                <AssistantBubble
                  key={idx}
                  content={msg.content}
                  payload={msg.payload}
                  error={msg.error}
                  query={query}
                  disease={disease}
                />
              )
            )}
            {loading ? (
              <div className="flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sky-900">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
                <span className="font-medium">Analyzing research…</span>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}

function UserBubble({ content }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[92%] rounded-2xl rounded-br-md bg-slate-800 px-4 py-3 text-left text-sm text-white shadow-md">
        <pre className="whitespace-pre-wrap font-sans">{content}</pre>
      </div>
    </div>
  )
}

function AssistantBubble({ content, payload, error, query, disease }) {
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {content}
      </div>
    )
  }
  return (
    <div className="space-y-4 text-left">
      <div className="rounded-2xl rounded-bl-md border border-slate-100 bg-slate-50/90 px-4 py-3 text-sm text-slate-800 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-sky-700">
          Structured answer
        </h3>
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed">
          {content}
        </pre>
      </div>

      {payload?.sections?.conditionOverview ? (
        <SectionCard title="Overview" body={payload.sections.conditionOverview} />
      ) : null}

      {payload?.researchPapers?.length ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Research papers (ranked)</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {payload.researchPapers.map((p, i) => (
              <article
                key={i}
                className="flex flex-col rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-medium text-sky-700">{p.source}</p>
                <a
                  href={p.url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 font-semibold text-slate-900 hover:text-sky-700"
                >
                  {p.title}
                </a>
                <p className="mt-1 text-xs text-slate-500">
                  {(p.authors || []).slice(0, 3).join(', ')}
                  {p.year ? ` · ${p.year}` : ''}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {highlightTerms(snippet(p.abstract, 280), query, disease)}
                </p>
                <p className="mt-2 text-[11px] text-slate-400">
                  Score: {p.relevanceScore != null ? p.relevanceScore.toFixed(3) : '—'}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {payload?.clinicalTrials?.length ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Clinical trials (ranked)</h4>
          <div className="space-y-3">
            {payload.clinicalTrials.map((t, i) => (
              <article
                key={i}
                className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <a
                    href={t.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-emerald-900 hover:underline"
                  >
                    {t.title}
                  </a>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    {t.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  <span className="font-medium text-slate-700">Location:</span> {t.location || '—'}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {highlightTerms(snippet(t.eligibility, 240), query, disease)}
                </p>
                {t.contact ? (
                  <p className="mt-2 text-xs text-slate-500">Contact: {t.contact}</p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {payload?.sources?.length ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Sources</h4>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
            {payload.sources.map((s, i) => (
              <li key={i}>
                {s.url ? (
                  <a href={s.url} className="text-sky-700 hover:underline" target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
                {s.year ? ` (${s.year})` : ''}
                {s.type === 'trial' && s.status ? ` — ${s.status}` : ''}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {payload?.stats?.rawCounts ? (
        <p className="text-xs text-slate-400">
          Retrieved (before ranking): OpenAlex {payload.stats.rawCounts.openAlex}, PubMed{' '}
          {payload.stats.rawCounts.pubMed}, trials {payload.stats.rawCounts.clinicalTrials}; merged
          pubs {payload.stats.rawCounts.mergedPublications}.
        </p>
      ) : null}
    </div>
  )
}

function SectionCard({ title, body }) {
  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4">
      <h4 className="text-sm font-semibold text-sky-900">{title}</h4>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{body}</p>
    </div>
  )
}
