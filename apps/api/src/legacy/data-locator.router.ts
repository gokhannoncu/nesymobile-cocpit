import { Router, type Router as RouterType } from 'express'
import {
  getCatalogPayload,
  getSourceById,
  resolveIntent,
} from '../data/data-locator-catalog.js'

const router: RouterType = Router()

router.get('/catalog', (_req, res) => {
  res.json(getCatalogPayload())
})

router.get('/search', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : ''
  const intent = resolveIntent(q)
  if (!intent) {
    res.json({ query: q, intent: null, results: [] })
    return
  }
  const results = intent.results
    .map((r) => {
      const source = getSourceById(r.sourceId)
      if (!source) return null
      return { role: r.role, source }
    })
    .filter(Boolean)
  res.json({
    query: q,
    intent: {
      id: intent.id,
      chipLabel: intent.chipLabel,
      guidance: intent.guidance,
    },
    results,
  })
})

router.get('/sources/:id', (req, res) => {
  const id = decodeURIComponent(req.params.id ?? '')
  const source = getSourceById(id)
  if (!source) {
    res.status(404).json({ message: `Unknown source: ${id}` })
    return
  }
  res.json(source)
})

export default router
