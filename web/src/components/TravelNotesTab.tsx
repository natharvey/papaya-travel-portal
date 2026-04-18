import { useState } from 'react'
import {
  Bus, Car, Train, Ship, Plane, Wallet, Backpack, AlertTriangle,
  Thermometer, Calendar, Heart, DollarSign, Hotel, Utensils, Ticket,
  Shield, Info, Shirt, Sun, Camera, ChevronDown, ChevronUp, X,
  FileCheck, Users, CreditCard, CloudRain, type LucideIcon,
} from 'lucide-react'
import type { ItineraryJSON, HeadsUp } from '../types'

// ─── Generic wide modal ───────────────────────────────────────────────────────

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(92vw, 900px)', maxHeight: '88vh', overflowY: 'auto',
        background: 'white', borderRadius: 20, zIndex: 1001,
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
      }}>
        {children}
      </div>
    </>
  )
}

function ModalHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <>
      <div style={{ padding: '22px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.5px' }}>{subtitle}</div>}
        </div>
        <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <X size={16} color="#6B7280" />
        </button>
      </div>
      <div style={{ height: 1, background: 'var(--color-border)', margin: '18px 0 0' }} />
    </>
  )
}

// ─── Section button (all sections use this) ───────────────────────────────────

function SectionButton({ icon, label, meta, onClick }: { icon: React.ReactNode; label: string; meta?: string; onClick: () => void }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={onClick}
        style={{
          width: '100%', background: 'white',
          border: '1px solid var(--color-border)', borderRadius: 10,
          padding: '14px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FAFAFA' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'white' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon}
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{label}</span>
          {meta && <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 400 }}>{meta}</span>}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>View →</span>
      </button>
    </div>
  )
}

// ─── Heads Up (Before You Go) ─────────────────────────────────────────────────

const HEADS_UP_CONFIG: Record<HeadsUp['category'], { Icon: LucideIcon; bg: string; border: string; iconColor: string; badgeText: string }> = {
  visa:      { Icon: FileCheck,   bg: '#FFFBEB', border: '#FDE68A', iconColor: '#D97706', badgeText: 'Visa' },
  book:      { Icon: Calendar,    bg: '#FFF1F2', border: '#FECDD3', iconColor: '#E11D48', badgeText: 'Book ahead' },
  weather:   { Icon: CloudRain,   bg: '#F0F9FF', border: '#BAE6FD', iconColor: '#0284C7', badgeText: 'Weather' },
  dress:     { Icon: Shirt,       bg: '#FAF5FF', border: '#DDD6FE', iconColor: '#7C3AED', badgeText: 'Dress code' },
  health:    { Icon: Shield,      bg: '#F0FDF4', border: '#BBF7D0', iconColor: '#15803D', badgeText: 'Health' },
  money:     { Icon: CreditCard,  bg: '#F0FDF4', border: '#A7F3D0', iconColor: '#059669', badgeText: 'Money' },
  etiquette: { Icon: Users,       bg: '#EFF6FF', border: '#BFDBFE', iconColor: '#1D4ED8', badgeText: 'Etiquette' },
}

function HeadsUpModal({ items, onClose }: { items: HeadsUp[]; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Before You Go" subtitle={`${items.length} things to know`} onClose={onClose} />
      <div style={{ padding: '16px 24px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, i) => {
          const cfg = HEADS_UP_CONFIG[item.category] ?? HEADS_UP_CONFIG.visa
          const { Icon } = cfg
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'white', border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} strokeWidth={2} color={cfg.iconColor} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)', marginBottom: 3 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.65 }}>{item.description}</div>
              </div>
              <span style={{ flexShrink: 0, alignSelf: 'flex-start', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 100, textTransform: 'uppercase' as const, letterSpacing: '0.04em', background: 'white', color: cfg.iconColor, border: `1px solid ${cfg.border}` }}>
                {cfg.badgeText}
              </span>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

// ─── Budget modal ─────────────────────────────────────────────────────────────

function BudgetModal({ data, onClose }: { data: NonNullable<ItineraryJSON['budget_summary']>; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
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
      <div style={{ height: 1, background: 'var(--color-border)', margin: '20px 0 0' }} />
      <div style={{ padding: '16px 24px 28px', display: 'flex', flexDirection: 'column', gap: 4 }}>
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
    </Modal>
  )
}

// ─── Transport modal ──────────────────────────────────────────────────────────

function TransportModal({ notes, onClose }: { notes: string[]; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Transport" subtitle="Getting around" onClose={onClose} />
      <div style={{ padding: '16px 24px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notes.map((note, i) => {
          const t = note.toLowerCase()
          let Icon = Bus; let iconColor = '#64748B'; let bg = '#F9FAFB'; let border = 'var(--color-border)'
          if (t.includes('fly') || t.includes('flight') || t.includes('airport')) { Icon = Plane; iconColor = '#3B82F6'; bg = '#EFF6FF'; border = '#BFDBFE' }
          else if (t.includes('ferry') || t.includes('boat')) { Icon = Ship; iconColor = '#0891B2'; bg = '#ECFEFF'; border = '#A5F3FC' }
          else if (t.includes('hire car') || t.includes('drive') || t.includes('driving') || t.includes('car ')) { Icon = Car; iconColor = '#16A34A'; bg = '#F0FDF4'; border = '#BBF7D0' }
          else if (t.includes('train') || t.includes('bus') || t.includes('tram') || t.includes('transit') || t.includes('metro')) { Icon = Train; iconColor = '#9333EA'; bg = '#FAF5FF'; border = '#DDD6FE' }
          return (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderRadius: 12, background: bg, border: `1px solid ${border}`, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <Icon size={15} color={iconColor} strokeWidth={2} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.65, paddingTop: 6 }}>{note}</span>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

// ─── Packing modal ────────────────────────────────────────────────────────────

function PackingModal({ items, onClose }: { items: string[]; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Packing" subtitle={`${items.length} items`} onClose={onClose} />
      <div style={{ padding: '16px 24px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 4 }}>
          {items.map((item, i) => {
            const t = item.toLowerCase()
            let Icon = Backpack
            if (t.includes('jacket') || t.includes('clothing') || t.includes('outfit') || t.includes('shirt') || t.includes('layer')) Icon = Shirt
            else if (t.includes('camera') || t.includes('phone') || t.includes('battery')) Icon = Camera
            else if (t.includes('passport') || t.includes('document') || t.includes('card') || t.includes('licence')) Icon = Ticket
            else if (t.includes('sunscreen') || t.includes('sunglass') || t.includes('sun')) Icon = Sun
            else if (t.includes('medication') || t.includes('first aid') || t.includes('medical') || t.includes('prescription')) Icon = Shield

            const dashIdx = item.indexOf(' — ')
            const splitAt = dashIdx > 0 ? dashIdx : -1
            const itemName = splitAt > 0 ? item.slice(0, splitAt) : item
            const itemDesc = splitAt > 0 ? item.slice(splitAt + 3) : null

            return (
              <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, transition: 'background 0.1s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F9FAFB' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <input type="checkbox" style={{ accentColor: 'var(--color-primary)', width: 15, height: 15, marginTop: 3, flexShrink: 0 }} />
                <Icon size={13} color="var(--color-text-muted)" strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 3 }} />
                <span style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{itemName}</span>
                  {itemDesc && <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: 12 }}> — {itemDesc}</span>}
                </span>
              </label>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

// ─── Risks modal ──────────────────────────────────────────────────────────────

function RisksModal({ notes, onClose }: { notes: string[]; onClose: () => void }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Risks & Notes" subtitle="Important trip information" onClose={onClose} />
      <div style={{ padding: '16px 24px 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes.map((note, i) => {
          const colonIdx = note.indexOf(':')
          const hasTitle = colonIdx > 0 && colonIdx < 60
          const title = hasTitle ? note.slice(0, colonIdx).trim() : note.slice(0, 50)
          const body = hasTitle ? note.slice(colonIdx + 1).trim() : note
          const t = title.toLowerCase()

          let Icon = Info; let iconColor = '#6B7280'; let bg = '#F9FAFB'; let border = '#E5E7EB'
          if (t.includes('weather') || t.includes('climate') || t.includes('rain') || t.includes('season') || t.includes('road') || t.includes('closure'))
            { Icon = CloudRain; iconColor = '#0284C7'; bg = '#F0F9FF'; border = '#BAE6FD' }
          else if (t.includes('book') || t.includes('reserv') || t.includes('ticket') || t.includes('advance'))
            { Icon = Calendar; iconColor = '#7C3AED'; bg = '#FAF5FF'; border = '#DDD6FE' }
          else if (t.includes('crowd') || t.includes('peak') || t.includes('busy') || t.includes('festival') || t.includes('new year') || t.includes('christmas'))
            { Icon = Calendar; iconColor = '#7C3AED'; bg = '#FAF5FF'; border = '#DDD6FE' }
          else if (t.includes('culture') || t.includes('etiquette') || t.includes('custom') || t.includes('pub') || t.includes('etiq'))
            { Icon = Users; iconColor = '#1D4ED8'; bg = '#EFF6FF'; border = '#BFDBFE' }
          else if (t.includes('budget') || t.includes('money') || t.includes('cost') || t.includes('fee') || t.includes('currency') || t.includes('cash'))
            { Icon = DollarSign; iconColor = '#16A34A'; bg = '#F0FDF4'; border = '#BBF7D0' }
          else if (t.includes('visa') || t.includes('passport') || t.includes('entry') || t.includes('customs'))
            { Icon = FileCheck; iconColor = '#D97706'; bg = '#FFFBEB'; border = '#FDE68A' }
          else if (t.includes('health') || t.includes('medical') || t.includes('vaccin') || t.includes('daylight') || t.includes('winter'))
            { Icon = Shield; iconColor = '#DC2626'; bg = '#FEF2F2'; border = '#FECACA' }
          else if (t.includes('food') || t.includes('dining') || t.includes('allerg'))
            { Icon = Utensils; iconColor = '#EA580C'; bg = '#FFF7ED'; border = '#FED7AA' }

          const isOpen = openIdx === i

          return (
            <div key={i} style={{ border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenIdx(prev => prev === i ? null : i)}
                style={{ width: '100%', background: bg, border: 'none', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              >
                <Icon size={14} color={iconColor} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', flex: 1 }}>{title}</span>
                {isOpen ? <ChevronUp size={14} color="#94A3B8" style={{ flexShrink: 0 }} /> : <ChevronDown size={14} color="#94A3B8" style={{ flexShrink: 0 }} />}
              </button>
              {isOpen && (
                <div style={{ padding: '12px 16px', background: 'white', borderTop: `1px solid ${border}` }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.7 }}>{body}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TravelNotesTab({ data }: { data: ItineraryJSON }) {
  const [modal, setModal] = useState<'headsup' | 'budget' | 'transport' | 'packing' | 'risks' | null>(null)

  const headsUp = data.heads_up ?? []
  const hasTransport = (data.transport_notes?.length ?? 0) > 0
  const hasBudget = !!data.budget_summary
  const hasPacking = (data.packing_checklist?.length ?? 0) > 0
  const hasRisks = (data.risks_and_notes?.length ?? 0) > 0

  return (
    <div>
      {headsUp.length > 0 && (
        <SectionButton
          icon={<Info size={15} strokeWidth={2} color="#64748B" />}
          label="Before You Go"
          meta={`${headsUp.length} things to know`}
          onClick={() => setModal('headsup')}
        />
      )}

      {hasBudget && (
        <SectionButton
          icon={<Wallet size={15} strokeWidth={2} color="#64748B" />}
          label="Budget Summary"
          meta={data.budget_summary?.per_person_aud ? `~$${data.budget_summary.per_person_aud.toLocaleString()} per person` : undefined}
          onClick={() => setModal('budget')}
        />
      )}

      {hasTransport && (
        <SectionButton
          icon={<Bus size={15} strokeWidth={2} color="#64748B" />}
          label="Transport"
          meta={`${data.transport_notes.length} notes`}
          onClick={() => setModal('transport')}
        />
      )}

      {hasPacking && (
        <SectionButton
          icon={<Backpack size={15} strokeWidth={2} color="#64748B" />}
          label="Packing"
          meta={`${data.packing_checklist.length} items`}
          onClick={() => setModal('packing')}
        />
      )}

      {hasRisks && (
        <SectionButton
          icon={<AlertTriangle size={15} strokeWidth={2} color="#64748B" />}
          label="Risks & Notes"
          meta={`${data.risks_and_notes.length} items`}
          onClick={() => setModal('risks')}
        />
      )}

      {modal === 'headsup' && <HeadsUpModal items={headsUp} onClose={() => setModal(null)} />}
      {modal === 'budget' && data.budget_summary && <BudgetModal data={data.budget_summary} onClose={() => setModal(null)} />}
      {modal === 'transport' && <TransportModal notes={data.transport_notes} onClose={() => setModal(null)} />}
      {modal === 'packing' && <PackingModal items={data.packing_checklist} onClose={() => setModal(null)} />}
      {modal === 'risks' && <RisksModal notes={data.risks_and_notes} onClose={() => setModal(null)} />}
    </div>
  )
}
