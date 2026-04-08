import { useState } from 'react'
import {
  Sunrise, Sun, Moon, MapPin, Copy, Check,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Hotel, Bus, Wallet, Backpack, AlertTriangle,
} from 'lucide-react'
import type { ItineraryJSON, DayPlan, DayBlock } from '../types'

interface Props {
  data: ItineraryJSON
}

// ─── Location palette — 8 subtle tinted greys ────────────────────────────────

const LOCATION_PALETTE = [
  { circle: '#F0EDEB', text: '#7C6F69' }, // warm sand
  { circle: '#E8ECF0', text: '#5A6A7A' }, // cool slate
  { circle: '#E8EDE9', text: '#5A6F5C' }, // muted sage
  { circle: '#ECEAF0', text: '#6B6580' }, // dusty lavender
  { circle: '#F0EBE8', text: '#7A5F58' }, // blush rose
  { circle: '#E8EEF0', text: '#4F6A72' }, // powder blue
  { circle: '#EDF0E8', text: '#606E52' }, // soft moss
  { circle: '#F0EAF0', text: '#725A72' }, // pale mauve
]

const SELECTED = { bg: '#F07332', text: 'white', shadow: 'rgba(240,115,50,0.28)' }

function buildLocationMap(dayPlans: DayPlan[]) {
  const locations = [...new Set(dayPlans.map(d => d.location_base))]
  const map = new Map<string, typeof LOCATION_PALETTE[0]>()
  locations.forEach((loc, i) => map.set(loc, LOCATION_PALETTE[i % LOCATION_PALETTE.length]))
  return map
}

// ─── Calendar layout ─────────────────────────────────────────────────────────

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

  parsed.sort((a, b) => a.date.getTime() - b.date.getTime())
  const firstDate = parsed[0].date
  const firstCol = (firstDate.getDay() + 6) % 7

  const numWeeks = Math.ceil((firstCol + dayPlans.length) / 7)
  const weeks: (DayPlan | null)[][] = Array.from({ length: numWeeks }, () => Array(7).fill(null))

  parsed.forEach(({ plan, date }) => {
    if (isNaN(date.getTime())) return
    const diff = Math.round((date.getTime() - firstDate.getTime()) / 86400000)
    const slot = firstCol + diff
    weeks[Math.floor(slot / 7)][slot % 7] = plan
  })

  return weeks
}

// ─── Time block ───────────────────────────────────────────────────────────────

const PERIOD_CONFIG = {
  Morning:   { Icon: Sunrise,  border: '#F07332', label: 'Morning',   textColor: '#2D4A5A', mutedColor: '#7A9099' },
  Afternoon: { Icon: Sun,      border: '#7A9099', label: 'Afternoon', textColor: '#2D4A5A', mutedColor: '#7A9099' },
  Evening:   { Icon: Moon,     border: '#2D4A5A', label: 'Evening',   textColor: '#2D4A5A', mutedColor: '#7A9099' },
}

function TimeBlock({ period, block }: { period: keyof typeof PERIOD_CONFIG; block: DayBlock }) {
  const { Icon, border, label, textColor, mutedColor } = PERIOD_CONFIG[period]

  return (
    <div style={{
      background: 'white',
      border: '1px solid var(--color-border)',
      borderLeft: `3px solid ${border}`,
      borderRadius: '0 8px 8px 0',
      padding: '14px 16px',
      marginBottom: '10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
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
      <div style={{ fontWeight: 600, fontSize: '15px', color: textColor, marginBottom: '6px', lineHeight: '1.4' }}>
        {block.title}
      </div>
      <div style={{ fontSize: '13px', color: mutedColor, lineHeight: '1.7' }}>
        {block.details}
      </div>
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
          width: '100%',
          background: 'white',
          border: '1px solid var(--color-border)',
          borderRadius: open ? '10px 10px 0 0' : '10px',
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--color-text)',
          transition: 'background 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {icon}
          {title}
        </div>
        {open ? <ChevronUp size={16} color="#94A3B8" /> : <ChevronDown size={16} color="#94A3B8" />}
      </button>
      {open && (
        <div style={{
          border: '1px solid var(--color-border)',
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          padding: '18px',
          background: 'var(--color-bg)',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function ItineraryTimeline({ data }: Props) {
  const [selectedDayNum, setSelectedDayNum] = useState(1)
  const [copied, setCopied] = useState(false)

  const locationMap = buildLocationMap(data.day_plans ?? [])
  const weeks = buildCalendarWeeks(data.day_plans ?? [])
  const selectedDay = data.day_plans?.find(d => d.day_number === selectedDayNum) ?? null
  const totalDays = data.day_plans?.length ?? 0

  function handleCopy() {
    navigator.clipboard.writeText(buildCopyText(data)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ maxWidth: '820px' }}>

      {/* ── Overview ── */}
      <div style={{ marginBottom: '28px' }}>
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: '1.8', marginBottom: '16px' }}>
          {data.overview}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {data.destinations?.map((d, i) => (
            <span key={i} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              padding: '4px 12px',
              borderRadius: '100px',
              fontSize: '12px',
              fontWeight: 600,
            }}>
              <MapPin size={11} strokeWidth={2.5} color="#FF6B35" />
              {d.name} · {d.nights}n
            </span>
          ))}
          <button onClick={handleCopy} style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: 'none',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)',
            padding: '4px 12px',
            borderRadius: '100px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            marginLeft: 'auto',
          }}>
            {copied
              ? <><Check size={12} strokeWidth={2.5} /> Copied</>
              : <><Copy size={12} strokeWidth={2.5} /> Copy summary</>
            }
          </button>
        </div>
      </div>

      {/* ── Calendar ── */}
      {weeks.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
            Select a day
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
            {DAY_LABELS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 600, color: 'var(--color-border)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 0' }}>
                {d}
              </div>
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
                      onClick={() => setSelectedDayNum(day.day_number)}
                      title={`Day ${day.day_number} — ${day.location_base}`}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: isSelected ? SELECTED.bg : loc.circle,
                        border: 'none',
                        color: isSelected ? SELECTED.text : loc.text,
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        boxShadow: isSelected ? `0 4px 12px ${SELECTED.shadow}` : 'none',
                        outline: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
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

      {/* ── Selected day detail ── */}
      {selectedDay && (
        <div style={{
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          overflow: 'hidden',
          marginBottom: '24px',
        }}>
          {/* Day header */}
          <div style={{
            background: 'white',
            borderBottom: '1px solid var(--color-border)',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                background: 'var(--color-primary)',
                color: 'white',
                fontWeight: 800,
                fontSize: '13px',
                padding: '4px 12px',
                borderRadius: '100px',
              }}>
                Day {selectedDay.day_number}
              </span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{selectedDay.date}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 500 }}>
              <MapPin size={13} strokeWidth={2} color="#FF6B35" />
              {selectedDay.location_base}
            </div>
          </div>

          <div style={{ padding: '16px' }}>
            <TimeBlock period="Morning" block={selectedDay.morning} />
            <TimeBlock period="Afternoon" block={selectedDay.afternoon} />
            <TimeBlock period="Evening" block={selectedDay.evening} />

            {selectedDay.notes?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                {selectedDay.notes.map((note, i) => (
                  <div key={i} style={{
                    background: 'white',
                    borderLeft: '3px solid var(--color-border)',
                    padding: '8px 12px',
                    fontSize: '13px',
                    color: 'var(--color-text-muted)',
                    borderRadius: '0 6px 6px 0',
                    lineHeight: '1.6',
                  }}>
                    {note}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prev / Next */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            borderTop: '1px solid var(--color-border)',
            background: 'white',
          }}>
            <button
              onClick={() => setSelectedDayNum(d => Math.max(1, d - 1))}
              disabled={selectedDayNum <= 1}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: selectedDayNum <= 1 ? 'default' : 'pointer',
                color: selectedDayNum <= 1 ? 'var(--color-border)' : 'var(--color-text)',
              }}
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {selectedDayNum} / {totalDays}
            </span>
            <button
              onClick={() => setSelectedDayNum(d => Math.min(totalDays, d + 1))}
              disabled={selectedDayNum >= totalDays}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: selectedDayNum >= totalDays ? 'default' : 'pointer',
                color: selectedDayNum >= totalDays ? 'var(--color-border)' : 'var(--color-text)',
              }}
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Collapsible summary sections ── */}

      {data.accommodation_suggestions?.length > 0 && (
        <CollapsibleSection title="Accommodation" icon={<Hotel size={15} strokeWidth={2} color="#64748B" />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.accommodation_suggestions.map((a, i) => (
              <div key={i} style={{
                paddingBottom: i < data.accommodation_suggestions.length - 1 ? '12px' : 0,
                borderBottom: i < data.accommodation_suggestions.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{a.area}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600, marginBottom: '4px' }}>{a.style}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.6' }}>{a.notes}</div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

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
              <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-text)' }}>
                ${data.budget_summary.estimated_total_aud.toLocaleString()}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>AUD estimated total</span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {data.budget_summary.assumptions?.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
                <span style={{ color: 'var(--color-border)', flexShrink: 0 }}>—</span>
                <span>{a}</span>
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
              <div key={i} style={{
                background: 'var(--color-accent)',
                border: '1px solid #FCD9B8',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                color: 'var(--color-primary-dark)',
                lineHeight: '1.6',
              }}>
                {note}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

    </div>
  )
}

// ─── Copy helper ──────────────────────────────────────────────────────────────

function buildCopyText(data: ItineraryJSON): string {
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
      lines.push(`Morning: ${day.morning.title} — ${day.morning.details}`)
      lines.push(`Afternoon: ${day.afternoon.title} — ${day.afternoon.details}`)
      lines.push(`Evening: ${day.evening.title} — ${day.evening.details}`)
      if (day.notes?.length) day.notes.forEach(n => lines.push(`Note: ${n}`))
      lines.push('')
    })
  }
  if (data.budget_summary?.estimated_total_aud) {
    lines.push(`## Budget: $${data.budget_summary.estimated_total_aud.toLocaleString()} AUD estimated total`)
  }
  return lines.join('\n')
}
