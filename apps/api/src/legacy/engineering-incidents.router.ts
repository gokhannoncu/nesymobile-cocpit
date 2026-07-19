import { Router, type Router as RouterType } from 'express'
import { prisma, type Prisma } from '@nesy/db'

const router: RouterType = Router()

const ACTIVE_STATUSES = new Set([
  'ASSESSING',
  'INVESTIGATING',
  'IDENTIFIED',
  'MITIGATING',
  'MONITORING',
])
const STATUS_LABELS: Record<string, string> = {
  ASSESSING: 'Değerlendiriliyor',
  INVESTIGATING: 'İnceleniyor',
  IDENTIFIED: 'Neden belirlendi',
  MITIGATING: 'Mitigation sürüyor',
  MONITORING: 'İzleniyor',
  RESOLVED: 'Çözüldü',
}
const VALID_SEVERITIES = new Set(['SEV-1', 'SEV-2', 'SEV-3'])
const VALID_ENVIRONMENTS = new Set(['stage', 'prod'])
const VALID_COUNTRIES = new Set(['HR', 'RS', 'SI', 'BA', 'ME', 'AZ', 'SK', 'BG'])

type IncidentWithEvents = Prisma.EngineeringIncidentGetPayload<{
  include: { events: { orderBy: { occurredAt: 'asc' } } }
}>

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalText(value: unknown): string | null {
  const normalized = text(value)
  return normalized || null
}

function nonNegativeInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(text).filter(Boolean))]
}

function dateOrNull(value: unknown): Date | null | 'invalid' {
  const normalized = text(value)
  if (!normalized) return null
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? 'invalid' : parsed
}

function incidentDateStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}${value('month')}${value('day')}`
}

async function nextIncidentNumber(tx: Prisma.TransactionClient, now: Date): Promise<string> {
  const prefix = `INC-${incidentDateStamp(now)}-`
  const rows = await tx.engineeringIncident.findMany({
    where: { incidentNumber: { startsWith: prefix } },
    select: { incidentNumber: true },
  })
  const nextSequence =
    rows.reduce((max, row) => {
      const sequence = Number(row.incidentNumber.slice(prefix.length))
      return Number.isInteger(sequence) ? Math.max(max, sequence) : max
    }, 0) + 1
  return `${prefix}${String(nextSequence).padStart(2, '0')}`
}

function serializeIncident(row: IncidentWithEvents) {
  return {
    ...row,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    nextCommunicationAt: row.nextCommunicationAt?.toISOString() ?? null,
    lastUpdateAt: row.lastUpdateAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    events: row.events.map((event) => ({
      ...event,
      occurredAt: event.occurredAt.toISOString(),
    })),
  }
}

const incidentInclude = {
  events: { orderBy: { occurredAt: 'asc' as const } },
} as const

router.get('/active', async (_req, res) => {
  try {
    const incident = await prisma.engineeringIncident.findFirst({
      where: { endedAt: null },
      include: incidentInclude,
      orderBy: { startedAt: 'desc' },
    })
    res.json({ data: incident ? serializeIncident(incident) : null })
  } catch (error) {
    res.status(500).json({
      message: 'Aktif incident yüklenemedi.',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    })
  }
})

router.get('/recent', async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit)
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 20
    const incidents = await prisma.engineeringIncident.findMany({
      include: incidentInclude,
      orderBy: { startedAt: 'desc' },
      take: limit,
    })
    res.json({ data: incidents.map(serializeIncident) })
  } catch (error) {
    res.status(500).json({
      message: 'Incident geçmişi yüklenemedi.',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const id = text(req.params.id)
    if (!id) {
      res.status(400).json({ message: 'id zorunludur.' })
      return
    }
    const incident = await prisma.engineeringIncident.findUnique({
      where: { id },
      include: incidentInclude,
    })
    if (!incident) {
      res.status(404).json({ message: 'Incident bulunamadı.' })
      return
    }
    res.json({ data: serializeIncident(incident) })
  } catch (error) {
    res.status(500).json({
      message: 'Incident yüklenemedi.',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    })
  }
})

router.post('/', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>
    const title = text(body.title)
    const summary = optionalText(body.summary)
    const severity = text(body.severity).toUpperCase()
    const objective = text(body.objective)
    const countries = stringArray(body.countries).map((country) => country.toUpperCase())
    const environment = text(body.environment).toLowerCase()
    const appVersion = text(body.appVersion)
    const affectedScreen = text(body.affectedScreen)
    const riskTypes = stringArray(body.riskTypes)
    const reporterName = text(body.reporterName)
    const incidentCommander = text(body.incidentCommander)
    const operationsLead = optionalText(body.operationsLead)
    const communicationsLead = optionalText(body.communicationsLead)
    const scribe = optionalText(body.scribe)
    const relatedTicket = optionalText(body.relatedTicket)
    const affectedCouriers = nonNegativeInteger(body.affectedCouriers)
    const affectedShipments = nonNegativeInteger(body.affectedShipments)
    const affectedPaymentRecords = nonNegativeInteger(body.affectedPaymentRecords)
    const nextCommunicationAt = dateOrNull(body.nextCommunicationAt)

    const validationErrors: string[] = []
    if (!title) validationErrors.push('Incident başlığı zorunludur.')
    if (!VALID_SEVERITIES.has(severity)) validationErrors.push('Severity SEV-1, SEV-2 veya SEV-3 olmalıdır.')
    if (!objective) validationErrors.push('Mevcut hedef zorunludur.')
    if (!countries.length || countries.some((country) => !VALID_COUNTRIES.has(country))) {
      validationErrors.push('En az bir geçerli ülke seçilmelidir.')
    }
    if (!VALID_ENVIRONMENTS.has(environment)) validationErrors.push('Environment stage veya prod olmalıdır.')
    if (!appVersion) validationErrors.push('App version zorunludur.')
    if (!affectedScreen) validationErrors.push('Etkilenen ekran zorunludur.')
    if (!reporterName) validationErrors.push('Incident’ı bildiren kişi zorunludur.')
    if (!incidentCommander) validationErrors.push('Incident Commander zorunludur.')
    if (affectedCouriers == null || affectedShipments == null || affectedPaymentRecords == null) {
      validationErrors.push('Etki sayıları sıfır veya pozitif tam sayı olmalıdır.')
    }
    if (nextCommunicationAt === 'invalid') validationErrors.push('Sonraki iletişim zamanı geçersizdir.')

    if (validationErrors.length) {
      res.status(400).json({ message: 'Form bilgileri geçersiz.', errors: validationErrors })
      return
    }

    const now = new Date()
    const incident = await prisma.$transaction(async (tx) => {
      const active = await tx.engineeringIncident.findFirst({
        where: { endedAt: null },
        select: { id: true, incidentNumber: true },
      })
      if (active) return { existing: active, created: null }

      const incidentNumber = await nextIncidentNumber(tx, now)
      const created = await tx.engineeringIncident.create({
        data: {
          incidentNumber,
          title,
          summary,
          severity,
          status: 'ASSESSING',
          objective,
          countries,
          environment,
          appVersion,
          affectedScreen,
          riskTypes,
          reporterName,
          incidentCommander,
          operationsLead,
          communicationsLead,
          scribe,
          affectedCouriers: affectedCouriers!,
          affectedShipments: affectedShipments!,
          affectedPaymentRecords: affectedPaymentRecords!,
          relatedTicket,
          nextCommunicationAt: nextCommunicationAt === 'invalid' ? null : nextCommunicationAt,
          startedAt: now,
          lastUpdateAt: now,
          events: {
            create: {
              eventType: 'CREATED',
              toStatus: 'ASSESSING',
              message: 'Incident başlatıldı.',
              createdBy: reporterName,
              occurredAt: now,
              metadata: {
                severity,
                countries,
                environment,
                appVersion,
                affectedScreen,
                riskTypes,
              },
            },
          },
        },
        include: incidentInclude,
      })
      return { existing: null, created }
    })

    if (incident.existing) {
      res.status(409).json({
        message: `Önce ${incident.existing.incidentNumber} numaralı aktif incident kapatılmalıdır.`,
        activeIncidentId: incident.existing.id,
      })
      return
    }

    res.status(201).json({ data: serializeIncident(incident.created!) })
  } catch (error) {
    res.status(500).json({
      message: 'Incident başlatılamadı.',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    })
  }
})

router.patch('/:id/status', async (req, res) => {
  try {
    const id = text(req.params.id)
    const body = req.body as Record<string, unknown>
    const nextStatus = text(body.status).toUpperCase()
    const createdBy = optionalText(body.createdBy)
    const note = optionalText(body.note)

    if (!id || !ACTIVE_STATUSES.has(nextStatus)) {
      res.status(400).json({ message: 'Geçerli bir id ve aktif incident status’u zorunludur.' })
      return
    }

    const existing = await prisma.engineeringIncident.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ message: 'Incident bulunamadı.' })
      return
    }
    if (existing.endedAt) {
      res.status(409).json({ message: 'Kapatılmış incident’ın status’u değiştirilemez.' })
      return
    }

    const now = new Date()
    const updated = await prisma.engineeringIncident.update({
      where: { id },
      data: {
        status: nextStatus,
        lastUpdateAt: now,
        events: {
          create: {
            eventType: 'STATUS_CHANGED',
            fromStatus: existing.status,
            toStatus: nextStatus,
            message: note ?? `Incident status’u “${STATUS_LABELS[nextStatus]}” olarak değiştirildi.`,
            createdBy,
            occurredAt: now,
          },
        },
      },
      include: incidentInclude,
    })
    res.json({ data: serializeIncident(updated) })
  } catch (error) {
    res.status(500).json({
      message: 'Incident status’u güncellenemedi.',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    })
  }
})

router.post('/:id/finish', async (req, res) => {
  try {
    const id = text(req.params.id)
    const body = req.body as Record<string, unknown>
    const resolutionSummary = text(body.resolutionSummary)
    const rootCause = optionalText(body.rootCause)
    const createdBy = optionalText(body.createdBy)

    if (!id || !resolutionSummary) {
      res.status(400).json({ message: 'id ve çözüm özeti zorunludur.' })
      return
    }

    const existing = await prisma.engineeringIncident.findUnique({
      where: { id },
      include: incidentInclude,
    })
    if (!existing) {
      res.status(404).json({ message: 'Incident bulunamadı.' })
      return
    }
    if (existing.endedAt) {
      res.json({ data: serializeIncident(existing) })
      return
    }

    const endedAt = new Date()
    const durationSeconds = Math.max(
      0,
      Math.floor((endedAt.getTime() - existing.startedAt.getTime()) / 1000),
    )
    const updated = await prisma.engineeringIncident.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        endedAt,
        durationSeconds,
        resolutionSummary,
        rootCause,
        lastUpdateAt: endedAt,
        events: {
          create: {
            eventType: 'RESOLVED',
            fromStatus: existing.status,
            toStatus: 'RESOLVED',
            message: resolutionSummary,
            createdBy,
            occurredAt: endedAt,
            metadata: rootCause ? { rootCause } : undefined,
          },
        },
      },
      include: incidentInclude,
    })
    res.json({ data: serializeIncident(updated) })
  } catch (error) {
    res.status(500).json({
      message: 'Incident kapatılamadı.',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    })
  }
})

export default router
