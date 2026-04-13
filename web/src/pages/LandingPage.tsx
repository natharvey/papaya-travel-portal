import { Link } from 'react-router-dom'
import { Sparkles, LayoutDashboard, MessageCircle, FileDown } from 'lucide-react'
import Layout from '../components/Layout'
import PapayaLogo from '../components/PapayaLogo'

const FEATURES = [
  {
    Icon: Sparkles,
    title: 'Instant Itineraries',
    desc: 'Enter your destination, dates, and budget — Papaya generates a complete day-by-day itinerary in minutes, tailored to your style.',
  },
  {
    Icon: LayoutDashboard,
    title: 'Your Planning Hub',
    desc: 'Everything in one place — your itinerary, flights, and stays, accessible anywhere and always up to date.',
  },
  {
    Icon: MessageCircle,
    title: 'Refine with Maya',
    desc: 'Ask Maya to swap activities, adjust the pace, add a free day, or rethink a destination. Instant changes, no waiting.',
  },
  {
    Icon: FileDown,
    title: 'Downloadable PDF',
    desc: 'Export your full itinerary as a beautifully formatted PDF to take offline or share with travel companions.',
  },
]

const STEPS = [
  { number: '01', title: 'Tell us your trip', desc: 'Enter your destination, dates, travel style, and budget. Takes about 2 minutes.' },
  { number: '02', title: 'Your itinerary is ready', desc: 'Papaya instantly generates a personalised day-by-day plan — no waiting, no back-and-forth.' },
  { number: '03', title: 'Refine until it\'s perfect', desc: 'Adjust anything in your portal — swap activities, change the pace, or ask Maya to tweak it.' },
]

export default function LandingPage() {
  return (
    <Layout variant="public">
      {/* Hero */}
      <section style={{
        background: 'var(--color-secondary)',
        padding: '80px 24px 100px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background decoration */}
        <div style={{
          position: 'absolute', top: -80, right: -80, width: 400, height: 400,
          borderRadius: '50%', background: 'rgba(240,115,50,0.08)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -60, width: 300, height: 300,
          borderRadius: '50%', background: 'rgba(240,115,50,0.06)', pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <PapayaLogo size={120} light />
          </div>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 900,
            color: 'white',
            lineHeight: 1.15,
            letterSpacing: '-1px',
            marginBottom: 20,
          }}>
            Your dream trip,<br />
            <span style={{ color: 'var(--color-primary)' }}>planned by Papaya.</span>
          </h1>
          <p style={{
            fontSize: '18px',
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.6,
            marginBottom: 40,
            maxWidth: 500,
            margin: '0 auto 40px',
          }}>
            Personalised travel itineraries crafted for you. Tell us where you want to go — we handle the rest.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/intake"
              style={{
                background: 'var(--color-primary)',
                color: 'white',
                padding: '16px 32px',
                borderRadius: 'var(--radius)',
                fontSize: '16px',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-block',
                transition: 'background 0.15s, transform 0.15s',
                boxShadow: '0 4px 16px rgba(240,115,50,0.4)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-dark)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              Plan my trip →
            </Link>
            <Link
              to="/login"
              style={{
                background: 'transparent',
                color: 'rgba(255,255,255,0.75)',
                padding: '16px 32px',
                borderRadius: 'var(--radius)',
                fontSize: '16px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
                border: '1.5px solid rgba(255,255,255,0.2)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}
            >
              Client login
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: 'var(--color-bg)', padding: '80px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{
            textAlign: 'center', fontSize: '28px', fontWeight: 800,
            color: 'var(--color-text)', marginBottom: 8, letterSpacing: '-0.3px',
          }}>
            How it works
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '15px', marginBottom: 56 }}>
            A few minutes to plan. A trip you'll remember forever.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 32 }}>
            {STEPS.map((step) => (
              <div key={step.number} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'var(--color-primary)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 800, margin: '0 auto 20px',
                  boxShadow: '0 4px 12px rgba(240,115,50,0.3)',
                }}>
                  {step.number}
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ background: 'var(--color-surface)', padding: '80px 24px', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{
            textAlign: 'center', fontSize: '28px', fontWeight: 800,
            color: 'var(--color-text)', marginBottom: 8, letterSpacing: '-0.3px',
          }}>
            Everything you need
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '15px', marginBottom: 56 }}>
            Everything you need to plan, refine, and manage your trip — all in one place.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '28px 24px',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, marginBottom: 16,
                  background: 'var(--color-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <f.Icon size={22} color="var(--color-primary)" strokeWidth={1.75} />
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: 'var(--color-bg)', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <h2 style={{
            fontSize: '30px', fontWeight: 900, color: 'var(--color-text)',
            marginBottom: 16, letterSpacing: '-0.4px',
          }}>
            Ready to start planning?
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '15px', lineHeight: 1.6, marginBottom: 36 }}>
            Tell Papaya where you want to go — get a full personalised itinerary in minutes, ready to refine and take with you.
          </p>
          <Link
            to="/intake"
            style={{
              background: 'var(--color-primary)',
              color: 'white',
              padding: '16px 40px',
              borderRadius: 'var(--radius)',
              fontSize: '16px',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-block',
              boxShadow: '0 4px 16px rgba(240,115,50,0.35)',
              transition: 'background 0.15s, transform 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-dark)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            Plan my trip →
          </Link>
        </div>
      </section>
    </Layout>
  )
}
