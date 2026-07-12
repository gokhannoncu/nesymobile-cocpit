/**
 * Bir workspace grubunun (ör. Engineering) TÜM sayfalarını tek bir birleşik PDF
 * olarak indirir. Tek-sayfa export motorunu (`export-pdf.ts`) yeniden kullanır:
 * her sayfa gizli bir iframe'de yüklenir, `main[role="content"]` alanı aynı
 * html2canvas tabanlı motorla yakalanır — böylece sayfa bazında dikey/yatay
 * kararı, akıllı sayfa sonu ve içerik kaybı yasağı aynen korunur.
 *
 * PDF yapısı: [Kapak] · [İçindekiler] · [her sayfa, sidebar sırasıyla].
 * Kapak ve içindekiler de aynı motorla (DOM → canvas) üretilir; bu sayede jsPDF
 * gömülü fontunun Türkçe glif sorunları yaşanmaz. İçerik sayfalarına mutlak
 * sayfa numarası basılır (yalnızca rakam → font güvenli).
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

/** İçindekiler tek sayfada tutulan azami satır sayısı (A4 dikey sığar). */
const TOC_ROWS_PER_PAGE = 30

/** Bir sayfanın yüklenmesi + yerleşmesi için azami süre (ms). */
const PAGE_TIMEOUT_MS = 25_000

const A4_MARGIN_MM = 10

export interface GroupExportProgress {
  /** İşlenen sayfa sırası (1 tabanlı). */
  current: number
  total: number
  /** O an işlenen sayfanın başlığı. */
  title: string
  stage: 'loading' | 'rendering' | 'finalizing'
}

export interface GroupExportResult {
  /** PDF'e eklenen sayfa sayısı. */
  exported: number
  /** Yüklenemeyen / render edilemeyen ve atlanan sayfalar. */
  skipped: { path: string; title: string; reason: string }[]
}

/** Ekran dışı, gizli bir iframe oluşturur (her sayfa için yeniden kullanılır). */
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

/** Verilen document içinde bir seçici görünene kadar bekler (poll). */
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
        reject(new Error(`"${selector}" zaman aşımına uğradı`))
        return
      }
      requestAnimationFrame(tick)
    }
    tick()
  })
}

/** İki animasyon karesi bekleyerek hydration/animasyon yerleşmesine izin verir. */
function nextFrames(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

/** Bir sayfayı iframe'de yükler ve `main[role="content"]` içeriğini hazır döndürür. */
async function loadPageContent(
  iframe: HTMLIFrameElement,
  path: string,
  timeoutMs: number,
): Promise<HTMLElement> {
  const loaded = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('iframe yükleme zaman aşımı')), timeoutMs)
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
  if (!doc) throw new Error('iframe belgesine erişilemedi')

  const main = await waitForSelector(doc, 'main[role="content"]', timeoutMs)

  try {
    await doc.fonts?.ready
  } catch {
    /* fonts API yoksa devam */
  }
  // React hydration + framer-motion başlangıç stillerinin yerleşmesi için kısa bekleme.
  await new Promise((r) => setTimeout(r, 400))
  await nextFrames()

  return main
}

/** Ortak sayfa gövdesi stili (inline — Tailwind'e bağımlı değil, deterministik). */
const PAGE_STYLE =
  'width:1120px;background:#ffffff;color:#18181b;box-sizing:border-box;' +
  "font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;"

/** Kapak sayfası DOM'u üretir. */
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
      <div style="font-size:21px;color:#52525b;margin-top:18px;">Tüm sayfalar — birleşik doküman</div>
    </div>
    <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;
                font-size:14px;color:#71717a;border-top:1px solid #e4e4e7;padding-top:22px;">
      <span>${escapeHtml(date)}</span>
      <span>${pageCount} sayfa · ${sectionCount} bölüm</span>
    </div>`
  return el
}

interface TocEntry {
  title: string
  page: number
}

/** Bir İçindekiler sayfası (chunk) DOM'u üretir. */
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
      İçindekiler${continued ? ' (devam)' : ''}
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

/** Bir DOM düğümünü tek bir portre A4 sayfasına (PdfPage[]) çevirir. */
async function domToPdfPages(el: HTMLElement): Promise<PdfPage[]> {
  const { canvas } = await captureElementToCanvas(el)
  // Kapak/İçindekiler kısa tutulduğundan tek sayfaya sığar; yine de bölünürse
  // canvasToPdfPages doğru sayfa sayısını döndürür (yalnızca 'portrait' zorlanır).
  return canvasToPdfPages(canvas, 'portrait')
}

/**
 * Bir workspace grubunun tüm sayfalarını tek PDF olarak indirir.
 * Bir sayfa yüklenemez/render edilemezse atlanır ve `skipped` içinde raporlanır.
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
    // 1) Her içerik sayfasını yükle ve yakala.
    const groups: { item: WorkspacePageRef; pages: PdfPage[] }[] = []
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]!
      onProgress?.({ current: i + 1, total: pages.length, title: page.title, stage: 'loading' })
      try {
        const main = await loadPageContent(iframe, page.path, PAGE_TIMEOUT_MS)
        onProgress?.({ current: i + 1, total: pages.length, title: page.title, stage: 'rendering' })
        const { canvas, orientation } = await captureElementToCanvas(main)
        const pdfPages = canvasToPdfPages(canvas, orientation)
        if (pdfPages.length === 0) throw new Error('boş render')
        groups.push({ item: page, pages: pdfPages })
      } catch (error) {
        skipped.push({ path: page.path, title: page.title, reason: (error as Error).message })
      }
    }

    if (groups.length === 0) {
      throw new Error('Hiçbir sayfa render edilemedi')
    }

    onProgress?.({ current: pages.length, total: pages.length, title: '', stage: 'finalizing' })

    // 2) İçerik sayfalarının blok-göreli başlangıç numaraları (1 tabanlı).
    const relStart: number[] = []
    let rel = 1
    for (const g of groups) {
      relStart.push(rel)
      rel += g.pages.length
    }

    const date = new Date().toISOString().slice(0, 10)

    // 3) Kapak (mutlak sayfa numaraları için önce onun sayfa sayısını bil).
    const coverPages = await domToPdfPages(
      buildCoverDom(workspace, date, rel - 1, groups.length),
    )

    // 4) İçindekiler — chunk sayısı deterministik; mutlak numara = frontCount + relStart.
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

    // 5) Tüm sayfaları sırayla tek jsPDF'e ekle: kapak → içindekiler → içerik.
    const contentPages = groups.flatMap((g) => g.pages)
    const allPages: PdfPage[] = [...coverPages, ...tocPages, ...contentPages]

    const { jsPDF: JsPDF } = await import('jspdf')
    const pdf = new JsPDF({
      orientation: allPages[0]!.orientation,
      unit: 'mm',
      format: 'a4',
      compress: true,
    })
    pdf.setProperties({ title: `${workspace.label} — Tüm Sayfalar` })

    allPages.forEach((pg, index) => {
      if (index > 0) pdf.addPage('a4', pg.orientation)
      pdf.addImage(pg.dataUrl, 'JPEG', A4_MARGIN_MM, A4_MARGIN_MM, pg.wMm, pg.hMm)
    })

    // 6) İçerik sayfalarına mutlak sayfa numarası bas (yalnızca rakam → font güvenli).
    const contentStartAbs = coverPages.length + tocPages.length + 1
    for (let p = contentStartAbs; p <= allPages.length; p++) {
      pdf.setPage(p)
      const w = pdf.internal.pageSize.getWidth()
      const h = pdf.internal.pageSize.getHeight()
      pdf.setFontSize(9)
      pdf.setTextColor(140)
      pdf.text(String(p), w / 2, h - 5, { align: 'center' })
    }

    pdf.save(`nesy-${slugify(workspace.label)}-tum-sayfalar-${date}.pdf`)

    return { exported: contentPages.length, skipped }
  } finally {
    iframe.remove()
  }
}
