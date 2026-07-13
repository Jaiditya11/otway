import { nativeImage, type NativeImage } from 'electron'

// A small package/box glyph, generated as a black + alpha PNG. Because it's
// flagged as a macOS *template* image, the OS recolors it automatically to
// match the menu bar in light and dark mode. Inlined as base64 so there are no
// asset-path differences between `dev` and a packaged build.
const ICON_16 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVR42mNgGHbgP5EYrwGExEaCAaOBSGEYDEEAAP2hMs4W8hLUAAAAAElFTkSuQmCC'
const ICON_32 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAOElEQVR42u3UwQkAMAgEQftvOtYgGDFkFvzKvC5CWtq5dO8BKtCOfwAAAPsAltAUAwAA/DtE0lgJaUICDbrpNEYAAAAASUVORK5CYII='

export function createTrayIcon(): NativeImage {
  const image = nativeImage.createFromBuffer(Buffer.from(ICON_16, 'base64'))
  image.addRepresentation({
    scaleFactor: 2,
    buffer: Buffer.from(ICON_32, 'base64')
  })
  image.setTemplateImage(true)
  return image
}
