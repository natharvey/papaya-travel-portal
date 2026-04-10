import { useState } from 'react'
import {
  Sunrise, Sun, Moon, MapPin, Copy, Check,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Bus, Wallet, Backpack, AlertTriangle,
  LayoutList, AlignJustify, Pencil, X, Send, Loader2,
} from 'lucide-react'
import type { ItineraryJSON, DayPlan, DayBlock } from '../types'

interface Props {
  data: ItineraryJSON
  onBlockEdit?: (dayNum: number, period: string, blockTitle: string, prompt: string) => Promise<void>
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
  period, block, isEditing, onToggleEdit,
}: {
  period: Period
  block: DayBlock
  isEditing: boolean
  onToggleEdit: () => void
}) {
  const { Icon, border, label, textColor, mutedColor } = PERIOD_CONFIG[period]

  return (
    <div
      onClick={onToggleEdit}
      style={{
        background: 'white',
        border: isEditing ? `2px solid ${border}` : '1px solid var(--color-border)',
        borderLeft: `3px solid ${border}`,
        borderRadius: '0 8px 8px 0',
        padding: '14px 16px',
        marginBottom: isEditing ? 0 : '10px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
      }}
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
      <div style={{ fontSize: '13px', color: mutedColor, lineHeight: '1.7' }}>
        {block.details}
      </div>
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
      <span style={{ fontSize: 12, fontWeight: 700, color: border, textTransform: 'uppercase', letterSpacing: '0.6px', width: 66, flexShrink: 0 }}>{label}</span>
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

export default function ItineraryTimeline({ data, onBlockEdit }: Props) {
  const [selectedDayNum, setSelectedDayNum] = useState(1)
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState<'detail' | 'overview'>('detail')
  const [editState, setEditState] = useState<EditState | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  const locationMap = buildLocationMap(data.day_plans ?? [])
  const weeks = buildCalendarWeeks(data.day_plans ?? [])
  const selectedDay = data.day_plans?.find(d => d.day_number === selectedDayNum) ?? null
  const totalDays = data.day_plans?.length ?? 0

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

  return (
    <div style={{ maxWidth: '820px' }}>
      {/* ── Overview text + destinations ── */}
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

      {/* ── View toggle ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
          {view === 'detail' ? 'Select a day' : 'All days'}
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                    {selectedDay.notes.map((note, i) => (
                      <div key={i} style={{ background: 'white', borderLeft: '3px solid var(--color-border)', padding: '8px 12px', fontSize: '13px', color: 'var(--color-text-muted)', borderRadius: '0 6px 6px 0', lineHeight: '1.6' }}>{note}</div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--color-border)', background: 'white' }}>
                <button onClick={() => { setSelectedDayNum(d => Math.max(1, d - 1)); setEditState(null) }} disabled={selectedDayNum <= 1} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: 600, cursor: selectedDayNum <= 1 ? 'default' : 'pointer', color: selectedDayNum <= 1 ? 'var(--color-border)' : 'var(--color-text)', fontFamily: 'inherit' }}>
                  <ChevronLeft size={14} /> Prev
                </button>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{selectedDayNum} / {totalDays}</span>
                <button onClick={() => { setSelectedDayNum(d => Math.min(totalDays, d + 1)); setEditState(null) }} disabled={selectedDayNum >= totalDays} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: 600, cursor: selectedDayNum >= totalDays ? 'default' : 'pointer', color: selectedDayNum >= totalDays ? 'var(--color-border)' : 'var(--color-text)', fontFamily: 'inherit' }}>
                  Next <ChevronRight size={14} />
                </button>
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

      {data.transport_notes?.length > 0 && (
        <CollapsibleSection title="Transport" icon={<Bus size={15} strokeWidth={2} color="#64748B" />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.transport_notes.map((note, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
                <ChevronRight size={14} color="#FF6B35" style={{ flexShrink: 0, marginTop: '3px' }} />
                <span>{note}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {data.budget_summary && (
        <CollapsibleSection title="Budget Summary" icon={<Wallet size={15} strokeWidth={2} color="#64748B" />}>
          {data.budget_summary.estimated_total_aud && (
            <div style={{ marginBottom: '14px' }}>
              <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-text)' }}>${data.budget_summary.estimated_total_aud.toLocaleString()}</span>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>AUD estimated total</span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {data.budget_summary.assumptions?.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
                <span style={{ color: 'var(--color-border)', flexShrink: 0 }}>—</span><span>{a}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {data.packing_checklist?.length > 0 && (
        <CollapsibleSection title={`Packing (${data.packing_checklist.length} items)`} icon={<Backpack size={15} strokeWidth={2} color="#64748B" />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {data.packing_checklist.map((item, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                <input type="checkbox" style={{ accentColor: 'var(--color-primary)', width: '14px', height: '14px' }} />
                {item}
              </label>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {data.risks_and_notes?.length > 0 && (
        <CollapsibleSection title="Risks & Notes" icon={<AlertTriangle size={15} strokeWidth={2} color="#64748B" />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.risks_and_notes.map((note, i) => (
              <div key={i} style={{ background: 'var(--color-accent)', border: '1px solid #FCD9B8', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--color-primary-dark)', lineHeight: '1.6' }}>{note}</div>
            ))}
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
