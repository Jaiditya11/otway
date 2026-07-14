import { getAuthedClient } from './auth'
import type { OrderStore } from '../store'

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'
const MAX_RESULTS = 25
const DEFAULT_WINDOW_DAYS = 30

export interface FetchedEmail {
  id: string
  from: string
  subject: string
  date: string // ISO 8601, from Gmail internalDate
  internalDate: number // epoch ms
  text: string // plain-text body, HTML stripped
}

interface GmailPart {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPart[]
  headers?: Array<{ name: string; value: string }>
}

function decodeBody(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8')
}

// Depth-first search for the first part of a given MIME type that has a body.
function findPart(payload: GmailPart, mime: string): string | null {
  if (payload.mimeType === mime && payload.body?.data) return decodeBody(payload.body.data)
  for (const part of payload.parts ?? []) {
    const found = findPart(part, mime)
    if (found) return found
  }
  return null
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

// Prefer text/plain; fall back to stripped text/html (guardrail #4: plain text only).
function extractPlainText(payload: GmailPart): string {
  const plain = findPart(payload, 'text/plain')
  if (plain) return plain.replace(/\s+/g, ' ').trim()
  const html = findPart(payload, 'text/html')
  if (html) return stripHtml(html)
  return ''
}

/**
 * Fetch Purchases-category emails newer than the last processed timestamp
 * (or the last 30 days on first run), as clean plain text. Read-only; does not
 * advance the store or update the timestamp — that happens during matching.
 * Returns [] when Gmail isn't connected.
 */
export async function fetchNewPurchaseEmails(store: OrderStore): Promise<FetchedEmail[]> {
  const client = getAuthedClient()
  if (!client) return []

  const last = store.getLastProcessedEmailTimestamp()
  const lastMs = last ? new Date(last).getTime() : null
  const afterEpoch = lastMs
    ? Math.floor(lastMs / 1000)
    : Math.floor((Date.now() - DEFAULT_WINDOW_DAYS * 86_400_000) / 1000)

  const query = `category:purchases after:${afterEpoch}`
  const list = await client.request<{ messages?: Array<{ id: string }> }>({
    url: `${GMAIL}/messages?q=${encodeURIComponent(query)}&maxResults=${MAX_RESULTS}`
  })
  const ids = (list.data.messages ?? []).map((m) => m.id)

  const emails: FetchedEmail[] = []
  for (const id of ids) {
    const full = await client.request<{
      internalDate: string
      payload: GmailPart
    }>({ url: `${GMAIL}/messages/${id}?format=full` })

    const internalDate = Number(full.data.internalDate)
    // `after:` is day-granular, so filter precisely on our side.
    if (lastMs && internalDate <= lastMs) continue

    const headers = new Map(
      (full.data.payload.headers ?? []).map((h) => [h.name.toLowerCase(), h.value])
    )
    emails.push({
      id,
      from: headers.get('from') ?? '',
      subject: headers.get('subject') ?? '',
      date: new Date(internalDate).toISOString(),
      internalDate,
      text: extractPlainText(full.data.payload)
    })
  }

  emails.sort((a, b) => a.internalDate - b.internalDate)
  return emails
}
