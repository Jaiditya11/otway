import { app, BrowserWindow, Tray, Menu, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createTrayIcon } from './tray-icon'

let tray: Tray | null = null
let popover: BrowserWindow | null = null
// Timestamp of the last blur-triggered hide, used to make clicking the tray
// icon while the popover is open close it (rather than immediately reopen it).
let lastHiddenAt = 0

const POPOVER_WIDTH = 360
const POPOVER_HEIGHT = 460

function createPopover(): BrowserWindow {
  const win = new BrowserWindow({
    width: POPOVER_WIDTH,
    height: POPOVER_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Show the popover on top of whatever the user is doing, including full-screen apps.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Click-away closes the popover.
  win.on('blur', () => {
    if (win.webContents.isDevToolsOpened()) return
    win.hide()
    lastHiddenAt = Date.now()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

// Center the popover horizontally under the tray icon, clamped on-screen.
function positionPopover(): void {
  if (!tray || !popover) return
  const trayBounds = tray.getBounds()
  const { width } = popover.getBounds()
  const { workArea } = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - width / 2)
  const minX = workArea.x + 8
  const maxX = workArea.x + workArea.width - width - 8
  x = Math.min(Math.max(x, minX), maxX)
  const y = Math.round(trayBounds.y + trayBounds.height + 4)

  popover.setPosition(x, y, false)
}

function showPopover(): void {
  if (!popover) return
  positionPopover()
  popover.show()
  popover.focus()
}

function togglePopover(): void {
  if (!popover) return
  if (popover.isVisible()) {
    popover.hide()
    return
  }
  // If a blur (from this very click on the tray) just hid the popover,
  // swallow the click so it stays closed instead of flickering back open.
  if (Date.now() - lastHiddenAt < 250) return
  showPopover()
}

function buildContextMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: 'Open Otway', click: () => showPopover() },
    { type: 'separator' },
    { label: 'Quit Otway', accelerator: 'Command+Q', click: () => app.quit() }
  ])
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('app.otway')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Menu-bar-only app for v1: no Dock icon, no app-switcher entry.
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  popover = createPopover()

  tray = new Tray(createTrayIcon())
  tray.setToolTip('Otway')
  tray.on('click', togglePopover)
  tray.on('right-click', () => tray?.popUpContextMenu(buildContextMenu()))
})

// The app lives in the menu bar; hiding the popover must not quit it.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
