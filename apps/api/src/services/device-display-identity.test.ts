import { describe, expect, it } from 'vitest'

import {
  applyDeviceDisplay,
  formatDeviceModelLabel,
  identityFromAdbDevice,
} from './device-display-identity.js'

describe('formatDeviceModelLabel', () => {
  it('prefixes the manufacturer when the market name is a model code', () => {
    expect(
      formatDeviceModelLabel({
        manufacturer: 'samsung',
        marketName: 'SM-A346E',
        modelName: 'SM_A346E',
      }),
    ).toBe('Samsung SM-A346E')
  })

  it('does not duplicate the manufacturer when the market name already includes it', () => {
    expect(
      formatDeviceModelLabel({
        manufacturer: 'Samsung',
        marketName: 'Samsung Galaxy A34',
      }),
    ).toBe('Samsung Galaxy A34')
  })

  it('falls back to the ADB model when market name is missing', () => {
    expect(formatDeviceModelLabel({ manufacturer: 'samsung', modelName: 'SM_A346E' })).toBe(
      'Samsung SM A346E',
    )
  })
})

describe('identityFromAdbDevice', () => {
  it('stores the formatted picker label separately from the raw model', () => {
    expect(
      identityFromAdbDevice({
        id: 'R6CW400BC8N',
        manufacturer: 'samsung',
        marketName: 'SM-A346E',
        modelName: 'SM_A346E',
        product: 'a34x',
      }),
    ).toEqual({
      serial: 'R6CW400BC8N',
      modelName: 'SM-A346E',
      label: 'Samsung SM-A346E',
      product: 'a34x',
    })
  })
})

describe('applyDeviceDisplay', () => {
  it('fills missing history fields from the resolved catalog', () => {
    const displays = new Map([
      ['R6CW400BC8N', { modelName: 'SM-A346E', label: 'Samsung SM-A346E' }],
    ])
    expect(
      applyDeviceDisplay({ deviceId: 'R6CW400BC8N', deviceModelName: null, deviceLabel: null }, displays),
    ).toMatchObject({
      deviceId: 'R6CW400BC8N',
      deviceModelName: 'SM-A346E',
      deviceLabel: 'Samsung SM-A346E',
    })
  })

  it('keeps an already joined mobile_devices label', () => {
    const displays = new Map([
      ['R6CW400BC8N', { modelName: 'SM-A346E', label: 'Samsung SM-A346E' }],
    ])
    expect(
      applyDeviceDisplay(
        { deviceId: 'R6CW400BC8N', deviceModelName: 'SM-A346E', deviceLabel: 'Courier A' },
        displays,
      ),
    ).toMatchObject({
      deviceModelName: 'SM-A346E',
      deviceLabel: 'Courier A',
    })
  })
})
