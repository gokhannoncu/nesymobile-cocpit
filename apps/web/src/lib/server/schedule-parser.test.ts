import { describe, expect, it } from 'vitest'
import { parseDeviceSchedule } from './schedule-parser'

describe('parseDeviceSchedule', () => {
  it('combines Schedule metadata with ordered ScheduleStopChunk trees', () => {
    const result = parseDeviceSchedule(
      {
        id: 7,
        scheduleId: 'SCH-7',
        timeStamp: '15-07-2026-17:49:37',
        body: '{}',
        scheduleMetaJson: JSON.stringify({
          scheduleStatus: 1,
          courierName: 'Test Courier',
          courierUserId: 'courier-1',
          branchId: 10,
        }),
      },
      [
        {
          stopIndex: 1,
          stopId: 'stop-2',
          stopJson: JSON.stringify({ stopId: 'stop-2', stopOrder: 2, taskList: [] }),
        },
        {
          stopIndex: 0,
          stopId: 'stop-1',
          stopJson: JSON.stringify({
            stopId: 'stop-1',
            stopOrder: 1,
            timeWindow: { startTime: '08:00', endTime: '10:00' },
            taskList: [
              {
                taskId: 'task-1',
                taskStatus: 1,
                taskType: 2,
                shipmentList: [
                  {
                    waybillNumber: 'WB-1',
                    shipmentItemList: [{ barcode: 'ITEM-1', shipmentItemStatus: 4 }],
                  },
                ],
              },
            ],
          }),
        },
      ],
    )

    expect(result.warnings).toEqual([])
    expect(result.schedule).toMatchObject({
      id: 7,
      scheduleId: 'SCH-7',
      status: 1,
      courierName: 'Test Courier',
      courierId: 'courier-1',
      branchCode: '10',
    })
    expect(result.schedule?.stops.map((stop) => stop.stopId)).toEqual(['stop-1', 'stop-2'])
    expect(result.schedule?.stops[0]?.taskList[0]?.shipmentList[0]?.shipmentItemList[0]?.barcode).toBe('ITEM-1')
  })

  it('keeps the schedule header usable when stop chunks are not present', () => {
    const result = parseDeviceSchedule(
      {
        id: 1,
        scheduleId: 'SCH-EMPTY',
        timeStamp: '2026-07-15T12:00:00Z',
        body: '{}',
        scheduleMetaJson: '{"courierName":"Courier","scheduleStatus":0}',
      },
      [],
    )

    expect(result.schedule?.scheduleId).toBe('SCH-EMPTY')
    expect(result.schedule?.stops).toEqual([])
    expect(result.warnings).toEqual([])
  })
})
