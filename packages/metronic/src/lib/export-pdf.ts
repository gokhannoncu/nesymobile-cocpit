/**
 * Downloads page content as an A4 PDF (no preview, direct download).
 *
 * Architecture:
 * 1. `main[role="content"]` is cloned from the live DOM and placed in an
 *    off-screen capture root — no flicker or visible change on screen.
 * 2. Inside the clone, all tab panels are revealed (they already exist in the
 *    DOM thanks to forceMount), a tab label heading is prepended to each panel,
 *    and framer-motion inline opacity/transform values are reset.
 * 3. NO CONTENT LOSS RULE: the clone is first measured at portrait width (1120px);
 *    if any element is horizontally clipped (truncated ellipsis, overflowing
 *    table/grid), the PDF switches to landscape orientation and the capture
 *    width is progressively increased until clipping is eliminated. No content
 *    is ever cut off or overlapped in the PDF.
 * 4. Canvas size is determined UP FRONT: content dimensions are measured and
 *    scale is computed against browser canvas limits (dimension + area).
 * 5. Rendered to a single canvas via html2canvas-pro (with oklch/color-mix
 *    support); dark theme is switched to light theme during rendering.
 * 6. The canvas is split into A4 pages; cut points are aligned to "blank"
 *    (uniform-color) rows via pixel analysis (content is never cut mid-line).
 */
import type { jsPDF } from 'jspdf'

/** Browser-specific; loaded only during export to avoid entering the SSR bundle. */
async function loadHtml2Canvas() {
  const { default: html2canvas } = await import('html2canvas-pro')
  return html2canvas
}

async function loadJsPDF() {
  const { jsPDF } = await import('jspdf')
  return jsPDF
}

/** Portrait mode capture width (px) — corresponds to A4 190mm print area at ~150dpi. */
const PORTRAIT_WIDTH = 1120

/**
 * Landscape mode width candidates (px). The first corresponds to 277mm,
 * maintaining the same font size as portrait 1120px; if clipping persists,
 * width is progressively increased.
 */
const LANDSCAPE_WIDTHS = [1584, 1920, 2320, 2800]

/** A4 dimensions (mm) and margins. */
const PAGE_SHORT = 210
const PAGE_LONG = 297
const MARGIN = 10

export type PdfOrientation = 'portrait' | 'landscape'

/** A4 print area (mm) for the chosen orientation. */
function contentSize(orientation: PdfOrientation): { w: number; h: number } {
  return orientation === 'portrait'
    ? { w: PAGE_SHORT - MARGIN * 2, h: PAGE_LONG - MARGIN * 2 } // 190×277
    : { w: PAGE_LONG - MARGIN * 2, h: PAGE_SHORT - MARGIN * 2 } // 277×190
}

/** Browser canvas safety limits (Safari/Chrome common lower bound). */
const MAX_CANVAS_DIM = 16384
const MAX_CANVAS_AREA = 100_000_000
const PREFERRED_SCALE = 2
const MIN_SCALE = 0.4

const STYLE_ID = 'nesy-pdf-capture-style'
const ROOT_CLASS = 'nesy-pdf-capture-root'

/**
 * Capture-root-specific CSS — does not affect the live page (scoped via class),
 * copied as a stylesheet into html2canvas's internal clone.
 */
const CAPTURE_CSS = `
.${ROOT_CLASS} { background: #ffffff; }
.${ROOT_CLASS} [data-pdf-exclude] { display: none !important; }
.${ROOT_CLASS} [data-slot="tabs-list"] { display: none !important; }
.${ROOT_CLASS} [data-slot="tabs-content"] { display: block !important; }
.${ROOT_CLASS} * { animation: none !important; transition: none !important; }
.${ROOT_CLASS} [style*="opacity"] { opacity: 1 !important; }
.${ROOT_CLASS} [style*="transform"] { transform: none !important; }
.${ROOT_CLASS} main { width: 100% !important; margin: 0 !important; padding: 28px !important; }
`

export function slugify(input: string): string {
  const slug = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'page'
}

/**
 * Canvas sizing algorithm: determines the render scale up front based on
 * content height. On long pages the scale is reduced so that browser canvas
 * limits (edge length and total area) are not exceeded.
 */
export function resolveCanvasScale(widthPx: number, heightPx: number): number {
  let scale = PREFERRED_SCALE
  scale = Math.min(scale, MAX_CANVAS_DIM / Math.max(heightPx, 1))
  scale = Math.min(scale, MAX_CANVAS_DIM / Math.max(widthPx, 1))
  scale = Math.min(scale, Math.sqrt(MAX_CANVAS_AREA / Math.max(widthPx * heightPx, 1)))
  return Math.max(MIN_SCALE, Math.floor(scale * 100) / 100)
}

function ensureCaptureStyle(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CAPTURE_CSS
  document.head.appendChild(style)
}

/** Prepends a heading with the associated tab label to each tab panel. */
function injectTabHeadings(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-slot="tabs"]').forEach((tabs) => {
    const triggers = Array.from(tabs.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]'))
    if (triggers.length < 2) return

    const labelByPanelId = new Map<string, string>()
    triggers.forEach((trigger) => {
      const panelId = trigger.getAttribute('aria-controls')
      const label = trigger.textContent?.trim()
      if (panelId && label) labelByPanelId.set(panelId, label)
    })

    let order = 0
    tabs.querySelectorAll<HTMLElement>('[data-slot="tabs-content"]').forEach((panel) => {
      const label = labelByPanelId.get(panel.id)
      if (!label) return
      order += 1
      const heading = panel.ownerDocument.createElement('div')
      heading.textContent = `${order}. ${label}`
      heading.setAttribute(
        'style',
        'display:block;margin:20px 0 12px;padding:9px 14px;border:1px solid #d4d4d8;' +
          'border-radius:10px;background:#f4f4f5;color:#18181b;font-size:14px;' +
          'font-weight:600;line-height:1.3;',
      )
      panel.insertBefore(heading, panel.firstChild)
    })
  })
}

/**
 * Clones the content and creates an off-screen capture root (width is set later).
 * `source` may come from another document (e.g. an iframe), so `document.importNode`
 * is used instead of `cloneNode` — the node is adapted to the main document.
 */
function buildCaptureRoot(source: HTMLElement, opts?: { pad?: boolean }): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = ROOT_CLASS
  wrapper.setAttribute('aria-hidden', 'true')
  wrapper.setAttribute(
    'style',
    `position:fixed;top:0;left:-100000px;width:${PORTRAIT_WIDTH}px;z-index:-1;background:#ffffff;` +
      // When capturing a single section (slide), the `main` rule's padding does not apply;
      // we provide the white border via the wrapper instead.
      (opts?.pad ? 'padding:28px;' : ''),
  )
  const clone = document.importNode(source, true) as HTMLElement
  wrapper.appendChild(clone)
  injectTabHeadings(wrapper)
  return wrapper
}

/**
 * Counts the number of horizontally clipped elements: elements with truncated
 * ellipsis, overflowing tables/grids whose content is actually cut off
 * (overflow-x !== visible). No content loss is allowed in the PDF — width is
 * increased until this count reaches zero.
 */
function countClippedElements(root: HTMLElement): number {
  let clipped = 0
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.clientWidth > 0 && el.scrollWidth - el.clientWidth > 2) {
      if (getComputedStyle(el).overflowX !== 'visible') clipped += 1
    }
  })
  return clipped
}

/**
 * No content loss rule: if clipping exists at portrait width (1120px), switches
 * to landscape mode and progressively increases capture width until no clipped
 * elements remain. If clipping persists even at the widest candidate, the
 * widest candidate is used (minimal loss).
 */
function resolveLayout(captureRoot: HTMLElement): { orientation: PdfOrientation; width: number } {
  if (countClippedElements(captureRoot) === 0) {
    return { orientation: 'portrait', width: PORTRAIT_WIDTH }
  }

  let width = LANDSCAPE_WIDTHS[LANDSCAPE_WIDTHS.length - 1] ?? PORTRAIT_WIDTH
  for (const candidate of LANDSCAPE_WIDTHS) {
    captureRoot.style.width = `${candidate}px`
    void captureRoot.offsetHeight // reflow — measurements use the new width
    if (countClippedElements(captureRoot) === 0) {
      width = candidate
      break
    }
  }
  captureRoot.style.width = `${width}px`
  void captureRoot.offsetHeight
  return { orientation: 'landscape', width }
}

/** Waits for fonts and images in the clone to be ready (before height measurement). */
async function waitForAssets(root: HTMLElement): Promise<void> {
  try {
    await document.fonts.ready
  } catch {
    /* fonts API not available, continue */
  }
  const images = Array.from(root.querySelectorAll('img'))
  await Promise.allSettled(
    images.map((img) => (typeof img.decode === 'function' ? img.decode() : Promise.resolve())),
  )
}

/** Checks whether a row is visually "blank" (uniform color) by sampling pixels. */
function isUniformRow(data: Uint8ClampedArray, rowOffset: number, width: number): boolean {
  const r0 = data[rowOffset] ?? 255
  const g0 = data[rowOffset + 1] ?? 255
  const b0 = data[rowOffset + 2] ?? 255
  for (let x = 8; x < width; x += 8) {
    const i = rowOffset + x * 4
    if (
      Math.abs((data[i] ?? 255) - r0) > 6 ||
      Math.abs((data[i + 1] ?? 255) - g0) > 6 ||
      Math.abs((data[i + 2] ?? 255) - b0) > 6
    ) {
      return false
    }
  }
  return true
}

/**
 * Smart page break: scans upward from the target cut point to find the first
 * row that contains no content (uniform color); if none is found, cuts at the target.
 */
function findPageBreak(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  targetY: number,
  minY: number,
): number {
  if (targetY <= minY) return targetY
  const region = ctx.getImageData(0, minY, canvasWidth, targetY - minY)
  for (let y = targetY - 1; y >= minY; y -= 2) {
    const rowOffset = (y - minY) * canvasWidth * 4
    if (isUniformRow(region.data, rowOffset, canvasWidth)) return y
  }
  return targetY
}

/** A single page ready to be added to the PDF: JPEG data URL + layout size (mm) + orientation. */
export interface PdfPage {
  dataUrl: string
  orientation: PdfOrientation
  /** Placement width on the page (mm) — equals the print area width. */
  wMm: number
  /** Placement height on the page (mm). */
  hMm: number
}

/**
 * Splits a canvas into A4 print-area pages and produces a PDF-ready image
 * (JPEG data URL) for each page. Cut points are aligned to "blank" rows
 * via pixel analysis; content is never cut mid-line.
 */
export function canvasToPdfPages(
  canvas: HTMLCanvasElement,
  orientation: PdfOrientation,
): PdfPage[] {
  const { w: contentW, h: contentH } = contentSize(orientation)
  const pxPerMm = canvas.width / contentW
  const pageHeightPx = Math.floor(contentH * pxPerMm)
  const ctx = canvas.getContext('2d')
  const pages: PdfPage[] = []

  let y = 0
  while (y < canvas.height) {
    let end = Math.min(y + pageHeightPx, canvas.height)
    if (end < canvas.height && ctx) {
      // Search for a blank row ensuring at least 65% of the page is filled.
      const minY = y + Math.floor(pageHeightPx * 0.65)
      end = findPageBreak(ctx, canvas.width, end, minY)
    }
    const sliceHeight = end - y
    if (sliceHeight <= 0) break

    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = sliceHeight
    const sliceCtx = slice.getContext('2d')
    if (!sliceCtx) break
    sliceCtx.fillStyle = '#ffffff'
    sliceCtx.fillRect(0, 0, slice.width, slice.height)
    sliceCtx.drawImage(canvas, 0, y, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)

    pages.push({
      dataUrl: slice.toDataURL('image/jpeg', 0.92),
      orientation,
      wMm: contentW,
      hMm: sliceHeight / pxPerMm,
    })
    y = end
  }

  return pages
}

/**
 * Splits a canvas into A4 slices and appends them to an EXISTING jsPDF document.
 * Page orientation may vary per page (`addPage('a4', orientation)`).
 * If `skipFirstAddPage` is true, the first slice is written to the document's
 * existing (constructor) page — preventing an extra blank page for single-page exports.
 */
export function appendCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  orientation: PdfOrientation,
  opts?: { skipFirstAddPage?: boolean },
): void {
  const pages = canvasToPdfPages(canvas, orientation)
  pages.forEach((pg, index) => {
    if (!(index === 0 && opts?.skipFirstAddPage)) pdf.addPage('a4', pg.orientation)
    pdf.addImage(pg.dataUrl, 'JPEG', MARGIN, MARGIN, pg.wMm, pg.hMm)
  })
}

/**
 * Clones a source element off-screen, resolves its orientation (portrait/landscape)
 * based on content, and renders it to a single canvas via html2canvas. The source
 * may come from another document (e.g. an iframe). Dark theme is switched to
 * light theme during rendering.
 */
export async function captureElementToCanvas(
  source: HTMLElement,
  opts?: { pad?: boolean },
): Promise<{ canvas: HTMLCanvasElement; orientation: PdfOrientation }> {
  ensureCaptureStyle()
  const captureRoot = buildCaptureRoot(source, opts)
  document.body.appendChild(captureRoot)

  try {
    await waitForAssets(captureRoot)

    // No content loss rule: switch to landscape if clipping exists and increase width.
    const { orientation, width } = resolveLayout(captureRoot)

    const height = Math.ceil(captureRoot.scrollHeight)
    const scale = resolveCanvasScale(width, height)

    const html2canvas = await loadHtml2Canvas()
    const canvas = await html2canvas(captureRoot, {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      onclone: (clonedDoc: Document) => {
        // Print is always rendered in light theme, even in dark mode.
        clonedDoc.documentElement.classList.remove('dark')
        clonedDoc.documentElement.style.colorScheme = 'light'
      },
    })

    return { canvas, orientation }
  } finally {
    captureRoot.remove()
  }
}

export interface ExportPageToPdfOptions {
  /** PDF title and file name source — typically the active breadcrumb. */
  title: string
}

/**
 * PowerPoint 16:9 widescreen slide canvas (mm) — 13.333 in × 7.5 in.
 * Not A4 paper; this is the presentation canvas size. Equals 960 × 540 pt.
 */
const SLIDE_W_MM = 338.667
const SLIDE_H_MM = 190.5
const SLIDE_MARGIN = 10

/**
 * Structured (slide) export: each `[data-pdf-slide]` section is placed on its
 * own 16:9 presentation slide — not A4 paper, but a PowerPoint canvas size.
 * Each section is contain-fitted and centered to exactly one slide; content is
 * never clipped. Sections are processed in DOM order; optionally reordered via
 * `data-pdf-slide-order` without breaking the sequence.
 */
export async function exportSlidesToPdf({
  title,
  slides,
}: {
  title: string
  slides: HTMLElement[]
}): Promise<void> {
  if (slides.length === 0) throw new Error('No slides found to capture')

  const JsPDF = await loadJsPDF()
  const format: [number, number] = [SLIDE_W_MM, SLIDE_H_MM]
  const areaW = SLIDE_W_MM - SLIDE_MARGIN * 2
  const areaH = SLIDE_H_MM - SLIDE_MARGIN * 2
  let pdf: jsPDF | null = null

  for (const slide of slides) {
    // Orientation (portrait/landscape) is resolved during capture to prevent
    // content clipping; slide placement always uses contain-fit on the 16:9 canvas.
    const { canvas } = await captureElementToCanvas(slide)

    // Contain-fit the entire section to the slide (preserve aspect ratio), then center.
    const fit = Math.min(areaW / canvas.width, areaH / canvas.height)
    const wMm = canvas.width * fit
    const hMm = canvas.height * fit
    const x = (SLIDE_W_MM - wMm) / 2
    const y = (SLIDE_H_MM - hMm) / 2
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

    if (!pdf) {
      // First slide is written to the document's constructor page (no extra blank page).
      pdf = new JsPDF({ orientation: 'landscape', unit: 'mm', format, compress: true })
      pdf.setProperties({ title })
    } else {
      pdf.addPage(format, 'landscape')
    }
    pdf.addImage(dataUrl, 'JPEG', x, y, wMm, hMm)
  }

  const date = new Date().toISOString().slice(0, 10)
  pdf!.save(`nesy-${slugify(title)}-${date}.pdf`)
}

/**
 * Downloads the active page's content area as an A4 PDF.
 *
 * Two modes: if page sections are marked with `data-pdf-slide`, STRUCTURED
 * (slide) mode is used — each section starts on its own page. If no markers
 * exist, the page is captured as a single continuous flow and split into
 * A4 pages (default).
 */
export async function exportPageToPdf({ title }: ExportPageToPdfOptions): Promise<void> {
  const source = document.querySelector<HTMLElement>('main[role="content"]')
  if (!source) throw new Error('Page content area (main[role="content"]) not found')

  // Structured mode: one slide per section.
  const slideNodes = Array.from(source.querySelectorAll<HTMLElement>('[data-pdf-slide]')).filter(
    (el) => !el.closest('[data-pdf-exclude]'),
  )
  if (slideNodes.length > 0) {
    slideNodes.sort(
      (a, b) => Number(a.dataset.pdfSlideOrder ?? 0) - Number(b.dataset.pdfSlideOrder ?? 0),
    )
    await exportSlidesToPdf({ title, slides: slideNodes })
    return
  }

  // Default: continuous flow.
  const { canvas, orientation } = await captureElementToCanvas(source)

  const JsPDF = await loadJsPDF()
  const pdf = new JsPDF({ orientation, unit: 'mm', format: 'a4', compress: true })
  pdf.setProperties({ title })
  appendCanvasToPdf(pdf, canvas, orientation, { skipFirstAddPage: true })

  const date = new Date().toISOString().slice(0, 10)
  pdf.save(`nesy-${slugify(title)}-${date}.pdf`)
}
