export type DeviceOrientation = 'PORTRAIT' | 'LANDSCAPE'

export interface DeviceInsets {
  left: number
  top: number
  right: number
  bottom: number
}

/** Bridge LTRB bounds in device coordinates. */
export interface BridgeBoundsLtrb {
  left: number
  top: number
  right: number
  bottom: number
}

export interface ViewportRect {
  x: number
  y: number
  width: number
  height: number
}

export interface MapBoundsInput {
  /** LTRB device bounds (Bridge). */
  bounds: BridgeBoundsLtrb
  orientation: DeviceOrientation
  /** When false, insets are ignored (toolbar "Insets Mapped" off). */
  applyInsets: boolean
  insets: DeviceInsets
  screenshotWidth: number
  screenshotHeight: number
  viewportWidth: number
  viewportHeight: number
}

/**
 * Map device BridgeBounds into viewport CSS pixels using orientation, insets, and screenshot scale.
 */
export function mapDeviceBoundsToViewport(input: MapBoundsInput): ViewportRect {
  let left = input.bounds.left
  let top = input.bounds.top
  let right = input.bounds.right
  let bottom = input.bounds.bottom

  if (input.applyInsets) {
    left = Math.max(0, left - input.insets.left)
    top = Math.max(0, top - input.insets.top)
    right = Math.max(left, right - input.insets.left)
    bottom = Math.max(top, bottom - input.insets.top)
  }

  // Landscape: rotate portrait device coords into landscape screenshot space (90° CW).
  if (input.orientation === 'LANDSCAPE') {
    const devicePortraitWidth = input.screenshotHeight
    const nl = top
    const nt = devicePortraitWidth - right
    const nr = bottom
    const nb = devicePortraitWidth - left
    left = nl
    top = nt
    right = nr
    bottom = nb
  }

  const scaleX = input.viewportWidth / Math.max(1, input.screenshotWidth)
  const scaleY = input.viewportHeight / Math.max(1, input.screenshotHeight)

  return {
    x: left * scaleX,
    y: top * scaleY,
    width: Math.max(0, (right - left) * scaleX),
    height: Math.max(0, (bottom - top) * scaleY),
  }
}

/** Convert overlay xywh sample nodes into LTRB for the mapper. */
export function xywhToLtrb(
  x: number,
  y: number,
  w: number,
  h: number,
): BridgeBoundsLtrb {
  return { left: x, top: y, right: x + w, bottom: y + h }
}
