export type GraylogField = {
  field: string
  meaning: string
  example: string
  source: string
}

const GRAYLOG_FIELDS: GraylogField[] = [
  {
    field: 'shipmentId',
    meaning:
      'Unique identifier of the shipment — connects delivery, fiscal, and retry logs in a single chain.',
    example: '45-40-20251224-1',
    source: 'Mobile · Backend · Fiscal',
  },
  {
    field: 'courierId',
    meaning: 'Courier identifier — filters login, shift, and delivery logs by person.',
    example: '3021',
    source: 'Mobile · Authentication',
  },
  {
    field: 'scheduleId',
    meaning: 'Shift/route plan identifier — groups all shipment logs in the same shift.',
    example: 'SCH-2025-8841',
    source: 'Backend',
  },
  {
    field: 'requestId',
    meaning: 'Offline queue request identifier — matches every attempt in the retry chain.',
    example: 'req_9f3c1a72',
    source: 'Offline queue · Backend',
  },
  {
    field: 'fiscalId',
    meaning: 'Fiscal record identifier — key for duplicate fiscal and timeout investigations.',
    example: 'FIS-HR-338291',
    source: 'Fiscal service',
  },
  {
    field: 'errorCode',
    meaning: 'Standard error code — provides filtering by error family.',
    example: 'FISCAL_TIMEOUT',
    source: 'All services',
  },
  {
    field: 'appVersion',
    meaning: 'Mobile application version — used in version-based regression investigations.',
    example: '4.12.0',
    source: 'Mobile',
  },
  {
    field: 'country',
    meaning: 'Operation country (ISO code) — narrows log volume by country.',
    example: 'HR',
    source: 'All services',
  },
]

export function getGraylogFields(): GraylogField[] {
  return GRAYLOG_FIELDS
}

export function getFieldsPayload(): { fields: GraylogField[] } {
  return { fields: GRAYLOG_FIELDS }
}
