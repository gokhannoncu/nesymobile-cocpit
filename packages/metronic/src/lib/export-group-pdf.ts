/**
 * Downloads ALL pages of a workspace group (e.g. Engineering) as a single
 * combined PDF. Reuses the single-page export engine (`export-pdf.ts`):
 * each page is loaded in a hidden iframe, the `main[role="content"]` area
 * is captured with the same html2canvas-based engine — preserving per-page
 * portrait/landscape decisions, smart page breaks, and the no-content-loss rule.
 *
 * PDF structure: [Cover] · [Table of Contents] · [each page, in sidebar order].
 * Cover and TOC are also produced with the same engine (DOM → canvas), avoiding
 * embedded font Turkish glyph issues in jsPDF. Absolute page numbers are stamped
 * on content pages (digits only → font-safe).
 */
import type { jsPDF } from 'jspdf'
import type { Workspace } from '@nesy/metronic/config/types'
import { getWorkspacePages, type WorkspacePageRef } from '@nesy/metronic/config/menu-utils'
import {
  captureElementToCanvas,
  canvasToPdfPages,
  slugify,
  type PdfPage,
} from '@nesy/metronic/lib/export-pdf'

/** Maximum number of rows kept on a single TOC page (fits A4 portrait). */
const TOC_ROWS_PER_PAGE = 30

/** Maximum time (ms) for a page to load and settle. */
const PAGE_TIMEOUT_MS = 25_000

const A4_MARGIN_MM = 10

export interface GroupExportProgress {
  /** Current page being processed (1-based). */
  current: number
  total: number
  /** Title of the page currently being processed. */
  title: string
  stage: 'loading' | 'rendering' | 'finalizing'
}

export interface GroupExportResult {
  /** Number of pages added to the PDF. */
  exported: number
  /** Pages that failed to load or render and were skipped. */
  skipped: { path: string; title: string; reason: string }[]
}

/** Creates a hidden, off-screen iframe (reused for each page). */
function createHiddenIframe(): HTMLIFrameElement {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute(
    'style',
    'position:fixed;top:0;left:-100000px;width:1440px;height:900px;border:0;visibility:hidden;',
  )
  document.body.appendChild(iframe)
  return iframe
}

/** Waits (polling) until a selector appears in the given document. */
function waitForSelector(doc: Document, selector: string, timeoutMs: number): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      const el = doc.querySelector<HTMLElement>(selector)
      if (el) {
        resolve(el)
        return
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`"${selector}" timed out`))
        return
      }
      requestAnimationFrame(tick)
    }
    tick()
  })
}

/** Waits two animation frames to allow hydration/animation to settle. */
function nextFrames(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

/** Loads a page in the iframe and returns the ready `main[role="content"]` element. */
async function loadPageContent(
  iframe: HTMLIFrameElement,
  path: string,
  timeoutMs: number,
): Promise<HTMLElement> {
  const loaded = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('iframe load timed out')), timeoutMs)
    iframe.addEventListener(
      'load',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })

  iframe.src = path
  await loaded

  const doc = iframe.contentDocument
  if (!doc) throw new Error('Unable to access iframe document')

  const main = await waitForSelector(doc, 'main[role="content"]', timeoutMs)

  try {
    await doc.fonts?.ready
  } catch {
    /* fonts API not available, continue */
  }
  // Short delay for React hydration + framer-motion initial styles to settle.
  await new Promise((r) => setTimeout(r, 400))
  await nextFrames()

  return main
}

/** Common page body style (inline — not dependent on Tailwind, deterministic). */
const PAGE_STYLE =
  'width:1120px;background:#ffffff;color:#18181b;box-sizing:border-box;' +
  "font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;"

/** Builds the cover page DOM. */
function buildCoverDom(workspace: Workspace, date: string, pageCount: number, sectionCount: number): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute(
    'style',
    PAGE_STYLE + 'min-height:1480px;padding:88px 76px;display:flex;flex-direction:column;',
  )
  el.innerHTML = `
    <div style="font-size:13px;letter-spacing:0.22em;text-transform:uppercase;color:#71717a;font-weight:700;">
      Nesy Mobile Cockpit
    </div>
    <div style="margin-top:auto;">
      <div style="font-size:54px;font-weight:800;line-height:1.08;">${escapeHtml(workspace.label)}</div>
      <div style="font-size:21px;color:#52525b;margin-top:18px;">All pages — combined document</div>
    </div>
    <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;
                font-size:14px;color:#71717a;border-top:1px solid #e4e4e7;padding-top:22px;">
      <span>${escapeHtml(date)}</span>
      <span>${pageCount} pages · ${sectionCount} sections</span>
    </div>`
  return el
}

interface TocEntry {
  title: string
  page: number
}

/** Builds a Table of Contents page (chunk) DOM. */
function buildTocDom(entries: TocEntry[], continued: boolean): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('style', PAGE_STYLE + 'padding:64px 76px;')
  const rows = entries
    .map(
      (e) => `
      <div style="display:flex;justify-content:space-between;gap:20px;align-items:baseline;
                  padding:11px 0;border-bottom:1px solid #f4f4f5;font-size:16px;">
        <span style="min-width:0;">${escapeHtml(e.title)}</span>
        <span style="color:#71717a;font-variant-numeric:tabular-nums;flex-shrink:0;">${e.page}</span>
      </div>`,
    )
    .join('')
  el.innerHTML = `
    <div style="font-size:13px;letter-spacing:0.22em;text-transform:uppercase;color:#71717a;font-weight:700;">
      Table of Contents${continued ? ' (continued)' : ''}
    </div>
    <div style="margin-top:26px;">${rows}</div>`
  return el
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Converts a DOM node into portrait A4 pages (PdfPage[]). */
async function domToPdfPages(el: HTMLElement): Promise<PdfPage[]> {
  const { canvas } = await captureElementToCanvas(el)
  // Cover/TOC are kept short so they fit on a single page; if they do overflow,
  // canvasToPdfPages returns the correct number of pages (portrait is always forced).
  return canvasToPdfPages(canvas, 'portrait')
}

/**
 * Downloads all pages of a workspace group as a single PDF.
 * If a page fails to load or render, it is skipped and reported in `skipped`.
 */
export async function exportGroupToPdf(opts: {
  workspace: Workspace
  onProgress?: (p: GroupExportProgress) => void
}): Promise<GroupExportResult> {
  const { workspace, onProgress } = opts
  const pages: WorkspacePageRef[] = getWorkspacePages(workspace)
  const skipped: GroupExportResult['skipped'] = []
  const iframe = createHiddenIframe()

  try {
    // 1) Load and capture each content page.
    const groups: { item: WorkspacePageRef; pages: PdfPage[] }[] = []
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]!
      onProgress?.({ current: i + 1, total: pages.length, title: page.title, stage: 'loading' })
      try {
        const main = await loadPageContent(iframe, page.path, PAGE_TIMEOUT_MS)
        onProgress?.({ current: i + 1, total: pages.length, title: page.title, stage: 'rendering' })
        const { canvas, orientation } = await captureElementToCanvas(main)
        const pdfPages = canvasToPdfPages(canvas, orientation)
        if (pdfPages.length === 0) throw new Error('empty render')
        groups.push({ item: page, pages: pdfPages })
      } catch (error) {
        skipped.push({ path: page.path, title: page.title, reason: (error as Error).message })
      }
    }

    if (groups.length === 0) {
      throw new Error('No pages could be rendered')
    }

    onProgress?.({ current: pages.length, total: pages.length, title: '', stage: 'finalizing' })

    // 2) Block-relative start numbers for content pages (1-based).
    const relStart: number[] = []
    let rel = 1
    for (const g of groups) {
      relStart.push(rel)
      rel += g.pages.length
    }

    const date = new Date().toISOString().slice(0, 10)

    // 3) Cover (need its page count first for absolute page numbers).
    const coverPages = await domToPdfPages(
      buildCoverDom(workspace, date, rel - 1, groups.length),
    )

    // 4) Table of Contents — chunk count is deterministic; absolute number = frontCount + relStart.
    const tocChunks = chunk(groups, TOC_ROWS_PER_PAGE)
    const frontCount = coverPages.length + tocChunks.length
    const tocPages: PdfPage[] = []
    for (let c = 0; c < tocChunks.length; c++) {
      const entries: TocEntry[] = tocChunks[c]!.map((g, idxInChunk) => {
        const globalIdx = c * TOC_ROWS_PER_PAGE + idxInChunk
        return { title: g.item.title, page: frontCount + relStart[globalIdx]! }
      })
      const rendered = await domToPdfPages(buildTocDom(entries, c > 0))
      tocPages.push(...rendered)
    }

    // 5) Append all pages sequentially to a single jsPDF: cover → TOC → content.
    const contentPages = groups.flatMap((g) => g.pages)
    const allPages: PdfPage[] = [...coverPages, ...tocPages, ...contentPages]

    const { jsPDF: JsPDF } = await import('jspdf')
    const pdf = new JsPDF({
      orientation: allPages[0]!.orientation,
      unit: 'mm',
      format: 'a4',
      compress: true,
    })
    pdf.setProperties({ title: `${workspace.label} — All Pages` })

    allPages.forEach((pg, index) => {
      if (index > 0) pdf.addPage('a4', pg.orientation)
      pdf.addImage(pg.dataUrl, 'JPEG', A4_MARGIN_MM, A4_MARGIN_MM, pg.wMm, pg.hMm)
    })

    // 6) Stamp absolute page numbers on content pages (digits only → font-safe).
    const contentStartAbs = coverPages.length + tocPages.length + 1
    for (let p = contentStartAbs; p <= allPages.length; p++) {
      pdf.setPage(p)
      const w = pdf.internal.pageSize.getWidth()
      const h = pdf.internal.pageSize.getHeight()
      pdf.setFontSize(9)
      pdf.setTextColor(140)
      pdf.text(String(p), w / 2, h - 5, { align: 'center' })
    }

    pdf.save(`nesy-${slugify(workspace.label)}-all-pages-${date}.pdf`)

    return { exported: contentPages.length, skipped }
  } finally {
    iframe.remove()
  }
}
