import { useState, useEffect } from 'react'
import { fetchActivityCandidates } from '../hooks/useActivityPhoto'
import {
  Sunrise, Sun, Moon, MapPin, Copy, Check,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Bus, Wallet, Backpack, AlertTriangle,
  LayoutList, AlignJustify, Pencil, X, Send, Loader2,
  Plane, Car, Ship, Train, Utensils, Hotel, Shield, Ticket,
  Thermometer, Calendar, Heart, Info, DollarSign, Shirt, Footprints, Camera,
} from 'lucide-react'
import type { ItineraryJSON, DayPlan, DayBlock, Stay } from '../types'

interface Props {
  data: ItineraryJSON
  stays?: Stay[]
  onBlockEdit?: (dayNum: number, period: string, blockTitle: string, prompt: string) => Promise<void>
  hideOverview?: boolean
  hideSections?: boolean   // hide transport/budget/packing/risks (shown separately in Travel Notes tab)
  sectionsOnly?: boolean   // render ONLY the collapsible sections — for Travel Notes tab
  selectedDay?: number     // externally controlled selected day (for map sync)
  onDaySelect?: (dayNum: number) => void
}

// ─── Location palette ─────────────────────────────────────────────────────────

const LOCATION_PALETTE = [
  { circle: '#F0EDEB', text: '#7C6F69' },
  { circle: '#E8ECF0', text: '#5A6A7A' },
  { circle: '#E8EDE9', text: '#5A6F5C' },
  { circle: '#ECEAF0', text: '#6B6580' },
  { circle: '#F0EBE8', text: '#7A5F58' },
  { circle: '#E8EEF0', text: '#4F6A72' },
  { circle: '#EDF0E8', text: '#606E52' },
  { circle: '#F0EAF0', text: '#725A72' },
]

const SELECTED = { bg: '#F07332', text: 'white', shadow: 'rgba(240,115,50,0.28)' }

function buildLocationMap(dayPlans: DayPlan[]) {
  const locations = [...new Set(dayPlans.map(d => d.location_base))]
  const map = new Map<string, typeof LOCATION_PALETTE[0]>()
  locations.forEach((loc, i) => map.set(loc, LOCATION_PALETTE[i % LOCATION_PALETTE.length]))
  return map
}

// ─── Calendar layout ──────────────────────────────────────────────────────────

function buildCalendarWeeks(dayPlans: DayPlan[]): (DayPlan | null)[][] {
  if (!dayPlans.length) return []
  const parsed = dayPlans.map(d => ({ plan: d, date: new Date(d.date) }))
  const hasValidDates = parsed.some(p => !isNaN(p.date.getTime()))
  if (!hasValidDates) {
    const weeks: (DayPlan | null)[][] = []
    for (let i = 0; i < dayPlans.length; i += 7) {
      const slice = dayPlans.slice(i, i + 7)
      weeks.push([...slice, ...Array(7 - slice.length).fill(null)])
    }
    return weeks
  }
  const validParsed = parsed.filter(p => !isNaN(p.date.getTime()))
  validParsed.sort((a, b) => a.date.getTime() - b.date.getTime())
  const firstDate = validParsed[0].date
  const lastDate = validParsed[validParsed.length - 1].date
  const firstCol = (firstDate.getDay() + 6) % 7
  const spanDays = Math.round((lastDate.getTime() - firstDate.getTime()) / 86400000) + 1
  const numWeeks = Math.ceil((firstCol + spanDays) / 7)
  const weeks: (DayPlan | null)[][] = Array.from({ length: numWeeks }, () => Array(7).fill(null))
  validParsed.forEach(({ plan, date }) => {
    const diff = Math.round((date.getTime() - firstDate.getTime()) / 86400000)
    const slot = firstCol + diff
    const weekIdx = Math.floor(slot / 7)
    if (weekIdx >= 0 && weekIdx < weeks.length) {
      weeks[weekIdx][slot % 7] = plan
    }
  })
  return weeks
}

// ─── Period config ────────────────────────────────────────────────────────────

const PERIOD_CONFIG = {
  Morning:   { Icon: Sunrise, border: '#F07332', label: 'Morning',   textColor: '#2D4A5A', mutedColor: '#7A9099' },
  Afternoon: { Icon: Sun,     border: '#7A9099', label: 'Afternoon', textColor: '#2D4A5A', mutedColor: '#7A9099' },
  Evening:   { Icon: Moon,    border: '#2D4A5A', label: 'Evening',   textColor: '#2D4A5A', mutedColor: '#7A9099' },
}

type Period = keyof typeof PERIOD_CONFIG

interface EditState { dayNum: number; period: Period; title: string }

// ─── Details as bullet points ─────────────────────────────────────────────────

function DetailsAsBullets({ text, color }: { text: string; color: string }) {
  if (!text) return null
  const parts = text.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 4)
  if (parts.length <= 1) {
    return <div style={{ fontSize: 13, color, lineHeight: 1.7 }}>{text}</div>
  }
  return (
    <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {parts.map((s, i) => (
        <li key={i} style={{ display: 'flex', gap: 9, fontSize: 13, color, lineHeight: 1.6 }}>
          <span style={{ color: '#F07332', flexShrink: 0, fontWeight: 700, marginTop: '0.1em' }}>·</span>
          <span>{s.endsWith('.') || s.endsWith('!') || s.endsWith('?') ? s : `${s}.`}</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Inline edit panel ────────────────────────────────────────────────────────

function EditPanel({
  blockTitle, period, onSend, onCancel, loading,
}: {
  blockTitle: string
  period: Period
  onSend: (prompt: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const [prompt, setPrompt] = useState('')
  const { border } = PERIOD_CONFIG[period]

  return (
    <div style={{
      background: '#FFFBF8',
      border: `1.5px solid ${border}`,
      borderRadius: '0 8px 8px 8px',
      padding: '12px 14px',
      marginBottom: 10,
      marginTop: -6,
    }}>
      <div style={{ fontSize: 12, color: border, fontWeight: 700, marginBottom: 8 }}>
        Ask Maya to change "{blockTitle}"
      </div>
      <textarea
        autoFocus
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && prompt.trim()) onSend(prompt.trim()) }}
        placeholder={`e.g. "swap this to day 5", "replace with something more relaxing", "move to the evening instead"...`}
        disabled={loading}
        rows={2}
        style={{
          width: '100%',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: 13,
          fontFamily: 'inherit',
          resize: 'none',
          outline: 'none',
          background: 'white',
          color: 'var(--color-text)',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button
          onClick={onCancel}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--color-text-muted)', fontFamily: 'inherit' }}
        >
          <X size={12} /> Cancel
        </button>
        <button
          onClick={() => { if (prompt.trim()) onSend(prompt.trim()) }}
          disabled={loading || !prompt.trim()}
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: loading || !prompt.trim() ? 'var(--color-border)' : border, border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: loading || !prompt.trim() ? 'default' : 'pointer', color: 'white', fontFamily: 'inherit' }}
        >
          {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={12} />}
          {loading ? 'Updating...' : 'Send to Maya'}
        </button>
      </div>
    </div>
  )
}

// ─── Time block ───────────────────────────────────────────────────────────────

function TimeBlock({
  period, block, photoUrl, isEditing, onToggleEdit,
}: {
  period: Period
  block: DayBlock
  photoUrl: string | null
  isEditing: boolean
  onToggleEdit: () => void
}) {
  const { Icon, border, label, textColor, mutedColor } = PERIOD_CONFIG[period]
  const [photoOpen, setPhotoOpen] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: 'white',
        border: isEditing ? `2px solid ${border}` : '1px solid var(--color-border)',
        borderLeft: `3px solid ${border}`,
        borderRadius: '0 8px 8px 0',
        marginBottom: isEditing ? 0 : '10px',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s',
        boxShadow: photoOpen ? '0 4px 16px rgba(0,0,0,0.1)' : undefined,
      }}
    >
      {/* ── Text content ── */}
      <div
        onClick={onToggleEdit}
        style={{ flex: 1, padding: '14px 16px', cursor: 'pointer', minWidth: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Icon size={13} color={border} strokeWidth={2.5} />
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: border }}>
                {label}
              </span>
            </div>
            {block.est_cost_aud && (
              <span style={{ background: '#F0FDF4', color: '#15803D', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px', border: '1px solid #DCFCE7' }}>
                ~${block.est_cost_aud} AUD
              </span>
            )}
            {block.booking_needed && (
              <span style={{ background: 'var(--color-accent)', color: 'var(--color-primary-dark)', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px', border: '1px solid #FCD9B8' }}>
                Book ahead
              </span>
            )}
          </div>
          <Pencil size={13} color={isEditing ? border : 'var(--color-border)'} strokeWidth={2} style={{ flexShrink: 0 }} />
        </div>
        <div style={{ fontWeight: 600, fontSize: '15px', color: textColor, marginBottom: '6px', lineHeight: '1.4', marginTop: 8 }}>
          {block.title}
        </div>
        <DetailsAsBullets text={block.details} color={mutedColor} />
        {block.tip && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            marginTop: 10, padding: '8px 12px',
            background: '#FFFBEB', border: '1px solid #FDE68A',
            borderRadius: 8, fontSize: 12, color: '#92400E', lineHeight: 1.6,
          }}>
            <Info size={13} strokeWidth={2} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{block.tip}</span>
          </div>
        )}
      </div>

      {/* ── Photo panel ── */}
      {photoUrl && (
        <div
          onClick={() => setPhotoOpen(o => !o)}
          style={{
            width: photoOpen ? 220 : 52,
            flexShrink: 0,
            position: 'relative',
            backgroundImage: `url(${photoUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            cursor: 'pointer',
            transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
          }}
        >
          {/* Expand hint */}
          {!photoOpen && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 22, height: 22,
                background: 'rgba(255,255,255,0.9)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: '#2d4a5a',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              }}>›</div>
            </div>
          )}

          {/* Close button */}
          {photoOpen && (
            <div
              onClick={e => { e.stopPropagation(); setPhotoOpen(false) }}
              style={{
                position: 'absolute', top: 8, right: 8,
                width: 24, height: 24,
                background: 'rgba(0,0,0,0.45)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 12, cursor: 'pointer',
              }}
            >✕</div>
          )}

          {/* Caption */}
          {photoOpen && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '20px 10px 8px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)',
              fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 500,
            }}>
              {block.photo_query ?? block.title}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Overview row (compact agenda) ───────────────────────────────────────────

function OverviewActivityRow({
  period, block, isEditing, onToggleEdit,
}: {
  period: Period
  block: DayBlock
  isEditing: boolean
  onToggleEdit: () => void
}) {
  const { Icon, border, label } = PERIOD_CONFIG[period]

  return (
    <div
      onClick={onToggleEdit}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 8,
        background: isEditing ? '#FFFBF8' : 'transparent',
        border: isEditing ? `1.5px solid ${border}` : '1.5px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.12s',
        marginBottom: 2,
      }}
    >
      <Icon size={13} color={border} strokeWidth={2.5} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: border, textTransform: 'uppercase', letterSpacing: '0.6px', minWidth: 80, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500, flex: 1 }}>{block.title}</span>
      <Pencil size={12} color={isEditing ? border : 'var(--color-border)'} strokeWidth={2} style={{ flexShrink: 0 }} />
    </div>
  )
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function CollapsibleSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: '8px' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', background: 'white', border: '1px solid var(--color-border)',
          borderRadius: open ? '10px 10px 0 0' : '10px', padding: '14px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)',
          transition: 'background 0.15s', fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>{icon}{title}</div>
        {open ? <ChevronUp size={16} color="#94A3B8" /> : <ChevronDown size={16} color="#94A3B8" />}
      </button>
      {open && (
        <div style={{ border: '1px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '18px', background: 'var(--color-bg)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PERIODS: Period[] = ['Morning', 'Afternoon', 'Evening']
const PERIOD_KEYS: Record<Period, 'morning' | 'afternoon' | 'evening'> = {
  Morning: 'morning', Afternoon: 'afternoon', Evening: 'evening',
}

export default function ItineraryTimeline({ data, stays = [], onBlockEdit, hideOverview, hideSections, sectionsOnly, selectedDay: externalDay, onDaySelect }: Props) {
  const [internalDayNum, setInternalDayNum] = useState(0)
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState<'detail' | 'overview'>('detail')
  const [editState, setEditState] = useState<EditState | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  const selectedDayNum = externalDay ?? internalDayNum
  function setSelectedDayNum(n: number | ((prev: number) => number)) {
    const next = typeof n === 'function' ? n(selectedDayNum) : n
    setInternalDayNum(next)
    onDaySelect?.(next)
  }
  const hasSelection = selectedDayNum > 0

  const locationMap = buildLocationMap(data.day_plans ?? [])
  const weeks = buildCalendarWeeks(data.day_plans ?? [])
  const selectedDay = data.day_plans?.find(d => d.day_number === selectedDayNum) ?? null
  const totalDays = data.day_plans?.length ?? 0

  // Fetch photo candidates for all blocks of the selected day in parallel,
  // then assign greedily to avoid showing the same image twice in one day.
  const [dayPhotos, setDayPhotos] = useState<Record<string, string | null>>({})
  useEffect(() => {
    if (!selectedDay) return
    const location = selectedDay.location_base
    const blocks = PERIODS
      .map(p => ({ period: p, block: selectedDay[PERIOD_KEYS[p]] as DayBlock | null }))
      .filter((b): b is { period: Period; block: DayBlock } => b.block !== null)

    Promise.all(
      blocks.map(({ period, block }) =>
        fetchActivityCandidates(block.title, location, block.photo_query)
          .then(candidates => ({ period, candidates }))
      )
    ).then(results => {
      const used = new Set<string>()
      const resolved: Record<string, string | null> = {}
      for (const { period, candidates } of results) {
        const url = candidates.find(u => !used.has(u)) ?? null
        if (url) used.add(url)
        resolved[period] = url
      }
      setDayPhotos(resolved)
    })
  }, [selectedDay?.day_number]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleEdit(dayNum: number, period: Period, title: string) {
    if (editState?.dayNum === dayNum && editState.period === period) {
      setEditState(null)
    } else {
      setEditState({ dayNum, period, title })
    }
  }

  async function handleSend(prompt: string) {
    if (!editState || !onBlockEdit) return
    setEditLoading(true)
    try {
      await onBlockEdit(editState.dayNum, editState.period, editState.title, prompt)
      setEditState(null)
    } finally {
      setEditLoading(false)
    }
  }

  function handleCopy() {
    const text = buildCopyText(data)
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    } else {
      const el = document.createElement('textarea')
      el.value = text
      el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el)
      el.focus(); el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }

  if (sectionsOnly) {
    return (
      <div>
        {data.transport_notes?.length > 0 && (
          <CollapsibleSection title="Transport" icon={<Bus size={15} strokeWidth={2} color="#64748B" />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.transport_notes.map((note, i) => {
                const t = note.toLowerCase()
                let Icon = ChevronRight; let iconColor = '#64748B'; let bg = 'var(--color-bg)'
                if (t.includes('fly') || t.includes('flight') || t.includes('airport')) { Icon = Plane; iconColor = '#3B82F6'; bg = '#EFF6FF' }
                else if (t.includes('ferry') || t.includes('boat') || t.includes('vessel')) { Icon = Ship; iconColor = '#0891B2'; bg = '#ECFEFF' }
                else if (t.includes('hire car') || t.includes('drive') || t.includes('car ') || t.includes('driving')) { Icon = Car; iconColor = '#16A34A'; bg = '#F0FDF4' }
                else if (t.includes('train') || t.includes('opal') || t.includes('bus') || t.includes('tram') || t.includes('transit')) { Icon = Train; iconColor = '#9333EA'; bg = '#FAF5FF' }
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 10, background: bg, border: '1px solid var(--color-border)', alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                      <Icon size={14} color={iconColor} strokeWidth={2} />
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: '1.6', paddingTop: 4 }}>{note}</span>
                  </div>
                )
              })}
            </div>
          </CollapsibleSection>
        )}
        {data.budget_summary && (
          <CollapsibleSection title="Budget Summary" icon={<Wallet size={15} strokeWidth={2} color="#64748B" />}>
            {data.budget_summary.estimated_total_aud && (
              <div style={{ marginBottom: '16px', padding: '16px 20px', background: 'linear-gradient(135deg, var(--color-accent) 0%, white 100%)', borderRadius: 12, border: '1px solid #FCD9B8' }}>
                <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-1px' }}>${data.budget_summary.estimated_total_aud.toLocaleString()}</span>
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginLeft: '10px' }}>AUD estimated total</span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {data.budget_summary.assumptions?.map((a, i) => {
                const t = a.toLowerCase()
                let Icon = DollarSign; let iconColor = '#64748B'
                if (t.includes('flight') || t.includes('fly')) { Icon = Plane; iconColor = '#3B82F6' }
                else if (t.includes('accommodation') || t.includes('hotel') || t.includes('night')) { Icon = Hotel; iconColor = '#7C3AED' }
                else if (t.includes('dining') || t.includes('food') || t.includes('restaurant') || t.includes('breakfast') || t.includes('lunch') || t.includes('dinner')) { Icon = Utensils; iconColor = '#EA580C' }
                else if (t.includes('activit') || t.includes('entry') || t.includes('tour')) { Icon = Ticket; iconColor = '#0891B2' }
                else if (t.includes('transport') || t.includes('hire car') || t.includes('opal') || t.includes('taxi') || t.includes('driving')) { Icon = Car; iconColor = '#16A34A' }
                else if (t.includes('insurance')) { Icon = Shield; iconColor = '#DC2626' }
                else if (t.includes('incidental') || t.includes('shopping') || t.includes('not included')) { Icon = Info; iconColor = '#9CA3AF' }
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', borderRadius: 8, alignItems: 'flex-start' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Icon size={12} color={iconColor} strokeWidth={2} />
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.6' }}>{a}</span>
                  </div>
                )
              })}
            </div>
          </CollapsibleSection>
        )}
        {data.packing_checklist?.length > 0 && (
          <CollapsibleSection title={`Packing (${data.packing_checklist.length} items)`} icon={<Backpack size={15} strokeWidth={2} color="#64748B" />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px' }}>
              {data.packing_checklist.map((item, i) => {
                const t = item.toLowerCase()
                let Icon = Backpack
                if (t.includes('jacket') || t.includes('clothing') || t.includes('outfit') || t.includes('shirt') || t.includes('thermal')) Icon = Shirt
                else if (t.includes('shoe') || t.includes('boot') || t.includes('hiking') || t.includes('walking')) Icon = Footprints
                else if (t.includes('camera') || t.includes('photo') || t.includes('phone')) Icon = Camera
                else if (t.includes('card') || t.includes('licence') || t.includes('passport') || t.includes('document')) Icon = Ticket
                else if (t.includes('sunscreen') || t.includes('sunglass') || t.includes('sun')) Icon = Sun
                else if (t.includes('medication') || t.includes('first aid') || t.includes('medical')) Icon = Shield
                return (
                  <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <input type="checkbox" style={{ accentColor: 'var(--color-primary)', width: '15px', height: '15px', marginTop: 2, flexShrink: 0 }} />
                    <Icon size={13} color="var(--color-text-muted)" strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{item}</span>
                  </label>
                )
              })}
            </div>
          </CollapsibleSection>
        )}
        {data.risks_and_notes?.length > 0 && (
          <CollapsibleSection title="Risks & Notes" icon={<AlertTriangle size={15} strokeWidth={2} color="#64748B" />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.risks_and_notes.map((note, i) => {
                const colonIdx = note.indexOf(':')
                const hasHeading = colonIdx > 0 && colonIdx < 40 && note.slice(0, colonIdx) === note.slice(0, colonIdx).toUpperCase()
                const heading = hasHeading ? note.slice(0, colonIdx).trim() : null
                const body = hasHeading ? note.slice(colonIdx + 1).trim() : note
                const t = (heading ?? note).toLowerCase()
                let Icon = AlertTriangle; let iconColor = '#EA580C'; let badgeBg = '#FFF7ED'; let badgeBorder = '#FED7AA'
                if (t.includes('weather') || t.includes('temperature') || t.includes('climate')) { Icon = Thermometer; iconColor = '#0891B2'; badgeBg = '#ECFEFF'; badgeBorder = '#A5F3FC' }
                else if (t.includes('holiday') || t.includes('busy') || t.includes('peak') || t.includes('season')) { Icon = Calendar; iconColor = '#7C3AED'; badgeBg = '#FAF5FF'; badgeBorder = '#DDD6FE' }
                else if (t.includes('sensiti') || t.includes('respect') || t.includes('culture') || t.includes('history')) { Icon = Heart; iconColor = '#DC2626'; badgeBg = '#FEF2F2'; badgeBorder = '#FECACA' }
                return (
                  <div key={i} style={{ background: badgeBg, border: `1px solid ${badgeBorder}`, borderRadius: 10, padding: '12px 16px', lineHeight: 1.6 }}>
                    {heading && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Icon size={13} color={iconColor} strokeWidth={2.5} />
                        <span style={{ fontSize: '11px', fontWeight: 800, color: iconColor, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{heading}</span>
                      </div>
                    )}
                    <span style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.6 }}>{body}</span>
                  </div>
                )
              })}
            </div>
          </CollapsibleSection>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '820px' }}>
      {/* ── Overview text + destinations ── */}
      {!hideOverview && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: '1.8', marginBottom: '16px' }}>{data.overview}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {data.destinations?.map((d, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 600 }}>
                <MapPin size={11} strokeWidth={2.5} color="#FF6B35" />
                {d.name} · {d.nights} {d.nights === 1 ? 'night' : 'nights'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── View toggle ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
          {view === 'detail' ? 'Select a day' : view === 'overview' ? 'All days' : 'Day locations'}
        </p>
        <div style={{ display: 'flex', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 3, gap: 2 }}>
          <button
            onClick={() => setView('detail')}
            title="Day view"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: view === 'detail' ? 'white' : 'transparent', color: view === 'detail' ? 'var(--color-text)' : 'var(--color-text-muted)', boxShadow: view === 'detail' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}
          >
            <AlignJustify size={13} /> Day
          </button>
          <button
            onClick={() => setView('overview')}
            title="Overview"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: view === 'overview' ? 'white' : 'transparent', color: view === 'overview' ? 'var(--color-text)' : 'var(--color-text-muted)', boxShadow: view === 'overview' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}
          >
            <LayoutList size={13} /> Overview
          </button>
        </div>
      </div>

      {/* ── DETAIL VIEW ── */}
      {view === 'detail' && (
        <>
          {/* Calendar grid */}
          {weeks.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
                {DAY_LABELS.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 600, color: 'var(--color-border)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 0' }}>{d}</div>
                ))}
              </div>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
                  {week.map((day, di) => {
                    if (!day) return <div key={di} />
                    const isSelected = day.day_number === selectedDayNum
                    const loc = locationMap.get(day.location_base) ?? LOCATION_PALETTE[0]
                    return (
                      <div key={di} style={{ display: 'flex', justifyContent: 'center', padding: '3px' }}>
                        <button
                          onClick={() => { setSelectedDayNum(day.day_number); setEditState(null) }}
                          title={`Day ${day.day_number} — ${day.location_base}`}
                          style={{ width: '48px', height: '48px', borderRadius: '50%', background: isSelected ? SELECTED.bg : loc.circle, border: 'none', color: isSelected ? SELECTED.text : loc.text, fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s', boxShadow: isSelected ? `0 4px 12px ${SELECTED.shadow}` : 'none', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}
                        >
                          {day.day_number}
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Empty state — no day selected yet */}
          {!hasSelection && (
            <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--color-text-muted)', fontSize: 13 }}>
              Select a day above to see the plan
            </div>
          )}

          {/* Selected day detail */}
          {selectedDay && (
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
              <div style={{ background: 'white', borderBottom: '1px solid var(--color-border)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ background: 'var(--color-primary)', color: 'white', fontWeight: 800, fontSize: '13px', padding: '4px 12px', borderRadius: '100px' }}>Day {selectedDay.day_number}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{selectedDay.date}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 500 }}>
                  <MapPin size={13} strokeWidth={2} color="#FF6B35" />{selectedDay.location_base}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--color-border)', background: 'white' }}>
                <button onClick={() => { setSelectedDayNum(d => Math.max(1, d - 1)); setEditState(null) }} disabled={selectedDayNum <= 1} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: 600, cursor: selectedDayNum <= 1 ? 'default' : 'pointer', color: selectedDayNum <= 1 ? 'var(--color-border)' : 'var(--color-text)', fontFamily: 'inherit' }}>
                  <ChevronLeft size={14} /> Prev
                </button>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{selectedDayNum} / {totalDays}</span>
                <button onClick={() => { setSelectedDayNum(d => Math.min(totalDays, d + 1)); setEditState(null) }} disabled={selectedDayNum >= totalDays} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: 600, cursor: selectedDayNum >= totalDays ? 'default' : 'pointer', color: selectedDayNum >= totalDays ? 'var(--color-border)' : 'var(--color-text)', fontFamily: 'inherit' }}>
                  Next <ChevronRight size={14} />
                </button>
              </div>

              <div style={{ padding: '16px' }}>
                {PERIODS.map(period => {
                  const block = selectedDay[PERIOD_KEYS[period]] as DayBlock | null
                  if (!block) return null
                  const isEditing = editState?.dayNum === selectedDay.day_number && editState.period === period
                  return (
                    <div key={period}>
                      <TimeBlock
                        period={period}
                        block={block}
                        photoUrl={dayPhotos[period] ?? null}
                        isEditing={isEditing}
                        onToggleEdit={() => toggleEdit(selectedDay.day_number, period, block.title)}
                      />
                      {isEditing && (
                        <EditPanel
                          blockTitle={block.title}
                          period={period}
                          onSend={handleSend}
                          onCancel={() => setEditState(null)}
                          loading={editLoading}
                        />
                      )}
                    </div>
                  )
                })}

                {selectedDay.notes?.length > 0 && (
                  <CollapsibleSection title="Tips for today" icon={<Info size={14} strokeWidth={2} color="var(--color-text-muted)" />}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedDay.notes.map((note, i) => (
                        <div key={i} style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, paddingLeft: 4 }}>{note}</div>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Accommodation for this night */}
                {(() => {
                  if (!selectedDay.date || stays.length === 0) return null
                  const dayDate = new Date(selectedDay.date + 'T12:00:00Z')
                  const stayTonight = stays.find(s => {
                    const ci = new Date(s.check_in)
                    const co = new Date(s.check_out)
                    return ci <= dayDate && dayDate < co
                  })
                  if (!stayTonight) return null
                  const nights = Math.round((new Date(stayTonight.check_out).getTime() - new Date(stayTonight.check_in).getTime()) / 86400000)
                  return (
                    <div style={{ marginTop: 8, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Hotel size={15} color="#15803d" strokeWidth={2} style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>{stayTonight.name}</span>
                        <span style={{ fontSize: 12, color: '#16a34a', marginLeft: 8 }}>{nights} night{nights !== 1 ? 's' : ''}</span>
                      </div>
                      {stayTonight.google_place_id && (
                        <a href={`https://www.google.com/maps/place/?q=place_id:${stayTonight.google_place_id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#15803d', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>Maps →</a>
                      )}
                    </div>
                  )
                })()}
              </div>

            </div>
          )}
        </>
      )}

      {/* ── OVERVIEW VIEW ── */}
      {view === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
          {(data.day_plans ?? []).map(day => {
            const loc = locationMap.get(day.location_base) ?? LOCATION_PALETTE[0]
            return (
              <div key={day.day_number} style={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                {/* Day header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                  <span style={{ width: 30, height: 30, borderRadius: '50%', background: loc.circle, color: loc.text, fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {day.day_number}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{day.date}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                    <MapPin size={11} strokeWidth={2} color="#FF6B35" />{day.location_base}
                  </span>
                </div>
                {/* Activity rows */}
                <div style={{ padding: '8px 10px' }}>
                  {PERIODS.map(period => {
                    const block = day[PERIOD_KEYS[period]] as DayBlock | null
                    if (!block) return null
                    const isEditing = editState?.dayNum === day.day_number && editState.period === period
                    return (
                      <div key={period}>
                        <OverviewActivityRow
                          period={period}
                          block={block}
                          isEditing={isEditing}
                          onToggleEdit={() => toggleEdit(day.day_number, period, block.title)}
                        />
                        {isEditing && (
                          <div style={{ paddingLeft: 0, marginBottom: 6 }}>
                            <EditPanel
                              blockTitle={block.title}
                              period={period}
                              onSend={handleSend}
                              onCancel={() => setEditState(null)}
                              loading={editLoading}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Collapsible summary sections ── */}

      {!hideSections && data.transport_notes?.length > 0 && (
        <CollapsibleSection title="Transport" icon={<Bus size={15} strokeWidth={2} color="#64748B" />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.transport_notes.map((note, i) => {
              const t = note.toLowerCase()
              let Icon = ChevronRight; let iconColor = '#64748B'; let bg = 'var(--color-bg)'
              if (t.includes('fly') || t.includes('flight') || t.includes('airport')) { Icon = Plane; iconColor = '#3B82F6'; bg = '#EFF6FF' }
              else if (t.includes('ferry') || t.includes('boat') || t.includes('vessel')) { Icon = Ship; iconColor = '#0891B2'; bg = '#ECFEFF' }
              else if (t.includes('hire car') || t.includes('drive') || t.includes('car ') || t.includes('driving')) { Icon = Car; iconColor = '#16A34A'; bg = '#F0FDF4' }
              else if (t.includes('train') || t.includes('opal') || t.includes('bus') || t.includes('tram') || t.includes('transit')) { Icon = Train; iconColor = '#9333EA'; bg = '#FAF5FF' }
              return (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 10, background: bg, border: '1px solid var(--color-border)', alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <Icon size={14} color={iconColor} strokeWidth={2} />
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: '1.6', paddingTop: 4 }}>{note}</span>
                </div>
              )
            })}
          </div>
        </CollapsibleSection>
      )}

      {!hideSections && data.budget_summary && (
        <CollapsibleSection title="Budget Summary" icon={<Wallet size={15} strokeWidth={2} color="#64748B" />}>
          {data.budget_summary.estimated_total_aud && (
            <div style={{ marginBottom: '16px', padding: '16px 20px', background: 'linear-gradient(135deg, var(--color-accent) 0%, white 100%)', borderRadius: 12, border: '1px solid #FCD9B8' }}>
              <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-1px' }}>${data.budget_summary.estimated_total_aud.toLocaleString()}</span>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginLeft: '10px' }}>AUD estimated total</span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {data.budget_summary.assumptions?.map((a, i) => {
              const t = a.toLowerCase()
              let Icon = DollarSign; let iconColor = '#64748B'
              if (t.includes('flight') || t.includes('fly')) { Icon = Plane; iconColor = '#3B82F6' }
              else if (t.includes('accommodation') || t.includes('hotel') || t.includes('night')) { Icon = Hotel; iconColor = '#7C3AED' }
              else if (t.includes('dining') || t.includes('food') || t.includes('restaurant') || t.includes('breakfast') || t.includes('lunch') || t.includes('dinner')) { Icon = Utensils; iconColor = '#EA580C' }
              else if (t.includes('activit') || t.includes('entry') || t.includes('tour')) { Icon = Ticket; iconColor = '#0891B2' }
              else if (t.includes('transport') || t.includes('hire car') || t.includes('opal') || t.includes('taxi') || t.includes('driving')) { Icon = Car; iconColor = '#16A34A' }
              else if (t.includes('insurance')) { Icon = Shield; iconColor = '#DC2626' }
              else if (t.includes('incidental') || t.includes('shopping') || t.includes('not included')) { Icon = Info; iconColor = '#9CA3AF' }
              return (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', borderRadius: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Icon size={12} color={iconColor} strokeWidth={2} />
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.6' }}>{a}</span>
                </div>
              )
            })}
          </div>
        </CollapsibleSection>
      )}

      {!hideSections && data.packing_checklist?.length > 0 && (
        <CollapsibleSection title={`Packing (${data.packing_checklist.length} items)`} icon={<Backpack size={15} strokeWidth={2} color="#64748B" />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px' }}>
            {data.packing_checklist.map((item, i) => {
              const t = item.toLowerCase()
              let Icon = Backpack
              if (t.includes('jacket') || t.includes('clothing') || t.includes('outfit') || t.includes('shirt') || t.includes('thermal')) Icon = Shirt
              else if (t.includes('shoe') || t.includes('boot') || t.includes('hiking') || t.includes('walking')) Icon = Footprints
              else if (t.includes('camera') || t.includes('photo') || t.includes('phone')) Icon = Camera
              else if (t.includes('card') || t.includes('licence') || t.includes('passport') || t.includes('document')) Icon = Ticket
              else if (t.includes('sunscreen') || t.includes('sunglass') || t.includes('sun')) Icon = Sun
              else if (t.includes('medication') || t.includes('first aid') || t.includes('medical')) Icon = Shield
              return (
                <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <input type="checkbox" style={{ accentColor: 'var(--color-primary)', width: '15px', height: '15px', marginTop: 2, flexShrink: 0 }} />
                  <Icon size={13} color="var(--color-text-muted)" strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{item}</span>
                </label>
              )
            })}
          </div>
        </CollapsibleSection>
      )}

      {!hideSections && data.risks_and_notes?.length > 0 && (
        <CollapsibleSection title="Risks & Notes" icon={<AlertTriangle size={15} strokeWidth={2} color="#64748B" />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.risks_and_notes.map((note, i) => {
              const colonIdx = note.indexOf(':')
              const hasHeading = colonIdx > 0 && colonIdx < 40 && note.slice(0, colonIdx) === note.slice(0, colonIdx).toUpperCase()
              const heading = hasHeading ? note.slice(0, colonIdx).trim() : null
              const body = hasHeading ? note.slice(colonIdx + 1).trim() : note
              const t = (heading ?? note).toLowerCase()
              let Icon = AlertTriangle; let iconColor = '#EA580C'; let badgeBg = '#FFF7ED'; let badgeBorder = '#FED7AA'
              if (t.includes('weather') || t.includes('temperature') || t.includes('climate')) { Icon = Thermometer; iconColor = '#0891B2'; badgeBg = '#ECFEFF'; badgeBorder = '#A5F3FC' }
              else if (t.includes('holiday') || t.includes('busy') || t.includes('peak') || t.includes('season')) { Icon = Calendar; iconColor = '#7C3AED'; badgeBg = '#FAF5FF'; badgeBorder = '#DDD6FE' }
              else if (t.includes('sensiti') || t.includes('respect') || t.includes('culture') || t.includes('history')) { Icon = Heart; iconColor = '#DC2626'; badgeBg = '#FEF2F2'; badgeBorder = '#FECACA' }
              return (
                <div key={i} style={{ background: badgeBg, border: `1px solid ${badgeBorder}`, borderRadius: 10, padding: '12px 16px', lineHeight: 1.6 }}>
                  {heading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Icon size={13} color={iconColor} strokeWidth={2.5} />
                      <span style={{ fontSize: '11px', fontWeight: 800, color: iconColor, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{heading}</span>
                    </div>
                  )}
                  <span style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.6 }}>{body}</span>
                </div>
              )
            })}
          </div>
        </CollapsibleSection>
      )}

    </div>
  )
}

// ─── Copy helper ──────────────────────────────────────────────────────────────

export function buildCopyText(data: ItineraryJSON): string {
  const lines: string[] = []
  lines.push(`# ${data.trip_title}`, '', '## Overview', data.overview, '')
  if (data.destinations?.length) {
    lines.push('## Destinations')
    data.destinations.forEach(d => lines.push(`- ${d.name}: ${d.nights} nights`))
    lines.push('')
  }
  if (data.day_plans?.length) {
    lines.push('## Itinerary')
    data.day_plans.forEach(day => {
      lines.push(`### Day ${day.day_number} — ${day.date} | ${day.location_base}`)
      if (day.morning) lines.push(`Morning: ${day.morning.title} — ${day.morning.details}`)
      if (day.afternoon) lines.push(`Afternoon: ${day.afternoon.title} — ${day.afternoon.details}`)
      if (day.evening) lines.push(`Evening: ${day.evening.title} — ${day.evening.details}`)
      if (day.notes?.length) day.notes.forEach(n => lines.push(`Note: ${n}`))
      lines.push('')
    })
  }
  if (data.budget_summary?.estimated_total_aud) {
    lines.push(`## Budget: $${data.budget_summary.estimated_total_aud.toLocaleString()} AUD estimated total`)
  }
  return lines.join('\n')
}
