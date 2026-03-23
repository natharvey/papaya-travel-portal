import { useState } from 'react'
import type { ItineraryJSON, DayBlock } from '../types'

interface Props {
  data: ItineraryJSON
}

function CostBadge({ amount }: { amount: number | null }) {
  if (!amount) return null
  return (
    <span style={{
      background: '#DCFCE7',
      color: '#15803D',
      fontSize: '11px',
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: '100px',
      marginLeft: '8px',
    }}>
      ~${amount} AUD
    </span>
  )
}

function BookingBadge() {
  return (
    <span style={{
      background: '#FEF9C3',
      color: '#A16207',
      fontSize: '11px',
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: '100px',
      marginLeft: '8px',
    }}>
      📌 Book ahead
    </span>
  )
}

function TimeBlock({ period, block }: { period: string; block: DayBlock }) {
  const periodColors: Record<string, { bg: string; accent: string }> = {
    Morning: { bg: '#FFF7ED', accent: '#F97316' },
    Afternoon: { bg: '#EEF2FF', accent: '#6366F1' },
    Evening: { bg: '#1E293B', accent: '#94A3B8' },
  }
  const colors = periodColors[period] || { bg: '#F8FAFC', accent: '#64748B' }
  const isEvening = period === 'Evening'

  return (
    <div style={{
      background: colors.bg,
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          color: colors.accent,
          marginRight: '4px',
        }}>
          {period === 'Morning' ? '🌅' : period === 'Afternoon' ? '☀️' : '🌙'} {period}
        </span>
        <CostBadge amount={block.est_cost_aud} />
        {block.booking_needed && <BookingBadge />}
      </div>
      <div style={{ fontWeight: 600, fontSize: '15px', color: isEvening ? '#F1F5F9' : 'var(--color-text)', marginBottom: '4px' }}>
        {block.title}
      </div>
      <div style={{ fontSize: '13px', color: isEvening ? '#CBD5E1' : 'var(--color-text-muted)', lineHeight: '1.5' }}>
        {block.details}
      </div>
    </div>
  )
}

export default function ItineraryTimeline({ data }: Props) {
  const [packingOpen, setPackingOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const text = buildCopyText(data)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* Header / Overview */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-secondary), #1a2639)',
        color: 'white',
        borderRadius: 'var(--radius-lg)',
        padding: '28px',
        marginBottom: '24px',
      }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>{data.trip_title}</h2>
        <p style={{ color: '#CBD5E1', lineHeight: '1.6', fontSize: '14px' }}>{data.overview}</p>

        {/* Destination chips */}
        {data.destinations && data.destinations.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
            {data.destinations.map((d, i) => (
              <span key={i} style={{
                background: 'rgba(255,107,53,0.2)',
                border: '1px solid rgba(255,107,53,0.4)',
                color: '#FFA07A',
                padding: '4px 12px',
                borderRadius: '100px',
                fontSize: '13px',
                fontWeight: 500,
              }}>
                📍 {d.name} · {d.nights}n
              </span>
            ))}
          </div>
        )}

        <button
          onClick={handleCopy}
          style={{
            marginTop: '16px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            padding: '8px 18px',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          {copied ? '✓ Copied!' : '📋 Copy full summary'}
        </button>
      </div>

      {/* Day-by-day */}
      {data.day_plans && data.day_plans.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--color-secondary)' }}>
            Day-by-Day Itinerary
          </h3>
          {data.day_plans.map((day) => (
            <div key={day.day_number} style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '16px',
              overflow: 'hidden',
            }}>
              {/* Day header */}
              <div style={{
                background: 'var(--color-secondary)',
                color: 'white',
                padding: '12px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '15px' }}>Day {day.day_number}</span>
                  <span style={{ color: '#94A3B8', fontSize: '13px', marginLeft: '12px' }}>{day.date}</span>
                </div>
                <span style={{
                  background: 'rgba(255,107,53,0.3)',
                  color: '#FF8C5A',
                  padding: '3px 10px',
                  borderRadius: '100px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}>
                  📍 {day.location_base}
                </span>
              </div>

              {/* Time blocks */}
              <div style={{ padding: '12px' }}>
                <TimeBlock period="Morning" block={day.morning} />
                <TimeBlock period="Afternoon" block={day.afternoon} />
                <TimeBlock period="Evening" block={day.evening} />

                {day.notes && day.notes.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    {day.notes.map((note, i) => (
                      <div key={i} style={{
                        background: '#F8FAFC',
                        borderLeft: '3px solid var(--color-primary)',
                        padding: '8px 12px',
                        fontSize: '13px',
                        color: 'var(--color-text-muted)',
                        marginBottom: '4px',
                        borderRadius: '0 4px 4px 0',
                      }}>
                        💡 {note}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Accommodation */}
      {data.accommodation_suggestions && data.accommodation_suggestions.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: 'var(--color-secondary)' }}>
            🏨 Accommodation Suggestions
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {data.accommodation_suggestions.map((a, i) => (
              <div key={i} style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: '14px 16px',
              }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{a.area}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-primary)', marginBottom: '4px', fontWeight: 500 }}>
                  {a.style}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{a.notes}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Transport notes */}
      {data.transport_notes && data.transport_notes.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: 'var(--color-secondary)' }}>
            🚌 Transport Notes
          </h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.transport_notes.map((note, i) => (
              <li key={i} style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: '10px 14px',
                fontSize: '14px',
                display: 'flex',
                gap: '8px',
              }}>
                <span>→</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Budget Summary */}
      {data.budget_summary && (
        <section style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: 'var(--color-secondary)' }}>
            💰 Budget Summary
          </h3>
          <div style={{
            background: 'var(--color-accent)',
            border: '1px solid #FFCC99',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
          }}>
            {data.budget_summary.estimated_total_aud && (
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '12px' }}>
                ${data.budget_summary.estimated_total_aud.toLocaleString()} AUD
                <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '8px' }}>
                  estimated total
                </span>
              </div>
            )}
            {data.budget_summary.assumptions && data.budget_summary.assumptions.length > 0 && (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {data.budget_summary.assumptions.map((a, i) => (
                  <li key={i} style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', gap: '6px' }}>
                    <span>•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Packing Checklist (collapsible) */}
      {data.packing_checklist && data.packing_checklist.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <button
            onClick={() => setPackingOpen(!packingOpen)}
            style={{
              width: '100%',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--color-secondary)',
            }}
          >
            <span>🧳 Packing Checklist ({data.packing_checklist.length} items)</span>
            <span>{packingOpen ? '▲' : '▼'}</span>
          </button>
          {packingOpen && (
            <div style={{
              border: '1px solid var(--color-border)',
              borderTop: 'none',
              borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
              padding: '16px 18px',
              background: 'var(--color-surface)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                {data.packing_checklist.map((item, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                    <input type="checkbox" style={{ accentColor: 'var(--color-primary)' }} />
                    {item}
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Risks and Notes */}
      {data.risks_and_notes && data.risks_and_notes.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: 'var(--color-secondary)' }}>
            ⚠️ Risks & Important Notes
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.risks_and_notes.map((note, i) => (
              <div key={i} style={{
                background: '#FFF7ED',
                border: '1px solid #FED7AA',
                borderRadius: 'var(--radius)',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#7C2D12',
                display: 'flex',
                gap: '8px',
              }}>
                <span>⚠️</span>
                <span>{note}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function buildCopyText(data: ItineraryJSON): string {
  const lines: string[] = []
  lines.push(`# ${data.trip_title}`)
  lines.push('')
  lines.push('## Overview')
  lines.push(data.overview)
  lines.push('')
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
