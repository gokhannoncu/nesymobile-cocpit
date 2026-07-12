/**
 * Sayfa içeriğini A4 PDF olarak indirir (önizleme yok, doğrudan indirme).
 *
 * Mimari:
 * 1. `main[role="content"]` canlı DOM'dan klonlanır ve ekran dışı (off-screen)
 *    bir yakalama köküne yerleştirilir — ekranda hiçbir titreme/değişiklik olmaz.
 * 2. Klon içinde tüm tab panelleri açılır (forceMount sayesinde DOM'da
 *    mevcutlar), her panelin üstüne sekme etiketi başlık olarak eklenir,
 *    framer-motion'ın inline opacity/transform değerleri sıfırlanır.
 * 3. İÇERİK KAYBI YASAĞI: klon önce dikey (1120px) genişlikte ölçülür; yatayda
 *    kırpılan öğe (truncate üç noktası, taşan tablo/grid) varsa PDF yatay
 *    (landscape) formata geçer ve yakalama genişliği, kırpılma sıfırlanana
 *    kadar kademeli artırılır. PDF'te hiçbir içerik kesilmez / üst üste binmez.
 * 4. Canvas boyutu ÖNDEN belirlenir: içerik boyutları ölçülür ve tarayıcı
 *    canvas limitlerine (boyut + alan) göre ölçek hesaplanır.
 * 5. html2canvas-pro ile (oklch/color-mix destekli) tek canvas'a render edilir;
 *    koyu tema render sırasında açık temaya çevrilir.
 * 6. Canvas, A4 sayfalarına bölünür; kesim noktaları piksel analizi ile
 *    "boş" satırlara denk getirilir (içerik ortadan kesilmez).
 */
import type { jsPDF } from 'jspdf'

/** Tarayıcıya özel; SSR bundle'ına girmemesi için yalnızca export sırasında yüklenir. */
async function loadHtml2Canvas() {
  const { default: html2canvas } = await import('html2canvas-pro')
  return html2canvas
}

async function loadJsPDF() {
  const { jsPDF } = await import('jspdf')
  return jsPDF
}

/** Dikey mod yakalama genişliği (px) — A4 190mm baskı alanı ~150dpi karşılığı. */
const PORTRAIT_WIDTH = 1120

/**
 * Yatay mod genişlik adayları (px). İlki, dikeydeki 1120px ile aynı yazı
 * boyutunu koruyan 277mm karşılığıdır; kırpılma sürerse sırayla genişletilir.
 */
const LANDSCAPE_WIDTHS = [1584, 1920, 2320, 2800]

/** A4 (mm) ve kenar boşlukları. */
const PAGE_SHORT = 210
const PAGE_LONG = 297
const MARGIN = 10

export type PdfOrientation = 'portrait' | 'landscape'

/** Seçilen yöne göre A4 baskı alanı (mm). */
function contentSize(orientation: PdfOrientation): { w: number; h: number } {
  return orientation === 'portrait'
    ? { w: PAGE_SHORT - MARGIN * 2, h: PAGE_LONG - MARGIN * 2 } // 190×277
    : { w: PAGE_LONG - MARGIN * 2, h: PAGE_SHORT - MARGIN * 2 } // 277×190
}

/** Tarayıcı canvas güvenlik limitleri (Safari/Chrome ortak alt sınır). */
const MAX_CANVAS_DIM = 16384
const MAX_CANVAS_AREA = 100_000_000
const PREFERRED_SCALE = 2
const MIN_SCALE = 0.4

const STYLE_ID = 'nesy-pdf-capture-style'
const ROOT_CLASS = 'nesy-pdf-capture-root'

/**
 * Yakalama köküne özel CSS — canlı sayfayı etkilemez (sınıf ile kapsamlı),
 * html2canvas'ın dahili klonuna stylesheet olarak kopyalanır.
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

const TR_CHAR_MAP: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i',
  ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
}

export function slugify(input: string): string {
  const slug = input
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TR_CHAR_MAP[ch] ?? ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'sayfa'
}

/**
 * Canvas boyutu algoritması: içerik yüksekliğine göre render ölçeğini önden
 * belirler. Uzun sayfalarda ölçek düşürülerek tarayıcı canvas limitleri
 * (kenar uzunluğu ve toplam alan) aşılmaz.
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

/** Her tab paneline, ait olduğu sekmenin etiketini başlık olarak ekler. */
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
 * İçeriği klonlayıp ekran dışı yakalama kökü oluşturur (genişlik sonradan ayarlanır).
 * `source` başka bir document'ten (ör. iframe) gelebilir; bu yüzden `cloneNode`
 * yerine `document.importNode` kullanılır — düğüm ana document'e uyarlanarak alınır.
 */
function buildCaptureRoot(source: HTMLElement, opts?: { pad?: boolean }): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = ROOT_CLASS
  wrapper.setAttribute('aria-hidden', 'true')
  wrapper.setAttribute(
    'style',
    `position:fixed;top:0;left:-100000px;width:${PORTRAIT_WIDTH}px;z-index:-1;background:#ffffff;` +
      // Tek bölüm (slayt) yakalanırken `main` kuralındaki iç boşluk uygulanmaz;
      // beyaz çerçeveyi wrapper üzerinden veriyoruz.
      (opts?.pad ? 'padding:28px;' : ''),
  )
  const clone = document.importNode(source, true) as HTMLElement
  wrapper.appendChild(clone)
  injectTabHeadings(wrapper)
  return wrapper
}

/**
 * Yatayda kırpılan öğe sayısı: `truncate` üç noktası, taşan tablo/grid gibi
 * içeriği gerçekten kesen (overflow-x !== visible) öğeleri sayar.
 * PDF'te içerik kaybı yasak — bu sayı sıfırlanana kadar genişlik artırılır.
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
 * İçerik kaybı yasağı: dikeyde (1120px) kırpılma varsa yatay moda geçer ve
 * yakalama genişliğini, kırpılan öğe kalmayana kadar kademeli artırır.
 * En geniş adayda bile kırpılma sürerse en geniş aday kullanılır (en az kayıp).
 */
function resolveLayout(captureRoot: HTMLElement): { orientation: PdfOrientation; width: number } {
  if (countClippedElements(captureRoot) === 0) {
    return { orientation: 'portrait', width: PORTRAIT_WIDTH }
  }

  let width = LANDSCAPE_WIDTHS[LANDSCAPE_WIDTHS.length - 1] ?? PORTRAIT_WIDTH
  for (const candidate of LANDSCAPE_WIDTHS) {
    captureRoot.style.width = `${candidate}px`
    void captureRoot.offsetHeight // reflow — ölçüm yeni genişlikte yapılsın
    if (countClippedElements(captureRoot) === 0) {
      width = candidate
      break
    }
  }
  captureRoot.style.width = `${width}px`
  void captureRoot.offsetHeight
  return { orientation: 'landscape', width }
}

/** Fontların ve klondaki görsellerin hazır olmasını bekler (yükseklik ölçümü öncesi). */
async function waitForAssets(root: HTMLElement): Promise<void> {
  try {
    await document.fonts.ready
  } catch {
    /* fonts API yoksa devam et */
  }
  const images = Array.from(root.querySelectorAll('img'))
  await Promise.allSettled(
    images.map((img) => (typeof img.decode === 'function' ? img.decode() : Promise.resolve())),
  )
}

/** Satırın görsel olarak "boş" (tek renk) olup olmadığını örnekleyerek kontrol eder. */
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
 * Akıllı sayfa sonu: hedef kesim noktasından yukarı doğru tarayıp içerik
 * barındırmayan (tek renk) ilk satırı bulur; bulunamazsa hedefte keser.
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

/** PDF'e eklenmeye hazır tek bir sayfa: JPEG data URL + yerleşim boyutu (mm) + yön. */
export interface PdfPage {
  dataUrl: string
  orientation: PdfOrientation
  /** Sayfaya yerleştirme genişliği (mm) — baskı alanı genişliği. */
  wMm: number
  /** Sayfaya yerleştirme yüksekliği (mm). */
  hMm: number
}

/**
 * Bir canvas'ı A4 baskı alanına göre sayfalara böler ve her sayfa için PDF'e
 * hazır bir görsel (JPEG data URL) üretir. Kesim noktaları piksel analizi ile
 * "boş" satırlara denk getirilir; içerik ortadan kesilmez.
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
      // Sayfanın en az %65'i dolu kalacak şekilde boş satır ara.
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
 * Bir canvas'ı A4 dilimlerine bölerek MEVCUT bir jsPDF belgesine ekler.
 * Sayfa yönü sayfa bazında değişebilir (`addPage('a4', orientation)`).
 * `skipFirstAddPage` true ise ilk dilim, dokümanın mevcut (kurucu) sayfasına
 * yazılır — tek sayfalık export bu sayede fazladan boş sayfa üretmez.
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
 * Bir kaynak elementi ekran dışında klonlar, yönünü (dikey/yatay) içeriğe göre
 * çözer ve html2canvas ile tek bir canvas'a render eder. Kaynak başka bir
 * document'ten (iframe) gelebilir. Koyu tema render sırasında açık temaya çevrilir.
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

    // İçerik kaybı yasağı: kırpılma varsa yatay moda geç ve genişliği artır.
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
        // Koyu temada bile baskı her zaman açık temada üretilir.
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
  /** PDF başlığı ve dosya adı kaynağı — genellikle aktif breadcrumb. */
  title: string
}

/**
 * Planlı (slayt) export: her `[data-pdf-slide]` bölümü kendi sayfasında başlar —
 * sürekli tek akış yerine PowerPoint benzeri "bölüm başına slayt" çıktı.
 * Yön (dikey/yatay) her slayt için ayrı çözülür; geniş tablo/grafik içeren
 * bölüm tek başına yatay olabilir. Bölümler DOM sırasında işlenir; istenirse
 * `data-pdf-slide-order` ile sıra bozulmadan yeniden düzenlenebilir.
 */
export async function exportSlidesToPdf({
  title,
  slides,
}: {
  title: string
  slides: HTMLElement[]
}): Promise<void> {
  if (slides.length === 0) throw new Error('Yakalanacak slayt bulunamadı')

  const JsPDF = await loadJsPDF()
  let pdf: jsPDF | null = null

  for (const slide of slides) {
    const { canvas, orientation } = await captureElementToCanvas(slide, { pad: true })
    if (!pdf) {
      // İlk slayt dokümanın kurucu sayfasına yazılır (fazladan boş sayfa olmaz).
      pdf = new JsPDF({ orientation, unit: 'mm', format: 'a4', compress: true })
      pdf.setProperties({ title })
      appendCanvasToPdf(pdf, canvas, orientation, { skipFirstAddPage: true })
    } else {
      // Sonraki her slayt yeni sayfada başlar.
      appendCanvasToPdf(pdf, canvas, orientation)
    }
  }

  const date = new Date().toISOString().slice(0, 10)
  pdf!.save(`nesy-${slugify(title)}-${date}.pdf`)
}

/**
 * Aktif sayfanın içerik alanını A4 PDF olarak doğrudan indirir.
 *
 * İki mod: sayfa bölümleri `data-pdf-slide` ile işaretlenmişse PLANLI (slayt)
 * mod devreye girer — her bölüm kendi sayfasında başlar. İşaret yoksa sayfa
 * tek sürekli akış olarak yakalanıp A4 sayfalarına bölünür (varsayılan).
 */
export async function exportPageToPdf({ title }: ExportPageToPdfOptions): Promise<void> {
  const source = document.querySelector<HTMLElement>('main[role="content"]')
  if (!source) throw new Error('Sayfa içerik alanı (main[role="content"]) bulunamadı')

  // Planlı mod: bölüm başına slayt.
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

  // Varsayılan: sürekli akış.
  const { canvas, orientation } = await captureElementToCanvas(source)

  const JsPDF = await loadJsPDF()
  const pdf = new JsPDF({ orientation, unit: 'mm', format: 'a4', compress: true })
  pdf.setProperties({ title })
  appendCanvasToPdf(pdf, canvas, orientation, { skipFirstAddPage: true })

  const date = new Date().toISOString().slice(0, 10)
  pdf.save(`nesy-${slugify(title)}-${date}.pdf`)
}
