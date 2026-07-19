/* ─────────────────────────────────────────────────────────────────────────────
 * Architecture Decisions — Current vs. Target architecture, with "metro line" animation.
 * Current: traveling dot healthy→green, critical→red.
 * Target (PLAN5): Compose+MVI · Domain UseCase · Room SSoT · Outbox/WorkManager —
 *   dot is green end-to-end; each stop describes which structural flaw it resolves.
 * ──────────────────────────────────────────────────────────────────────────── */
// @ts-nocheck -- The fixed waypoint arrays from the source report are preserved as-is.
'use client'

import { useEffect, useRef, useState } from 'react'
import { Info, Pause, Play } from 'lucide-react'

const O = '#ea6a1e'   // orange
const B = '#1f5fe0'   // blue
const GA = '#0e9f6e'  // green (target left columns)
const BD = '#3b82f6'  // dashed feedback

type ThemeKey = 'orange' | 'blue' | 'blueSoft' | 'groupItem' | 'green' | 'greenSoft' | 'greenItem'
const THEMES: Record<ThemeKey, { fill: string; stroke: string; icon: string; title: string; sub: string }> = {
  orange:    { fill: '#fff6ed', stroke: '#f4b079', icon: O,  title: '#13233f', sub: '#94a3b8' },
  blue:      { fill: '#f3f7ff', stroke: '#c4d6f4', icon: B,  title: '#16315f', sub: '#67748a' },
  blueSoft:  { fill: '#eaf1fe', stroke: '#c4d6f4', icon: B,  title: '#16315f', sub: '#67748a' },
  groupItem: { fill: '#ffffff', stroke: '#f4b079', icon: O,  title: '#16315f', sub: '#94a3b8' },
  green:     { fill: '#f0fdf4', stroke: '#a7e3bf', icon: GA, title: '#0f3b2e', sub: '#6b8a7e' },
  greenSoft: { fill: '#e7f8ee', stroke: '#a7e3bf', icon: GA, title: '#0f3b2e', sub: '#6b8a7e' },
  greenItem: { fill: '#ffffff', stroke: '#a7e3bf', icon: GA, title: '#0f3b2e', sub: '#6b8a7e' },
}

type Health = 'good' | 'warn' | 'bad'
const HEALTH: Record<Health, string> = { good: '#16a34a', warn: '#d9810a', bad: '#dc2626' }
const HEALTH_LABEL: Record<Health, string> = { good: 'Healthy', warn: 'Warning', bad: 'Critical' }

type FlowSummaryDef = {
  steps: string[]
  highlightsTitle: string
  highlights: { label: string; health: Health }[]
  footer?: string
}
const TRAIL = 7
const DUR = 22000

function hexToRgb(h: string) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
function lerpColor(a: string, b: string, t: number) {
  const x = hexToRgb(a), y = hexToRgb(b)
  return `rgb(${Math.round(x[0] + (y[0] - x[0]) * t)},${Math.round(x[1] + (y[1] - x[1]) * t)},${Math.round(x[2] + (y[2] - x[2]) * t)})`
}

type WP = [number, number][]
type StationDef = { wp: number; label: string; note: string; health: Health }

/* ─── line icons ─────────────────────────────────────────────────────────────── */
function Glyph({ name, color }: { name: string; color: string }) {
  switch (name) {
    case 'scan': return <>
      <path d="M-13 -7 V-12 H-8" /><path d="M8 -12 H13 V-7" /><path d="M13 7 V12 H8" /><path d="M-8 12 H-13 V7" />
      <line x1={-6} y1={-6} x2={-6} y2={6} /><line x1={-1.5} y1={-6} x2={-1.5} y2={6} /><line x1={3} y1={-6} x2={3} y2={6} /><line x1={8} y1={-6} x2={8} y2={6} />
    </>
    case 'task': return <><rect x={-9} y={-10} width={18} height={22} rx={2.5} /><rect x={-4} y={-13} width={8} height={5} rx={1.5} /><path d="M-4 2 l3 3 l6 -7" /></>
    case 'wifi': return <><path d="M-12 -3 a16 16 0 0 1 24 0" /><path d="M-7 2 a9 9 0 0 1 14 0" /><circle cx={0} cy={8} r={1.7} fill={color} stroke="none" /></>
    case 'phone': return <><rect x={-7} y={-12} width={14} height={24} rx={3} /><line x1={-2.5} y1={8} x2={2.5} y2={8} /></>
    case 'cube': return <><path d="M0 -12 L11 -6 V6 L0 12 L-11 6 V-6 Z" /><path d="M-11 -6 L0 0 L11 -6" /><line x1={0} y1={0} x2={0} y2={12} /></>
    case 'people': return <><circle cx={-5} cy={-5} r={3.3} /><circle cx={6} cy={-5} r={3.3} /><path d="M-12 9 a6.5 6.5 0 0 1 13 0" /><path d="M-1 9 a6.5 6.5 0 0 1 13 0" /></>
    case 'gear': return <><circle r={5.5} /><path d="M0 -12 V-8 M0 8 V12 M-12 0 H-8 M8 0 H12 M-8.5 -8.5 l2.8 2.8 M5.7 5.7 l2.8 2.8 M8.5 -8.5 l-2.8 2.8 M-5.7 5.7 l-2.8 2.8" /></>
    case 'person': return <><circle cx={0} cy={-6} r={4} /><path d="M-8 11 a8 8 0 0 1 16 0" /></>
    case 'shield': return <><path d="M0 -12 L10 -8 V1 C10 8 0 12 0 12 C0 12 -10 8 -10 1 V-8 Z" /><path d="M-4 0 l3 3 l6 -7" /></>
    case 'calendar': return <><rect x={-10} y={-9} width={20} height={20} rx={2.5} /><line x1={-10} y1={-3} x2={10} y2={-3} /><line x1={-5} y1={-9} x2={-5} y2={-13} /><line x1={5} y1={-9} x2={5} y2={-13} /><path d="M-2 4 l2 2 l4 -5" /></>
    case 'db': return <><ellipse cx={0} cy={-7} rx={10} ry={3.6} /><path d="M-10 -7 V7 a10 3.6 0 0 0 20 0 V-7" /><path d="M-10 0 a10 3.6 0 0 0 20 0" /></>
    case 'file': return <><path d="M-8 -12 H3 L9 -6 V12 H-8 Z" /><path d="M3 -12 V-6 H9" /><line x1={-4} y1={-1} x2={5} y2={-1} /><line x1={-4} y1={4} x2={5} y2={4} /></>
    case 'globe': return <><circle r={11} /><ellipse rx={4.5} ry={11} /><line x1={-11} y1={0} x2={11} y2={0} /></>
    case 'clock': return <><circle r={11} /><path d="M0 -6 V0 L5 4" /></>
    case 'send': return <><path d="M-12 -8 L12 0 L-12 8 L-8 0 Z" /><line x1={-8} y1={0} x2={12} y2={0} /></>
    case 'refresh': return <><path d="M9 -4 A10 10 0 1 0 11 5" /><path d="M11 -9 L11 -3 L5 -3" /></>
    case 'cloud': return <path d="M-8 6 a6 6 0 0 1 0.5 -12 a8 8 0 0 1 15 3 a5 5 0 0 1 -1.5 9 Z" />
    case 'target': return <><circle r={11} /><circle r={6} /><circle r={1.8} fill={color} stroke="none" /></>
    case 'sitemap': return <><rect x={-5} y={-13} width={10} height={8} rx={1.5} /><rect x={-14} y={5} width={10} height={8} rx={1.5} /><rect x={4} y={5} width={10} height={8} rx={1.5} /><path d="M0 -5 V0 M-9 5 V0 H9 V5" /></>
    case 'layers': return <><path d="M0 -11 L12 -4 L0 3 L-12 -4 Z" /><path d="M-12 2 L0 9 L12 2" /></>
    case 'bolt': return <path d="M2 -12 L-7 2 H0 L-2 12 L9 -3 H2 Z" />
    case 'flag': return <><line x1={-8} y1={-12} x2={-8} y2={12} /><path d="M-8 -11 H9 L5 -6 L9 -1 H-8" /></>
    case 'check': return <><circle r={11} /><path d="M-5 0 l3.5 3.5 l7 -8" /></>
    case 'route': return <><circle cx={-8} cy={-8} r={3} /><circle cx={8} cy={8} r={3} /><path d="M-8 -5 V4 a4 4 0 0 0 4 4 H5" strokeDasharray="3 3" /></>
    default: return null
  }
}
function Icon({ name, x, y, color }: { name: string; x: number; y: number; color: string }) {
  return <g transform={`translate(${x},${y})`} stroke={color} strokeWidth={2.1} fill="none" strokeLinecap="round" strokeLinejoin="round"><Glyph name={name} color={color} /></g>
}

/* ─── box ─────────────────────────────────────────────────────────────────────── */
interface BoxProps { x: number; y: number; w: number; h: number; icon: string; title: string; subs?: string[]; theme: ThemeKey; titleSize?: number }
function Box({ x, y, w, h, icon, title, subs = [], theme, titleSize = 21 }: BoxProps) {
  const t = THEMES[theme]
  const cx = x + 34, cy = y + h / 2
  const n = subs.length
  const titleY = n === 0 ? cy + 2 : n === 1 ? cy - 7 : cy - 16
  const subStart = n === 1 ? cy + 14 : cy + 5
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={14} fill={t.fill} stroke={t.stroke} strokeWidth={1.6} />
      <Icon name={icon} x={cx} y={cy} color={t.icon} />
      <text x={x + 64} y={titleY} fontSize={titleSize} fontWeight={700} fill={t.title} dominantBaseline="middle">{title}</text>
      {subs.map((s, i) => <text key={i} x={x + 64} y={subStart + i * 19} fontSize={14.5} fill={t.sub} dominantBaseline="middle">{s}</text>)}
    </g>
  )
}
function Header({ x, icon, color, label }: { x: number; icon: string; color: string; label: string }) {
  return <>
    <Icon name={icon} x={x} y={50} color={color} />
    <text x={x + 28} y={50} fontSize={22} fontWeight={800} letterSpacing="0.04em" fill="#16223c" dominantBaseline="middle">{label}</text>
  </>
}

/* ════════════════════════ CURRENT ARCHITECTURE CONTENT ════════════════════════ */
const CURRENT_WP: WP = [
  [220, 206], [410, 206], [440, 206], [440, 196], [470, 196],
  [660, 196], [660, 328], [660, 404], [660, 553],
  [850, 554], [905, 554], [908, 554], [908, 424], [940, 424],
  [1145, 424], [1370, 424], [1450, 424], [1610, 424], [1610, 560],
  [1610, 616], [1770, 616], [1800, 616], [1895, 616], [1895, 672], [1895, 880], [660, 880], [660, 706],
]
const CURRENT_STATIONS: StationDef[] = [
  { wp: 0,  label: 'Scan / Delivery / Pickup', note: 'Barcode routing and event parsing are embedded in UI classes; StopList/TaskList Fragments bloat to 5–7K lines.', health: 'warn' },
  { wp: 5,  label: 'Feature ViewModels',        note: 'VMs stay thin but real logic leaks into SharedViewModel; screen vs. state boundary is unclear.', health: 'warn' },
  { wp: 6,  label: 'SharedViewModel',           note: 'God object (~3,450 lines): every screen depends on it, no single reliable SSoT — any change can break everything.', health: 'bad' },
  { wp: 8,  label: 'Orchestration',              note: 'Business rules + offline flow in one chain; cannot be tested in isolation (0 tests), high regression risk.', health: 'bad' },
  { wp: 14, label: 'Room / AppDatabase',        note: 'JSON chunk + allowMainThreadQueries() → screen freezes (ANR); destructive migration causes data loss on schema changes.', health: 'bad' },
  { wp: 17, label: 'RequestSenderService',      note: 'Single service with 3s polling + single APIService (527 endpoints); no backoff, "last writer wins" on conflicts.', health: 'warn' },
  { wp: 19, label: 'WorkManager / Retry',       note: 'Dependency added but never used; reliability depends on foreground service staying alive.', health: 'warn' },
  { wp: 22, label: 'Backend Services',          note: 'Service returns response; no idempotency, duplicate submission window open on process death.', health: 'warn' },
  { wp: 26, label: 'Return to UI',              note: 'State is not reactive; updates are manually propagated, screen refreshes with delay or incompletely.', health: 'warn' },
]
const COL1 = [
  { icon: 'scan',  title: 'Scan / Delivery / Pickup', sub: 'User actions' },
  { icon: 'task',  title: 'Task / Stop Operations',    sub: 'Operation events' },
  { icon: 'wifi',  title: 'Network Change',          sub: 'Online / offline status' },
  { icon: 'phone', title: 'Session / Device Events', sub: 'Session and device triggers' },
]
const GROUP_ITEMS = [
  { icon: 'gear', title: 'ScanProcessor' }, { icon: 'person', title: 'ScanCoordinator' },
  { icon: 'shield', title: 'ScanQueueGuard' }, { icon: 'calendar', title: 'ScheduleSessionValidator' },
]
function CurrentContent() {
  return <>
    {[440, 910, 1430].map((x) => <line key={x} x1={x} y1={95} x2={x} y2={822} stroke="#e6ebf2" strokeWidth={1.5} />)}
    <Header x={72} icon="target" color={O} label="1  EVENT SOURCES" />
    <Header x={488} icon="sitemap" color={O} label="2  VIEWMODEL & ORCHESTRATION" />
    <Header x={952} icon="db" color={B} label="3  REPOSITORY & PERSISTENCE" />
    <Header x={1472} icon="refresh" color={B} label="4  SYNCHRONIZATION" />

    {[206, 348, 490, 632].map((y) => <line key={y} x1={410} y1={y} x2={440} y2={y} stroke={O} strokeWidth={2.2} />)}
    <line x1={440} y1={196} x2={440} y2={632} stroke={O} strokeWidth={2.2} />
    <line x1={440} y1={196} x2={470} y2={196} stroke={O} strokeWidth={2.2} markerEnd="url(#ah-o)" />
    <line x1={440} y1={328} x2={470} y2={328} stroke={O} strokeWidth={2.2} markerEnd="url(#ah-o)" />
    <line x1={660} y1={242} x2={660} y2={282} stroke={O} strokeWidth={2.2} markerStart="url(#ah-o)" markerEnd="url(#ah-o)" />
    <line x1={660} y1={374} x2={660} y2={404} stroke={O} strokeWidth={2.2} markerEnd="url(#ah-o)" />
    <line x1={850} y1={554} x2={905} y2={554} stroke={O} strokeWidth={2.4} markerEnd="url(#ah-o)" />
    <line x1={908} y1={424} x2={908} y2={692} stroke={B} strokeWidth={2.2} />
    {[424, 558, 692].map((y) => <line key={y} x1={908} y1={y} x2={940} y2={y} stroke={B} strokeWidth={2.2} markerEnd="url(#ah-b)" />)}
    <line x1={1155} y1={326} x2={1155} y2={372} stroke={B} strokeWidth={2.2} markerEnd="url(#ah-b)" />
    <line x1={1370} y1={424} x2={1450} y2={424} stroke={B} strokeWidth={2.2} markerStart="url(#ah-b)" markerEnd="url(#ah-b)" />
    <line x1={1610} y1={250} x2={1610} y2={374} stroke={B} strokeWidth={2.2} markerEnd="url(#ah-b)" />
    <line x1={1610} y1={474} x2={1610} y2={560} stroke={B} strokeWidth={2.2} markerEnd="url(#ah-b)" />
    <line x1={1770} y1={616} x2={1800} y2={616} stroke={B} strokeWidth={2.2} markerEnd="url(#ah-b)" />
    <path d="M955 150 V118 H660 V150" fill="none" stroke={BD} strokeWidth={2} strokeDasharray="6 6" markerEnd="url(#ah-bs)" />
    <text x={808} y={107} fontSize={15} fontWeight={600} fill="#5b7bbf" textAnchor="middle">State / UI update</text>
    <path d="M1895 672 V880 H660 V706" fill="none" stroke={BD} strokeWidth={2} strokeDasharray="6 6" markerEnd="url(#ah-bs)" />
    <text x={1290} y={868} fontSize={15} fontWeight={600} fill="#5b7bbf" textAnchor="middle">Response / status update</text>

    {COL1.map((b, i) => <Box key={b.title} x={30} y={150 + i * 142} w={380} h={112} icon={b.icon} title={b.title} subs={[b.sub]} theme="orange" titleSize={19} />)}
    <Box x={470} y={150} w={380} h={92} icon="cube" title="Feature ViewModels" theme="orange" />
    <Box x={470} y={282} w={380} h={92} icon="people" title="SharedViewModel" subs={['Central application state']} theme="orange" />
    <rect x={470} y={404} width={380} height={300} rx={16} fill="#fffdf9" stroke="#f0a868" strokeWidth={1.8} strokeDasharray="6 5" />
    {GROUP_ITEMS.map((g, i) => <Box key={g.title} x={490} y={424 + i * 66} w={340} h={56} icon={g.icon} title={g.title} theme="groupItem" titleSize={18} />)}
    <rect x={940} y={150} width={430} height={176} rx={14} fill="#eaf1fe" stroke="#c4d6f4" strokeWidth={1.6} />
    <Icon name="db" x={974} y={186} color={B} />
    <text x={1004} y={186} fontSize={21} fontWeight={700} fill="#16315f" dominantBaseline="middle">Repository Layer</text>
    {['MainRepository', 'ScheduleRepositoryImpl', 'LocationRepositoryImpl'].map((b, i) => <text key={b} x={978} y={234 + i * 30} fontSize={16.5} fill="#33507e">•  {b}</text>)}
    <Box x={940} y={372} w={430} h={104} icon="db" title="Room / AppDatabase" subs={['RequestDao, ScheduleDao,', 'ParcelDao, LiveLocationDao']} theme="blue" />
    <Box x={940} y={508} w={430} h={100} icon="file" title="SharedPreferences / JsonSerializer" subs={['Cache and auxiliary data']} theme="blue" titleSize={18} />
    <Box x={940} y={640} w={430} h={104} icon="globe" title="APIService / Retrofit / OkHttp" subs={['Remote access']} theme="blue" titleSize={18} />
    <Box x={1450} y={150} w={320} h={100} icon="clock" title="Offline Queue" subs={['Pending request records']} theme="blue" titleSize={18} />
    <Box x={1450} y={374} w={320} h={100} icon="send" title="RequestSenderService" subs={['Dispatches queued jobs']} theme="blue" titleSize={18} />
    <Box x={1450} y={560} w={320} h={112} icon="refresh" title="WorkManager / Retry" subs={['Background execution,', 'retry / backoff']} theme="blue" titleSize={18} />
    <Box x={1800} y={560} w={190} h={112} icon="cloud" title="Backend" subs={['API endpoints /', 'operation services']} theme="blue" titleSize={17} />
  </>
}

/* ════════════════════════ TARGET ARCHITECTURE CONTENT (PLAN5) ════════════════════════ */
const TARGET_WP: WP = [
  [220, 206], [220, 348], [220, 490], [410, 490], [440, 490], [440, 196], [470, 196],
  [660, 196], [660, 300], [660, 500],
  [850, 500], [905, 500], [908, 500], [908, 424], [940, 424],
  [1155, 424], [1155, 476], [1155, 692],
  [1370, 692], [1450, 692], [1610, 692], [1610, 474], [1610, 422],
  [1770, 422], [1800, 422], [1895, 422], [1895, 474], [1895, 840], [660, 840], [660, 760],
]
const TARGET_STATIONS: StationDef[] = [
  { wp: 0,  label: 'Compose Screens', note: 'User action becomes a UiAction — unidirectional data flow (UDF), no business rules.', health: 'good' },
  { wp: 2,  label: 'BaseMviViewModel · reduce()', note: 'reduce(state, action) is a pure function: testable without UI, the cheapest way out of 0% test coverage.', health: 'good' },
  { wp: 7,  label: 'UseCase', note: 'Orchestrates the workflow; rules in one place, screen-independent — God object eliminated.', health: 'good' },
  { wp: 9,  label: 'Domain tools', note: 'Specification / RuleEngine / Policy + DeliveryMediator → consistent status propagation in a single @Transaction.', health: 'good' },
  { wp: 15, label: 'Room SSoT (normalize)', note: 'Single source of truth: StopEntity…ItemEntity relational; reactive Flow, no main-thread queries.', health: 'good' },
  { wp: 17, label: 'OutboxEventEntity', note: 'Every write creates an outbox record; idempotencyKey + traceId → duplicate collection / data loss structurally impossible.', health: 'good' },
  { wp: 20, label: 'core:sync · Outbox Processor', note: 'Processes events sequentially and per-aggregate; ordering violations and zombie requests eliminated.', health: 'good' },
  { wp: 22, label: 'WorkManager', note: 'Guaranteed sync: exponential backoff + decorrelated jitter; OS restarts even if process dies.', health: 'good' },
  { wp: 25, label: 'Backend Services', note: 'Request arrives exactly-once (idempotent); response is written to SSoT, no blind spots (trace-id).', health: 'good' },
  { wp: 29, label: 'Reactive return to UI', note: 'Room → Flow → UiState → Compose; screen refreshes automatically, consistently and without delay.', health: 'good' },
]
const T_COL1 = [
  { icon: 'cube',    title: 'Compose Screens', subs: ['StopList · Delivery · ScanParcel'] },
  { icon: 'file',    title: 'UiState / UiAction / UiEffect', subs: ['Single immutable state + one-shot effect'] },
  { icon: 'gear',    title: 'BaseMviViewModel', subs: ['reduce(state, action) → state'] },
  { icon: 'route',   title: 'Navigation (typed routes)', subs: ['Compose Navigation Component'] },
]
const T_GROUP = [
  { icon: 'check',   title: 'Specification' }, { icon: 'gear', title: 'RuleEngine' },
  { icon: 'sitemap', title: 'DeliveryMediator' }, { icon: 'flag', title: 'Policy / Strategy' },
]
const T_COL4 = [
  { icon: 'wifi',    title: 'NetworkQualityManager', subs: ['Dispatch based on network quality'], y: 180, h: 100 },
  { icon: 'refresh', title: 'WorkManager', subs: ['backoff + decorrelated jitter'], y: 370, h: 104 },
  { icon: 'bolt',    title: 'core:sync · Outbox Processor', subs: ['Sequential, guaranteed, idempotent'], y: 640, h: 104 },
]
function TargetContent() {
  return <>
    {[440, 910, 1430].map((x) => <line key={x} x1={x} y1={95} x2={x} y2={822} stroke="#e6ebf2" strokeWidth={1.5} />)}
    <Header x={72} icon="cube" color={GA} label="1  UI · COMPOSE + MVI" />
    <Header x={488} icon="layers" color={GA} label="2  DOMAIN · USECASE" />
    <Header x={952} icon="db" color={B} label="3  DATA · ROOM SSoT" />
    <Header x={1472} icon="bolt" color={B} label="4  SYNC · OFFLINE-FIRST" />

    {/* col1 internal UDF chain */}
    <line x1={220} y1={262} x2={220} y2={292} stroke={GA} strokeWidth={2.2} markerStart="url(#ah-g)" markerEnd="url(#ah-g)" />
    <line x1={220} y1={404} x2={220} y2={434} stroke={GA} strokeWidth={2.2} markerStart="url(#ah-g)" markerEnd="url(#ah-g)" />
    <line x1={220} y1={546} x2={220} y2={576} stroke={GA} strokeWidth={2.2} markerEnd="url(#ah-g)" />
    {/* ViewModel → UseCase (elbow) */}
    <path d="M410 490 H440 V196 H470" fill="none" stroke={GA} strokeWidth={2.2} markerEnd="url(#ah-g)" />
    {/* UseCase → group */}
    <line x1={660} y1={242} x2={660} y2={300} stroke={GA} strokeWidth={2.2} markerEnd="url(#ah-g)" />
    {/* group → data */}
    <line x1={850} y1={500} x2={905} y2={500} stroke={GA} strokeWidth={2.4} markerEnd="url(#ah-g)" />
    {/* col3 internal */}
    <line x1={908} y1={424} x2={908} y2={558} stroke={B} strokeWidth={2.2} />
    {[424, 558].map((y) => <line key={y} x1={908} y1={y} x2={940} y2={y} stroke={B} strokeWidth={2.2} markerEnd="url(#ah-b)" />)}
    <line x1={1155} y1={326} x2={1155} y2={372} stroke={B} strokeWidth={2.2} markerEnd="url(#ah-b)" />
    <line x1={1155} y1={476} x2={1155} y2={640} stroke={B} strokeWidth={2.2} markerEnd="url(#ah-b)" />
    {/* data → sync */}
    <line x1={1370} y1={692} x2={1450} y2={692} stroke={B} strokeWidth={2.2} markerEnd="url(#ah-b)" />
    <line x1={1610} y1={640} x2={1610} y2={474} stroke={B} strokeWidth={2.2} markerEnd="url(#ah-b)" />
    <line x1={1610} y1={280} x2={1610} y2={370} stroke={B} strokeWidth={2.2} markerEnd="url(#ah-b)" />
    <line x1={1770} y1={422} x2={1800} y2={422} stroke={B} strokeWidth={2.2} markerEnd="url(#ah-b)" />
    {/* reactive feedback (Room → Flow → UI) */}
    <path d="M945 372 V118 H220 V150" fill="none" stroke={BD} strokeWidth={2} strokeDasharray="6 6" markerEnd="url(#ah-bs)" />
    <text x={560} y={107} fontSize={15} fontWeight={600} fill="#3f9b6e" textAnchor="middle">reactive state · Flow</text>
    <path d="M1895 474 V840 H660 V760" fill="none" stroke={BD} strokeWidth={2} strokeDasharray="6 6" markerEnd="url(#ah-bs)" />
    <text x={1290} y={828} fontSize={15} fontWeight={600} fill="#3f9b6e" textAnchor="middle">response → SSoT → Flow → UI</text>

    {/* col1 boxes */}
    {T_COL1.map((b, i) => <Box key={b.title} x={30} y={150 + i * 142} w={380} h={112} icon={b.icon} title={b.title} subs={b.subs} theme="green" titleSize={18} />)}
    {/* col2 */}
    <Box x={470} y={150} w={380} h={92} icon="check" title="UseCase" subs={['Orchestrates the screen flow']} theme="green" />
    <rect x={470} y={300} width={380} height={404} rx={16} fill="#f6fef9" stroke="#86d6a6" strokeWidth={1.8} strokeDasharray="6 5" />
    <text x={490} y={326} fontSize={13.5} fontWeight={700} fill="#0e9f6e" letterSpacing="0.04em">USECASE TOOLS</text>
    {T_GROUP.map((g, i) => <Box key={g.title} x={490} y={344 + i * 84} w={340} h={66} icon={g.icon} title={g.title} theme="greenItem" titleSize={18} />)}
    {/* col3 */}
    <rect x={940} y={150} width={430} height={176} rx={14} fill="#eaf1fe" stroke="#c4d6f4" strokeWidth={1.6} />
    <Icon name="db" x={974} y={186} color={B} />
    <text x={1004} y={186} fontSize={21} fontWeight={700} fill="#16315f" dominantBaseline="middle">Repository</text>
    {['StopRepository · DeliveryRepository', 'OutboxRepository', 'LocationRepository'].map((b, i) => <text key={b} x={978} y={234 + i * 30} fontSize={15.5} fill="#33507e">•  {b}</text>)}
    <Box x={940} y={372} w={430} h={104} icon="db" title="Room SSoT (normalize)" subs={['Stop · Task · Shipment · Item ·', 'Collection · @Relation read-model']} theme="blue" titleSize={19} />
    <Box x={940} y={508} w={430} h={100} icon="file" title="@Transaction / @Relation" subs={['Derived status · single write (Mediator)']} theme="blue" titleSize={18} />
    <Box x={940} y={640} w={430} h={104} icon="layers" title="OutboxEventEntity" subs={['idempotencyKey · traceId ·', 'status · nextAttemptAt']} theme="blueSoft" titleSize={18} />
    {/* col4 */}
    {T_COL4.map((b) => <Box key={b.title} x={1450} y={b.y} w={320} h={b.h} icon={b.icon} title={b.title} subs={b.subs} theme="blue" titleSize={17} />)}
    <Box x={1800} y={370} w={190} h={104} icon="cloud" title="Backend" subs={['Idempotent', 'endpoints']} theme="blue" titleSize={17} />
  </>
}

/* ════════════════════════ ANIMATED FLOW FRAME ════════════════════════ */
interface FlowProps {
  eyebrow: string; title: string; sub: string
  waypoints: WP; stations: StationDef[]
  summary: FlowSummaryDef
  children: React.ReactNode
}

function FlowSummaryPanel({ summary }: { summary: FlowSummaryDef }) {
  return (
    <div className="arch-flow-summary">
      <div className="arch-flow-summary-head">
        <Info className="arch-flow-summary-icon" aria-hidden />
        <span className="arch-flow-summary-title">Flow summary</span>
      </div>
      <div className="arch-flow-steps" aria-label="Flow pipeline">
        {summary.steps.map((step, i) => (
          <span key={step} className="arch-flow-step-wrap">
            {i > 0 ? <span className="arch-flow-arrow" aria-hidden>→</span> : null}
            <span className="arch-flow-step">{step}</span>
          </span>
        ))}
      </div>
      <div className="arch-flow-highlights">
        <div className="arch-flow-highlight-title">{summary.highlightsTitle}</div>
        <div className="arch-flow-tags">
          {summary.highlights.map((item) => (
            <span key={item.label} className="arch-flow-tag" data-health={item.health}>
              {item.label}
            </span>
          ))}
        </div>
        {summary.footer ? <p className="arch-flow-footer">{summary.footer}</p> : null}
      </div>
    </div>
  )
}

function FlowDiagram({ eyebrow, title, sub, waypoints, stations, summary, children }: FlowProps) {
  const [paused, setPaused] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [pinned, setPinned] = useState(false)
  const pausedRef = useRef(false)
  const pinnedRef = useRef(false)
  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { pinnedRef.current = pinned }, [pinned])

  const haloRef = useRef<SVGCircleElement>(null)
  const headRef = useRef<SVGCircleElement>(null)
  const ringRef = useRef<SVGCircleElement>(null)
  const trailRefs = useRef<(SVGCircleElement | null)[]>([])
  const barRef = useRef<HTMLDivElement>(null)

  const activeStation = stations[activeIdx]
  const activeColor = HEALTH[activeStation.health]

  useEffect(() => {
    const [x, y] = waypoints[activeStation.wp]
    ringRef.current?.setAttribute('cx', '' + x)
    ringRef.current?.setAttribute('cy', '' + y)
    ringRef.current?.setAttribute('stroke', activeColor)
    barRef.current?.style.setProperty('--hc', activeColor)
  }, [activeIdx, activeColor, activeStation.wp, waypoints])

  useEffect(() => {
    const WPv = waypoints
    const cum = [0]; let tot = 0
    for (let i = 1; i < WPv.length; i++) { tot += Math.hypot(WPv[i][0] - WPv[i - 1][0], WPv[i][1] - WPv[i - 1][1]); cum.push(tot) }
    const st = stations.map((s) => ({ ...s, s: cum[s.wp] }))

    const posAt = (s: number): [number, number] => {
      if (s <= 0) return WPv[0]
      if (s >= tot) return WPv[WPv.length - 1]
      let i = 1; while (i < cum.length && cum[i] < s) i++
      const seg = cum[i] - cum[i - 1]; const f = seg ? (s - cum[i - 1]) / seg : 0
      return [WPv[i - 1][0] + (WPv[i][0] - WPv[i - 1][0]) * f, WPv[i - 1][1] + (WPv[i][1] - WPv[i - 1][1]) * f]
    }
    const colorAt = (s: number): string => {
      let i = 0; for (let k = 0; k < st.length; k++) if (st[k].s <= s) i = k
      if (i >= st.length - 1) return HEALTH[st[st.length - 1].health]
      const a = st[i], b = st[i + 1]; const seg = b.s - a.s; const f = seg ? (s - a.s) / seg : 0
      return lerpColor(HEALTH[a.health], HEALTH[b.health], f)
    }

    let lastStation = -1
    const render = (t: number) => {
      const s = t * tot
      const [x, y] = posAt(s); const col = colorAt(s)
      haloRef.current?.setAttribute('cx', '' + x); haloRef.current?.setAttribute('cy', '' + y); haloRef.current?.setAttribute('fill', col)
      headRef.current?.setAttribute('cx', '' + x); headRef.current?.setAttribute('cy', '' + y); headRef.current?.setAttribute('fill', col)
      for (let k = 0; k < TRAIL; k++) {
        const c = trailRefs.current[k]; if (!c) continue
        let sk = s - (k + 1) * (tot * 0.008); if (sk < 0) sk += tot
        const [tx, ty] = posAt(sk)
        c.setAttribute('cx', '' + tx); c.setAttribute('cy', '' + ty); c.setAttribute('fill', colorAt(sk))
        c.setAttribute('opacity', '' + (0.4 * (1 - (k + 1) / (TRAIL + 1))))
      }
      let idx = 0; for (let i = 0; i < st.length; i++) if (st[i].s <= s + 0.5) idx = i
      if (idx !== lastStation) {
        lastStation = idx
        if (!pinnedRef.current) setActiveIdx(idx)
      }
    }

    render(0)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0, prev: number | null = null, t = 0
    const tick = (now: number) => {
      if (prev == null) prev = now
      const dt = now - prev; prev = now
      if (!pausedRef.current) t = (t + dt / DUR) % 1
      render(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [waypoints, stations])

  const selectStation = (idx: number) => {
    setActiveIdx(idx)
    setPinned(true)
    setPaused(true)
  }

  const togglePlayback = () => {
    if (paused) {
      setPinned(false)
      setPaused(false)
      return
    }
    setPaused(true)
  }

  return (
    <div className="arch-card">
      <div className="arch-head-c">
        <span className="arch-eyebrow">{eyebrow}</span>
        <h2 className="arch-title">{title}</h2>
        <p className="arch-sub">{sub}</p>
      </div>
      <div className="arch-svg-wrap">
        <svg viewBox="0 0 2000 920" className="arch-svg" role="img" aria-label={title}>
          <defs>
            <marker id="ah-o" markerWidth="9" markerHeight="9" refX="6.5" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill={O} /></marker>
            <marker id="ah-b" markerWidth="9" markerHeight="9" refX="6.5" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill={B} /></marker>
            <marker id="ah-g" markerWidth="9" markerHeight="9" refX="6.5" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill={GA} /></marker>
            <marker id="ah-bs" markerWidth="9" markerHeight="9" refX="6.5" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill={BD} /></marker>
          </defs>
          {children}
          <g className="arch-anim" style={{ pointerEvents: 'none' }}>
            <circle ref={ringRef} className="arch-ring" r={14} cx={waypoints[0][0]} cy={waypoints[0][1]} fill="none" stroke={HEALTH[stations[0].health]} strokeWidth={3} />
            {Array.from({ length: TRAIL }).map((_, k) => <circle key={k} ref={(el) => { trailRefs.current[k] = el }} r={5.5} cx={waypoints[0][0]} cy={waypoints[0][1]} fill={HEALTH.good} opacity={0} />)}
            <circle ref={haloRef} r={13} cx={waypoints[0][0]} cy={waypoints[0][1]} fill={HEALTH.good} opacity={0.22} />
            <circle ref={headRef} r={7.5} cx={waypoints[0][0]} cy={waypoints[0][1]} fill={HEALTH.good} stroke="#fff" strokeWidth={2} />
          </g>
        </svg>
      </div>

      <div className="arch-anim-panel">
        <div className="arch-anim-bar" ref={barRef}>
          <button
            className="arch-anim-play"
            type="button"
            onClick={togglePlayback}
            aria-label={paused ? 'Play animation' : 'Pause animation'}
            aria-pressed={paused}
          >
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </button>
          <span className="arch-anim-dot" aria-hidden />
          <div className="arch-anim-body">
            <div className="arch-anim-label-row">
              <span className="arch-anim-index">{activeIdx + 1}/{stations.length}</span>
              <span className="arch-anim-label">{activeStation.label}</span>
            </div>
            <p className="arch-anim-note">{activeStation.note}</p>
          </div>
          <span className="arch-anim-badge" data-health={activeStation.health}>
            {HEALTH_LABEL[activeStation.health]}
          </span>
        </div>

        <div className="arch-anim-stations" role="tablist" aria-label="Flow stops">
          {stations.map((station, idx) => (
            <button
              key={station.label}
              type="button"
              role="tab"
              aria-selected={idx === activeIdx}
              className={`arch-station-chip${idx === activeIdx ? ' active' : ''}`}
              data-health={station.health}
              onClick={() => selectStation(idx)}
            >
              <span className="arch-station-chip-index">{idx + 1}</span>
              {station.label}
            </button>
          ))}
        </div>

        <div className="arch-anim-legend" aria-label="Health legend">
          {(Object.keys(HEALTH) as Health[]).map((health) => (
            <span key={health} className="arch-legend-item">
              <i style={{ background: HEALTH[health] }} aria-hidden />
              {HEALTH_LABEL[health]}
            </span>
          ))}
        </div>
      </div>

      <FlowSummaryPanel summary={summary} />
    </div>
  )
}

/* ════════════════════════ TAB ROOT ════════════════════════ */
export function ArchitectureDiagram() {
  const [view, setView] = useState<'current' | 'target'>('current')
  return (
    <div className="arch">
      <nav className="arch-nav" aria-label="Architecture view">
        <button
          type="button"
          className={`arch-nav-btn${view === 'current' ? ' active' : ''}`}
          aria-current={view === 'current' ? 'page' : undefined}
          onClick={() => setView('current')}
        >
          Current Architecture
        </button>
        <button
          type="button"
          className={`arch-nav-btn${view === 'target' ? ' active' : ''}`}
          aria-current={view === 'target' ? 'page' : undefined}
          onClick={() => setView('target')}
        >
          Target Architecture
        </button>
      </nav>

      {view === 'current' ? (
        <FlowDiagram
          key="current"
          eyebrow="Current Architecture"
          title="Synchronization · Event Handling"
          sub="Event generation, offline queue and synchronization flow in the current structure"
          waypoints={CURRENT_WP}
          stations={CURRENT_STATIONS}
          summary={{
            steps: ['UI event', 'SharedViewModel', 'Room (JSON-chunk)', 'RequestSenderService', 'Backend'],
            highlightsTitle: 'Operational risk',
            highlights: [
              { label: 'no SSoT', health: 'bad' },
              { label: 'main-thread queries', health: 'bad' },
              { label: 'unreliable queue', health: 'warn' },
            ],
            footer: 'Polling-based sync; state updates are manual and can lag or miss screens.',
          }}
        ><CurrentContent /></FlowDiagram>
      ) : (
        <FlowDiagram
          key="target"
          eyebrow="Target Architecture"
          title="Compose + MVI · Room SSoT · Offline-first"
          sub="UDF flow, normalized single source of truth and guaranteed synchronization via Outbox/WorkManager"
          waypoints={TARGET_WP}
          stations={TARGET_STATIONS}
          summary={{
            steps: ['UiAction', 'reduce()', 'UseCase', 'Room SSoT + OutboxEvent', 'WorkManager', 'Backend → Flow → UI'],
            highlightsTitle: 'Structurally resolved',
            highlights: [
              { label: 'duplicate collection', health: 'good' },
              { label: 'data loss', health: 'good' },
              { label: 'ANR', health: 'good' },
              { label: 'zombie requests', health: 'good' },
            ],
            footer: 'Idempotency, backoff and reactive Room → Flow → UiState replace polling and manual refresh.',
          }}
        ><TargetContent /></FlowDiagram>
      )}
    </div>
  )
}
