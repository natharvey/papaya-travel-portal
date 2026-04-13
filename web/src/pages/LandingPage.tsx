import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import PapayaLogo from '../components/PapayaLogo'

const FEATURES = [
  {
    icon: '✈️',
    title: 'AI-Crafted Itineraries',
    desc: 'Tell us your dream trip and our AI builds a day-by-day itinerary tailored to your style, budget, and travel dates.',
  },
  {
    icon: '🗺️',
    title: 'Your Own Client Portal',
    desc: 'Track flights, stays, and activities in one place. Your itinerary is always up to date and accessible anywhere.',
  },
  {
    icon: '💬',
    title: 'Real Collaboration',
    desc: 'Chat directly with your travel planner, request changes, and get quick responses — no endless email threads.',
  },
  {
    icon: '📄',
    title: 'Downloadable PDF',
    desc: 'Export your full itinerary as a beautifully formatted PDF to take offline or share with travel companions.',
  },
]

const STEPS = [
  { number: '01', title: 'Submit your enquiry', desc: 'Tell us where you want to go, your dates, travel style, and budget. Takes about 2 minutes.' },
  { number: '02', title: 'We build your itinerary', desc: 'Our AI and travel experts craft a personalised day-by-day plan just for you.' },
  { number: '03', title: 'Refine and confirm', desc: 'Review everything in your portal, request tweaks, and confirm when you\'re happy.' },
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
            From enquiry to confirmed itinerary in days, not weeks.
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
            A complete travel planning experience from first enquiry to departure day.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '28px 24px',
              }}>
                <div style={{ fontSize: '28px', marginBottom: 14 }}>{f.icon}</div>
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
            Submit your enquiry and we'll have a personalised itinerary ready for you to review in your portal.
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
