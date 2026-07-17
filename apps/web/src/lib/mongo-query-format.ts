/** Pretty-format Mongo shell queries and extract filter/pipeline payloads. */

const INDENT = '  '

/** Format mongo shell source with indentation around braces/brackets/parens groups. */
export function formatMongoShell(source: string): string {
  const input = source.replace(/\r\n/g, '\n').trim()
  if (!input) return ''

  let out = ''
  let depth = 0
  let i = 0
  let inSingle = false
  let inDouble = false
  let escape = false
  /** Stack of whether each '(' opened an expanded (object/array) group. */
  const parenExpanded: boolean[] = []

  const newlineIndent = () => {
    out += `\n${INDENT.repeat(Math.max(depth, 0))}`
  }

  while (i < input.length) {
    const ch = input[i]!

    if (escape) {
      out += ch
      escape = false
      i++
      continue
    }

    if ((inSingle || inDouble) && ch === '\\') {
      out += ch
      escape = true
      i++
      continue
    }

    if (!inDouble && ch === "'" && !inSingle) {
      inSingle = true
      out += ch
      i++
      continue
    }
    if (inSingle && ch === "'") {
      inSingle = false
      out += ch
      i++
      continue
    }
    if (!inSingle && ch === '"' && !inDouble) {
      inDouble = true
      out += ch
      i++
      continue
    }
    if (inDouble && ch === '"') {
      inDouble = false
      out += ch
      i++
      continue
    }

    if (inSingle || inDouble) {
      out += ch
      i++
      continue
    }

    // Collapse existing whitespace to a single space (except around structural chars)
    if (/\s/.test(ch)) {
      // skip runs of whitespace; insert space only between tokens if needed
      let j = i
      while (j < input.length && /\s/.test(input[j]!)) j++
      const prev = out[out.length - 1]
      const next = input[j]
      if (
        prev &&
        next &&
        !/[\[\{\(\.,:]/.test(prev) &&
        !/[\]\}\),\.]/.test(next) &&
        prev !== ' ' &&
        prev !== '\n'
      ) {
        out += ' '
      }
      i = j
      continue
    }

    if (ch === '{' || ch === '[') {
      const nextNonWs = peekNonWs(input, i + 1)
      const closer = ch === '{' ? '}' : ']'
      out += ch
      if (nextNonWs && nextNonWs !== closer) {
        depth++
        newlineIndent()
      }
      i++
      continue
    }

    // Keep function calls compact: ISODate('…'), .limit(100); expand find/aggregate when arg is object/array
    if (ch === '(') {
      const nextNonWs = peekNonWs(input, i + 1)
      const expanded = nextNonWs === '{' || nextNonWs === '['
      parenExpanded.push(expanded)
      out += ch
      if (expanded) {
        depth++
        newlineIndent()
      }
      i++
      continue
    }

    if (ch === '}' || ch === ']') {
      const opener = ch === '}' ? '{' : '['
      const prevNonWs = out.replace(/\s+$/, '').slice(-1)
      if (prevNonWs !== opener) {
        depth = Math.max(depth - 1, 0)
        newlineIndent()
      } else {
        depth = Math.max(depth - 1, 0)
      }
      out += ch
      i++
      continue
    }

    if (ch === ')') {
      const expanded = parenExpanded.pop() ?? false
      if (expanded) {
        depth = Math.max(depth - 1, 0)
        newlineIndent()
      }
      out += ch
      i++
      continue
    }

    if (ch === ',') {
      out += ch
      const nextNonWs = peekNonWs(input, i + 1)
      if (nextNonWs && nextNonWs !== '}' && nextNonWs !== ']' && nextNonWs !== ')') {
        newlineIndent()
      }
      i++
      continue
    }

    if (ch === ':') {
      out += ': '
      // skip following whitespace
      i++
      while (i < input.length && /\s/.test(input[i]!)) i++
      continue
    }

    // Method chaining: ).limit( → )\n.limit(
    if (ch === '.' && /[)\]]\s*$/.test(out)) {
      newlineIndent()
      out += ch
      i++
      continue
    }

    out += ch
    i++
  }

  return out
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trim()
}

function peekNonWs(s: string, from: number): string | null {
  for (let i = from; i < s.length; i++) {
    if (!/\s/.test(s[i]!)) return s[i]!
  }
  return null
}

export type ExtractedMongoPayload = {
  kind: 'filter' | 'pipeline' | 'args'
  label: string
  /** Pretty shell/object text for display */
  pretty: string
  /** JSON-compatible value when parseable */
  json: unknown | null
}

/**
 * Extract first meaningful object/array argument from find/aggregate/count/distinct.
 */
export function extractMongoPayload(query: string): ExtractedMongoPayload | null {
  const q = query.replace(/\r\n/g, '\n').trim()
  const method =
    q.match(/\.aggregate\s*\(/i) ??
    q.match(/\.find\s*\(/i) ??
    q.match(/\.countDocuments\s*\(/i) ??
    q.match(/\.count\s*\(/i) ??
    q.match(/\.distinct\s*\(/i)

  if (!method || method.index === undefined) return null

  const openParen = q.indexOf('(', method.index + method[0].length - 1)
  if (openParen < 0) return null

  const argStart = skipWs(q, openParen + 1)
  if (argStart >= q.length) return null

  const startCh = q[argStart]
  if (startCh !== '{' && startCh !== '[') {
    // distinct("field", {filter})
    if (startCh === '"' || startCh === "'") {
      const afterString = skipString(q, argStart)
      const comma = q.indexOf(',', afterString)
      if (comma < 0) return null
      const objStart = skipWs(q, comma + 1)
      if (q[objStart] !== '{') return null
      const obj = sliceBalanced(q, objStart)
      if (!obj) return null
      return toPayload('filter', 'Filter', obj)
    }
    return null
  }

  const body = sliceBalanced(q, argStart)
  if (!body) return null

  const isAggregate = /\.aggregate\s*\(/i.test(method[0])
  return toPayload(isAggregate ? 'pipeline' : 'filter', isAggregate ? 'Pipeline' : 'Filter', body)
}

function toPayload(
  kind: ExtractedMongoPayload['kind'],
  label: string,
  raw: string,
): ExtractedMongoPayload {
  const pretty = formatMongoShell(raw)
  return {
    kind,
    label,
    pretty,
    json: mongoLiteralToJson(raw),
  }
}

function skipWs(s: string, i: number): number {
  while (i < s.length && /\s/.test(s[i]!)) i++
  return i
}

function skipString(s: string, i: number): number {
  const quote = s[i]
  if (quote !== '"' && quote !== "'") return i
  i++
  let escape = false
  while (i < s.length) {
    const ch = s[i]!
    if (escape) {
      escape = false
      i++
      continue
    }
    if (ch === '\\') {
      escape = true
      i++
      continue
    }
    if (ch === quote) return i + 1
    i++
  }
  return i
}

function sliceBalanced(s: string, start: number): string | null {
  const open = s[start]
  const close = open === '{' ? '}' : open === '[' ? ']' : null
  if (!close) return null

  let depth = 0
  let inSingle = false
  let inDouble = false
  let escape = false

  for (let i = start; i < s.length; i++) {
    const ch = s[i]!
    if (escape) {
      escape = false
      continue
    }
    if ((inSingle || inDouble) && ch === '\\') {
      escape = true
      continue
    }
    if (!inDouble && ch === "'" && !inSingle) {
      inSingle = true
      continue
    }
    if (inSingle && ch === "'") {
      inSingle = false
      continue
    }
    if (!inSingle && ch === '"' && !inDouble) {
      inDouble = true
      continue
    }
    if (inDouble && ch === '"') {
      inDouble = false
      continue
    }
    if (inSingle || inDouble) continue

    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

/** Best-effort convert mongo shell literal to JSON value (EJSON-friendly). */
export function mongoLiteralToJson(literal: string): unknown | null {
  let s = literal.trim()
  // ISODate / ObjectId → Extended JSON (Atlas / Compass Filter paste)
  s = s.replace(/\bISODate\s*\(\s*(['"])(.*?)\1\s*\)/g, '{ "$date": "$2" }')
  s = s.replace(/\bObjectId\s*\(\s*(['"])(.*?)\1\s*\)/g, '{ "$oid": "$2" }')
  s = s.replace(/\bNumberLong\s*\(\s*(['"])?(.*?)\1?\s*\)/g, (_, _q, n) => String(n))
  // single-quoted strings → double-quoted
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, inner: string) => {
    const escaped = inner.replace(/\\'/g, "'").replace(/"/g, '\\"')
    return `"${escaped}"`
  })
  // unquoted keys → quoted (simple identifier keys; keep $ops)
  s = s.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3')
  // trailing commas
  s = s.replace(/,\s*([}\]])/g, '$1')

  try {
    return JSON.parse(s) as unknown
  } catch {
    return null
  }
}

export function jsonPretty(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

/**
 * Text for MongoDB Atlas / Compass **Filter** (or Aggregations) paste box.
 * Never wraps `db.collection.find(...)`.
 * Dates/ObjectIds use shell helpers (ISODate / ObjectId) — Atlas Filter accepts these
 * more reliably than nested Extended JSON `{ "$date": "..." }`.
 */
export function toCompassPasteText(query: string): string | null {
  const payload = extractMongoPayload(query)
  if (!payload) return null
  const value =
    payload.json ?? mongoLiteralToJson(payload.pretty)
  if (value == null) return null
  return toCompassFilterLiteral(value)
}

/** Pretty MQL literal for Atlas Filter / Compass paste. */
export function toCompassFilterLiteral(value: unknown, indent = 0): string {
  const pad = INDENT.repeat(indent)
  const padInner = INDENT.repeat(indent + 1)

  if (value === null) return 'null'
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  if (typeof value === 'string') return JSON.stringify(value)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((v) => `${padInner}${toCompassFilterLiteral(v, indent + 1)}`)
    return `[\n${items.join(',\n')}\n${pad}]`
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    // Extended JSON → shell helpers
    if (typeof obj.$date === 'string' && Object.keys(obj).length === 1) {
      return `ISODate(${JSON.stringify(obj.$date)})`
    }
    if (typeof obj.$oid === 'string' && Object.keys(obj).length === 1) {
      return `ObjectId(${JSON.stringify(obj.$oid)})`
    }

    const keys = Object.keys(obj)
    if (keys.length === 0) return '{}'
    const lines = keys.map((k) => {
      const key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)
      return `${padInner}${key}: ${toCompassFilterLiteral(obj[k], indent + 1)}`
    })
    return `{\n${lines.join(',\n')}\n${pad}}`
  }

  return JSON.stringify(value)
}

export type HighlightToken =
  | { type: 'plain'; text: string }
  | { type: 'key'; text: string }
  | { type: 'string'; text: string }
  | { type: 'number'; text: string }
  | { type: 'boolean'; text: string }
  | { type: 'null'; text: string }
  | { type: 'punct'; text: string }
  | { type: 'method'; text: string }
  | { type: 'comment'; text: string }
  | { type: 'fn'; text: string }

/** Lightweight tokenizer for mongo shell / JSON-ish display. */
export function tokenizeMongo(code: string): HighlightToken[] {
  const tokens: HighlightToken[] = []
  const re =
    /(\/\/[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(true|false|null)\b|\b(ISODate|ObjectId|NumberLong|NumberInt)\b|\b(db)\b|(\.[A-Za-z_]\w*)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\](),:;])|(\$[A-Za-z]\w*)|([A-Za-z_$][\w$]*)|(\s+)|(.)/g

  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    const [
      ,
      comment,
      str,
      boolNull,
      fn,
      db,
      method,
      num,
      punct,
      dollar,
      ident,
      ws,
      other,
    ] = m

    if (comment) tokens.push({ type: 'comment', text: comment })
    else if (str) tokens.push({ type: 'string', text: str })
    else if (boolNull === 'null') tokens.push({ type: 'null', text: boolNull })
    else if (boolNull) tokens.push({ type: 'boolean', text: boolNull })
    else if (fn) tokens.push({ type: 'fn', text: fn })
    else if (db) tokens.push({ type: 'method', text: db })
    else if (method) tokens.push({ type: 'method', text: method })
    else if (num) tokens.push({ type: 'number', text: num })
    else if (punct) tokens.push({ type: 'punct', text: punct })
    else if (dollar) tokens.push({ type: 'key', text: dollar })
    else if (ident) {
      // key if followed by :
      const rest = code.slice(m.index + ident.length)
      if (/^\s*:/.test(rest)) tokens.push({ type: 'key', text: ident })
      else tokens.push({ type: 'plain', text: ident })
    } else if (ws) tokens.push({ type: 'plain', text: ws })
    else if (other) tokens.push({ type: 'plain', text: other })
  }
  return tokens
}
