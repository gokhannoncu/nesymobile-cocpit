import { EvidenceSourceRegistry } from './evidence-source-resolver.js'

/**
 * Process-wide runtime evidence source registry shared by durable ingest and
 * the EvidenceSourceQuery read API. Kept in its own module so route wiring does
 * not import the WebSocket server.
 */
export const BridgeFlowEvidenceSources = new EvidenceSourceRegistry()
