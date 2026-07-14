import { createServer, type Server } from 'node:http'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AddressInfo } from 'node:net'
import { app, ipcMain, safeStorage, shell } from 'electron'
import { OAuth2Client, type Credentials } from 'google-auth-library'
import type { GmailStatus } from '../../shared/types'

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
const CONNECT_TIMEOUT_MS = 2 * 60 * 1000

interface InstalledCreds {
  client_id: string
  client_secret: string
}

function credentialsPath(): string {
  return join(app.getPath('userData'), 'google-credentials.json')
}

function tokenPath(): string {
  return join(app.getPath('userData'), 'gmail-token.bin')
}

// Read the Desktop-app OAuth client the user downloaded from Google Cloud.
function loadClientCreds(): InstalledCreds {
  const path = credentialsPath()
  if (!existsSync(path)) {
    throw new Error(
      'google-credentials.json not found in the Otway app-support folder. Add your OAuth client file first.'
    )
  }
  const parsed = JSON.parse(readFileSync(path, 'utf-8'))
  const creds = parsed.installed ?? parsed.web
  if (!creds?.client_id || !creds?.client_secret) {
    throw new Error('google-credentials.json is missing client_id/client_secret.')
  }
  return { client_id: creds.client_id, client_secret: creds.client_secret }
}

// Tokens are encrypted with the OS keychain (macOS) via safeStorage, then
// written to the app-support folder — never in plain text, never in the repo.
function saveTokens(tokens: Credentials): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS secure storage is unavailable; cannot store Gmail token safely.')
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(tokens))
  writeFileSync(tokenPath(), encrypted)
}

function loadTokens(): Credentials | null {
  const path = tokenPath()
  if (!existsSync(path)) return null
  try {
    const decrypted = safeStorage.decryptString(readFileSync(path))
    return JSON.parse(decrypted) as Credentials
  } catch {
    return null
  }
}

function isConnected(): boolean {
  const tokens = loadTokens()
  return Boolean(tokens?.refresh_token)
}

/**
 * Build an OAuth client already primed with saved tokens. Returns null when
 * the user hasn't connected yet. Used from Day 7 onward to call the Gmail API;
 * google-auth-library refreshes the access token automatically.
 */
export function getAuthedClient(): OAuth2Client | null {
  const tokens = loadTokens()
  if (!tokens?.refresh_token) return null
  const { client_id, client_secret } = loadClientCreds()
  const client = new OAuth2Client({ clientId: client_id, clientSecret: client_secret })
  client.setCredentials(tokens)
  return client
}

let connecting = false

/**
 * Run the loopback OAuth flow: spin up a temporary localhost server, open the
 * system browser to Google's consent page (embedded webviews are blocked by
 * Google), capture the redirect, and exchange the code for tokens.
 */
async function connect(): Promise<GmailStatus> {
  if (connecting) return { connected: isConnected(), error: 'A sign-in is already in progress.' }
  connecting = true

  let server: Server | undefined
  try {
    const { client_id, client_secret } = loadClientCreds()

    server = createServer()
    await new Promise<void>((resolve, reject) => {
      server!.once('error', reject)
      server!.listen(0, '127.0.0.1', resolve)
    })
    const { port } = server.address() as AddressInfo
    const redirectUri = `http://127.0.0.1:${port}`

    const oauth2 = new OAuth2Client({
      clientId: client_id,
      clientSecret: client_secret,
      redirectUri
    })
    const authUrl = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // force a refresh_token every time
      scope: SCOPES
    })

    const codePromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out waiting for Google sign-in.')),
        CONNECT_TIMEOUT_MS
      )
      server!.on('request', (req, res) => {
        const requestUrl = new URL(req.url ?? '/', redirectUri)
        const code = requestUrl.searchParams.get('code')
        const error = requestUrl.searchParams.get('error')
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(
          `<!doctype html><meta charset="utf-8"><body style="font-family:-apple-system,sans-serif;text-align:center;padding:48px;color:#333">
           <h2>${code ? 'Otway is connected ✅' : 'Sign-in failed'}</h2>
           <p>You can close this tab and return to Otway.</p></body>`
        )
        clearTimeout(timeout)
        if (code) resolve(code)
        else reject(new Error(error ?? 'No authorization code returned.'))
      })
    })

    // Register the handler above, THEN open the browser so the redirect can't race.
    await shell.openExternal(authUrl)
    const code = await codePromise.finally(() => server?.close())

    const { tokens } = await oauth2.getToken(code)
    if (!tokens.refresh_token) {
      throw new Error('Google did not return a refresh token. Try disconnecting and reconnecting.')
    }
    saveTokens(tokens)
    return { connected: true }
  } catch (err) {
    server?.close()
    return { connected: isConnected(), error: err instanceof Error ? err.message : String(err) }
  } finally {
    connecting = false
  }
}

function disconnect(): GmailStatus {
  const path = tokenPath()
  if (existsSync(path)) rmSync(path)
  return { connected: false }
}

export function registerGmailIpc(): void {
  ipcMain.handle('gmail:status', (): GmailStatus => ({ connected: isConnected() }))
  ipcMain.handle('gmail:connect', () => connect())
  ipcMain.handle('gmail:disconnect', (): GmailStatus => disconnect())
}
