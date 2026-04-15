import axios from 'axios'

const baseURL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || ''

export const api = axios.create({
  baseURL: baseURL || undefined,
  headers: { 'Content-Type': 'application/json' },
  timeout: 180000,
})

export async function postResearch(payload) {
  const { data } = await api.post('/api/research', payload)
  return data
}

export async function getSession(sessionId) {
  const { data } = await api.get(`/api/session/${sessionId}`)
  return data
}
