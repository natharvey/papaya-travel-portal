import { useState } from 'react'
import {
  Bus, Car, Train, Ship, Plane, Wallet, Backpack, AlertTriangle,
  Thermometer, Calendar, Heart, DollarSign, Hotel, Utensils, Ticket,
  Shield, Info, Shirt, Sun, Camera, ChevronDown, ChevronUp, X,
} from 'lucide-react'
import type { ItineraryJSON, HeadsUp } from '../types'

// ─── Heads Up ────────────────────────────────────────────────────────────────

const HEADS_UP_CONFIG: Record<HeadsUp['category'], { emoji: string; bg: string; border: string; text: string; badge: string; badgeText: string }> = {
  visa:      { emoji: '🛂', bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', badge: '#FEF3C7', badgeText: 'Visa' },
  book:      { emoji: '📅', bg: '#FFF1F2', border: '#FECDD3', text: '#9F1239', badge: '#FFE4E6', badgeText: 'Book ahead' },
  weather:   { emoji: '🌤️', bg: '#F0F9FF', border: '#BAE6FD', text: '#0C4A6E', badge: '#E0F2FE', badgeText: 'Weather' },
  dress:     { emoji: '👗', bg: '#FAF5FF', border: '#DDD6FE', text: '#4C1D95', badge: '#EDE9FE', badgeText: 'Dress code' },
  health:    { emoji: '💊', bg: '#F0FDF4', border: '#BBF7D0', text: '#14532D', badge: '#DCFCE7', badgeText: 'Health' },
  money:     { emoji: '💳', bg: '#F0FDF4', border: '#A7F3D0', text: '#065F46', badge: '#D1FAE5', badgeText: 'Money' },
  etiquette: { emoji: '🙏', bg: '#EFF6FF', border: '#BFDBFE', text: '#1E3A5F', badge: '#DBEAFE', badgeText: 'Etiquette' },
}

function HeadsUpSection({ items }: { items: HeadsUp[] }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'white', border: '1px solid var(--color-border)', borderRadius: '10px 10px 0 0', borderBottom: 'none' }}>
        <span style={{ fontSize: 16 }}>⚡</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Heads up</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500 }}>{items.length} things to know before you go</span>
      </div>
      <div style={{ border: '1px solid var(--color-border)', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
        {items.map((item, i) => {
          const cfg = HEADS_UP_CONFIG[item.category] ?? HEADS_UP_CONFIG.visa
          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '14px 18px',
                background: i % 2 === 0 ? 'white' : '#FAFAFA',
                borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: cfg.bg, border: `1px solid ${cfg.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17,
              }}>
                {cfg.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)', marginBottom: 3 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{item.description}</div>
              </div>
              <span style={{
                flexShrink: 0, alignSelf: 'flex-start',
                fontSize: 10, fontWeight: 700, padding: '3px 9px',
                borderRadius: 100, textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                background: cfg.badge, color: cfg.text,
              }}>
                {cfg.badgeText}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Budget modal ─────────────────────────────────────────────────────────────

function BudgetModal({ data, onClose }: { data: NonNullable<ItineraryJSON['budget_summary']>; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '100%', maxWidth: 500, maxHeight: '85vh', overflowY: 'auto',
        background: 'white', borderRadius: 20, zIndex: 1001,
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{ padding: '22px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Estimated budget</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              {data.per_person_aud && (
                <div>
                  <span style={{ fontSize: 36, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-1.5px' }}>
                    ${data.per_person_aud.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)', marginLeft: 6 }}>per person</span>
                </div>
              )}
              {!data.per_person_aud && data.estimated_total_aud && (
                <div>
                  <span style={{ fontSize: 36, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-1.5px' }}>
                    ${data.estimated_total_aud.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)', marginLeft: 6 }}>AUD estimated total</span>
                </div>
              )}
            </div>
            {data.per_person_aud && data.estimated_total_aud && (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                ~${data.estimated_total_aud.toLocaleString()} AUD total for group
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X size={16} color="#6B7280" />
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--color-border)', margin: '20px 0 0' }} />

        {/* Line items */}
        <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Breakdown</div>
          {data.assumptions?.map((a, i) => {
            const t = a.toLowerCase()
            let Icon = DollarSign; let iconColor = '#64748B'
            if (t.includes('flight') || t.includes('fly')) { Icon = Plane; iconColor = '#3B82F6' }
            else if (t.includes('accommodation') || t.includes('hotel') || t.includes('night')) { Icon = Hotel; iconColor = '#7C3AED' }
            else if (t.includes('dining') || t.includes('food') || t.includes('restaurant') || t.includes('breakfast') || t.includes('dinner')) { Icon = Utensils; iconColor = '#EA580C' }
            else if (t.includes('activit') || t.includes('entry') || t.includes('tour') || t.includes('ticket')) { Icon = Ticket; iconColor = '#0891B2' }
            else if (t.includes('transport') || t.includes('hire car') || t.includes('taxi') || t.includes('train') || t.includes('rail')) { Icon = Car; iconColor = '#16A34A' }
            else if (t.includes('insurance')) { Icon = Shield; iconColor = '#DC2626' }
            else if (t.includes('incidental') || t.includes('shopping') || t.includes('misc')) { Icon = Info; iconColor = '#9CA3AF' }
            return (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 12px', borderRadius: 10, alignItems: 'flex-start', background: i % 2 === 0 ? '#FAFAFA' : 'white' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'white', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <Icon size={13} color={iconColor} strokeWidth={2} />
                </div>
                <span style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6, paddingTop: 4 }}>{a}</span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ─── Accordion section ────────────────────────────────────────────────────────

function AccordionSection({
  id, open, onToggle, title, icon, children,
}: {
  id: string; open: boolean; onToggle: (id: string) => void
  title: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => onToggle(id)}
        style={{
          width: '100%', background: 'white',
          border: '1px solid var(--color-border)',
          borderRadius: open ? '10px 10px 0 0' : '10px',
          padding: '14px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--color-text)',
          transition: 'background 0.15s', fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{icon}{title}</div>
        {open ? <ChevronUp size={16} color="#94A3B8" /> : <ChevronDown size={16} color="#94A3B8" />}
      </button>
      {open && (
        <div style={{ border: '1px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 18, background: 'var(--color-bg)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TravelNotesTab({ data }: { data: ItineraryJSON }) {
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [budgetOpen, setBudgetOpen] = useState(false)

  function toggle(id: string) {
    setOpenSection(prev => prev === id ? null : id)
  }

  const headsUp = data.heads_up ?? []
  const hasTransport = (data.transport_notes?.length ?? 0) > 0
  const hasBudget = !!data.budget_summary
  const hasPacking = (data.packing_checklist?.length ?? 0) > 0
  const hasRisks = (data.risks_and_notes?.length ?? 0) > 0

  return (
    <div>
      {/* Heads Up */}
      {headsUp.length > 0 && <HeadsUpSection items={headsUp} />}

      {/* Budget — always-visible card, click to expand modal */}
      {hasBudget && (
        <div style={{ marginBottom: 8 }}>
          <button
            onClick={() => setBudgetOpen(true)}
            style={{
              width: '100%', background: 'white',
              border: '1px solid var(--color-border)', borderRadius: 10,
              padding: '14px 18px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Wallet size={15} strokeWidth={2} color="#64748B" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Budget Summary</span>
              {data.budget_summary?.per_person_aud && (
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>
                  ~${data.budget_summary.per_person_aud.toLocaleString()} <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--color-text-muted)' }}>per person</span>
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>View breakdown →</span>
          </button>
        </div>
      )}

      {/* Transport */}
      {hasTransport && (
        <AccordionSection id="transport" open={openSection === 'transport'} onToggle={toggle}
          title="Transport" icon={<Bus size={15} strokeWidth={2} color="#64748B" />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.transport_notes.map((note, i) => {
              const t = note.toLowerCase()
              let Icon = Bus; let iconColor = '#64748B'; let bg = 'var(--color-bg)'
              if (t.includes('fly') || t.includes('flight') || t.includes('airport')) { Icon = Plane; iconColor = '#3B82F6'; bg = '#EFF6FF' }
              else if (t.includes('ferry') || t.includes('boat')) { Icon = Ship; iconColor = '#0891B2'; bg = '#ECFEFF' }
              else if (t.includes('hire car') || t.includes('drive') || t.includes('driving') || t.includes('car ')) { Icon = Car; iconColor = '#16A34A'; bg = '#F0FDF4' }
              else if (t.includes('train') || t.includes('bus') || t.includes('tram') || t.includes('transit') || t.includes('metro')) { Icon = Train; iconColor = '#9333EA'; bg = '#FAF5FF' }
              return (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 10, background: bg, border: '1px solid var(--color-border)', alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <Icon size={14} color={iconColor} strokeWidth={2} />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6, paddingTop: 4 }}>{note}</span>
                </div>
              )
            })}
          </div>
        </AccordionSection>
      )}

      {/* Packing */}
      {hasPacking && (
        <AccordionSection id="packing" open={openSection === 'packing'} onToggle={toggle}
          title={`Packing (${data.packing_checklist.length} items)`} icon={<Backpack size={15} strokeWidth={2} color="#64748B" />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 4 }}>
            {data.packing_checklist.map((item, i) => {
              const t = item.toLowerCase()
              let Icon = Backpack
              if (t.includes('jacket') || t.includes('clothing') || t.includes('outfit') || t.includes('shirt') || t.includes('layer')) Icon = Shirt
              else if (t.includes('shoe') || t.includes('boot') || t.includes('walking')) Icon = Backpack
              else if (t.includes('camera') || t.includes('phone') || t.includes('battery')) Icon = Camera
              else if (t.includes('passport') || t.includes('document') || t.includes('card') || t.includes('licence')) Icon = Ticket
              else if (t.includes('sunscreen') || t.includes('sunglass') || t.includes('sun')) Icon = Sun
              else if (t.includes('medication') || t.includes('first aid') || t.includes('medical') || t.includes('prescription')) Icon = Shield
              return (
                <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, transition: 'background 0.1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'white' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <input type="checkbox" style={{ accentColor: 'var(--color-primary)', width: 15, height: 15, marginTop: 2, flexShrink: 0 }} />
                  <Icon size={13} color="var(--color-text-muted)" strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{item}</span>
                </label>
              )
            })}
          </div>
        </AccordionSection>
      )}

      {/* Risks & Notes */}
      {hasRisks && (
        <AccordionSection id="risks" open={openSection === 'risks'} onToggle={toggle}
          title="Risks & Notes" icon={<AlertTriangle size={15} strokeWidth={2} color="#64748B" />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.risks_and_notes.map((note, i) => {
              const colonIdx = note.indexOf(':')
              const hasHeading = colonIdx > 0 && colonIdx < 40 && note.slice(0, colonIdx) === note.slice(0, colonIdx).toUpperCase()
              const heading = hasHeading ? note.slice(0, colonIdx).trim() : null
              const body = hasHeading ? note.slice(colonIdx + 1).trim() : note
              const t = (heading ?? note).toLowerCase()
              let Icon = AlertTriangle; let iconColor = '#EA580C'; let bg = '#FFF7ED'; let border = '#FED7AA'
              if (t.includes('weather') || t.includes('climate') || t.includes('rain') || t.includes('season')) { Icon = Thermometer; iconColor = '#0891B2'; bg = '#ECFEFF'; border = '#A5F3FC' }
              else if (t.includes('holiday') || t.includes('busy') || t.includes('crowd') || t.includes('peak')) { Icon = Calendar; iconColor = '#7C3AED'; bg = '#FAF5FF'; border = '#DDD6FE' }
              else if (t.includes('sensitiv') || t.includes('respect') || t.includes('culture') || t.includes('histor')) { Icon = Heart; iconColor = '#DC2626'; bg = '#FEF2F2'; border = '#FECACA' }
              return (
                <div key={i} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 16px', lineHeight: 1.6 }}>
                  {heading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Icon size={13} color={iconColor} strokeWidth={2.5} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: iconColor, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{heading}</span>
                    </div>
                  )}
                  <span style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6 }}>{body}</span>
                </div>
              )
            })}
          </div>
        </AccordionSection>
      )}

      {/* Budget modal */}
      {budgetOpen && data.budget_summary && (
        <BudgetModal data={data.budget_summary} onClose={() => setBudgetOpen(false)} />
      )}
    </div>
  )
}
