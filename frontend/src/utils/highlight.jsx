/**
 * Highlights query terms in text (bonus: snippet emphasis).
 */
export function highlightTerms(text, query, disease) {
  if (!text) return null
  const terms = [...new Set([...tokenize(query), ...tokenize(disease)])].filter(
    (t) => t.length > 2
  )
  if (!terms.length) return text
  const pattern = new RegExp(`(${terms.map(escapeReg).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return parts.map((part, i) => {
    const match = terms.some((t) => part.toLowerCase() === t.toLowerCase())
    if (match) {
      return (
        <mark
          key={i}
          className="rounded bg-amber-100 px-0.5 text-slate-900"
        >
          {part}
        </mark>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function tokenize(s) {
  if (!s) return []
  return String(s)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function snippet(text, max = 220) {
  if (!text) return ''
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}
