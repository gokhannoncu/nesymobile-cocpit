import { describe, expect, it } from 'vitest'
import {
  getCarriedCodeReleases,
  getCountryVersionHistory,
  latestCountryVersions,
  productionReleases,
  productionReleaseSummary,
} from '../../../../data/pm/production-releases'

describe('production release history', () => {
  it('keeps the first-parent release classification totals', () => {
    expect(productionReleaseSummary).toEqual({
      total: 34,
      code: 17,
      workflow: 1,
      rollout: 16,
    })
  })

  it('preserves chronological sequence and commit uniqueness', () => {
    expect(productionReleases.map((release) => release.sequence)).toEqual(
      Array.from({ length: 34 }, (_, index) => index + 1),
    )
    expect(new Set(productionReleases.map((release) => release.commit)).size).toBe(34)
  })

  it('derives the final production version matrix', () => {
    expect(latestCountryVersions).toMatchObject({
      hr: 262,
      si: 174,
      rs: 68,
      ba: 29,
      me: 30,
    })
  })

  it('marks the Montenegro version rollback in release 25', () => {
    const release = productionReleases.find((item) => item.sequence === 25)
    const transition = release?.versionTransitions.find((item) => item.countryId === 'me')

    expect(transition).toEqual({ countryId: 'me', from: 18, to: 17 })
    expect(release?.alerts).toHaveLength(1)
  })

  it('derives the code releases carried by rollout-only packages', () => {
    const release33 = productionReleases.find((release) => release.sequence === 33)!
    const release34 = productionReleases.find((release) => release.sequence === 34)!
    const release2 = productionReleases.find((release) => release.sequence === 2)!

    expect(getCarriedCodeReleases(release33).map((release) => release.sequence)).toEqual([32])
    expect(getCarriedCodeReleases(release34).map((release) => release.sequence)).toEqual([32, 31])
    expect(getCarriedCodeReleases(release2)).toEqual([])
  })

  it('derives each country\'s latest version release from the same history', () => {
    expect(getCountryVersionHistory('hr').at(-1)).toMatchObject({
      release: { sequence: 33 },
      transition: { from: 261, to: 262 },
    })
    expect(getCountryVersionHistory('si').at(-1)).toMatchObject({
      release: { sequence: 34 },
      transition: { from: 173, to: 174 },
    })
    expect(getCountryVersionHistory('rs').at(-1)?.transition.to).toBe(68)
    expect(getCountryVersionHistory('ba').at(-1)?.transition.to).toBe(29)
    expect(getCountryVersionHistory('me').at(-1)?.transition.to).toBe(30)
  })
})
