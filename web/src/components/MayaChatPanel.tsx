import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, Send, ChevronLeft } from 'lucide-react'
import { tripChat, sendClientMessage, markClientMessagesRead } from '../api/client'
import type { Message, Itinerary } from '../types'

const MAYA_GREETING = "Hi! I'm Maya. I can adjust anything about your itinerary — swap activities, change the pace, add day trips, or make it more budget-friendly. What would you like to change?"

const SUGGESTED_PROMPTS = [
  'Make it more budget-friendly',
  'Add more adventure activities',
  'Swap a destination',
  'Change the travel pace',
  'Add a free day',
  'More local food experiences',
]

interface Props {
  tripId: string
  messages: Message[]
  onMessagesUpdated: (msgs: Message[]) => void
  onItineraryUpdated: (newItinerary: Itinerary) => void
  hidden?: boolean
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

const MayaAvatar = () => (
  <div style={{
    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(240,115,50,0.30)',
  }}>
    <span style={{ color: 'white', fontWeight: 800, fontSize: 13, fontFamily: 'inherit' }}>M</span>
  </div>
)

export default function MayaChatPanel({ tripId, messages, onMessagesUpdated, onItineraryUpdated, hidden }: Props) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'maya' | 'advisor'>('maya')

  // Maya chat state
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [visibleWords, setVisibleWords] = useState(0)
  const [greetingDone, setGreetingDone] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // Advisor state
  const [advisorInput, setAdvisorInput] = useState('')
  const [advisorSending, setAdvisorSending] = useState(false)
  const advisorBottomRef = useRef<HTMLDivElement>(null)

  const unreadCount = messages.filter(m => m.sender_type === 'ADMIN' && !m.is_read).length
  const greetingWords = MAYA_GREETING.split(' ')
  const greetingText = greetingWords.slice(0, visibleWords).join(' ')

  // Word-by-word greeting when panel opens
  useEffect(() => {
    if (!open || view !== 'maya') return
    setVisibleWords(0)
    setGreetingDone(false)
    let i = 0
    function revealNext() {
      i++
      setVisibleWords(i)
      if (i >= greetingWords.length) {
        setGreetingDone(true)
        return
      }
      // Variable timing: short words faster, longer words slightly slower
      const word = greetingWords[i - 1]
      const delay = word.length <= 3 ? 100 : word.endsWith(',') || word.endsWith('.') ? 320 : 150
      setTimeout(revealNext, delay)
    }
    const start = setTimeout(revealNext, 200)
    return () => clearTimeout(start)
  }, [open, view])

  // Mark advisor messages read when switching to advisor view
  useEffect(() => {
    if (!open || view !== 'advisor') return
    markClientMessagesRead(tripId)
    onMessagesUpdated(messages.map(m => m.sender_type === 'ADMIN' ? { ...m, is_read: true } : m))
  }, [open, view])

  // Scroll to bottom of advisor messages
  useEffect(() => {
    if (open && view === 'advisor') {
      setTimeout(() => advisorBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [messages, open, view])

  function handleOpen() {
    setOpen(true)
    setView('maya')
  }

  async function handleSendMaya() {
    if (!chatInput.trim() || chatLoading) return
    const newMessages = [...chatMessages, { role: 'user', content: chatInput.trim() }]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)
    try {
      const res = await tripChat(tripId, newMessages)
      setChatMessages(prev => [...prev, { role: 'assistant', content: res.message }])
      if (res.itinerary_updated && res.new_itinerary) {
        onItineraryUpdated(res.new_itinerary)
      }
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Sorry, something went wrong. Please try again." }])
    } finally {
      setChatLoading(false)
    }
  }

  async function handleSendAdvisor() {
    if (!advisorInput.trim() || advisorSending) return
    const body = advisorInput.trim()
    setAdvisorInput('')
    setAdvisorSending(true)
    try {
      const msg = await sendClientMessage(tripId, body)
      onMessagesUpdated([...messages, msg])
    } finally {
      setAdvisorSending(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleOpen}
        className="maya-fab"
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
          opacity: hidden ? 0 : 1, pointerEvents: hidden ? 'none' : 'auto',
        }}
      >
        <Sparkles size={16} />
        Ask Maya
        {unreadCount > 0 && (
          <span style={{
            background: 'white', color: 'var(--color-primary)',
            borderRadius: '100px', fontSize: 11, fontWeight: 800,
            padding: '1px 7px', marginLeft: 2,
          }}>{unreadCount}</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 90, right: 28, zIndex: 1001,
          width: 360, background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.2s ease',
        }}>
          {/* Header — always white */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '13px 14px',
            borderBottom: '1.5px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}>
            {view === 'advisor' ? (
              <button onClick={() => setView('maya')} className="maya-icon-btn">
                <ChevronLeft size={18} />
              </button>
            ) : (
              <MayaAvatar />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)', lineHeight: 1.2 }}>
                {view === 'maya' ? 'Maya' : 'Your Travel Advisor'}
              </div>
              {view === 'maya' && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>AI travel consultant</div>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="maya-icon-btn">
              <X size={18} />
            </button>
          </div>

          {/* Maya chat view */}
          {view === 'maya' && (
            <>
              <div style={{
                flex: 1, overflowY: 'auto', padding: '14px',
                display: 'flex', flexDirection: 'column', gap: 10,
                height: 360, background: 'var(--color-bg)',
              }}>
                {/* Greeting bubble */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <MayaAvatar />
                  <div style={{
                    maxWidth: '85%', padding: '10px 13px', fontSize: 13, lineHeight: 1.65,
                    borderRadius: '4px 16px 16px 16px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-sm)',
                    minHeight: 40, color: 'var(--color-text)',
                  }}>
                    {greetingText}
                    {!greetingDone && (
                      <span style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--color-primary)', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 0.8s step-end infinite' }} />
                    )}
                  </div>
                </div>

                {/* Suggested prompts */}
                {greetingDone && chatMessages.length === 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 38 }}>
                    {SUGGESTED_PROMPTS.map(prompt => (
                      <button
                        key={prompt}
                        onClick={() => setChatInput(prompt)}
                        className="maya-prompt"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Chat messages */}
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start', gap: 8 }}>
                    {msg.role === 'assistant' && <MayaAvatar />}
                    <div style={{
                      maxWidth: '80%', padding: '10px 13px', fontSize: 13, lineHeight: 1.6,
                      borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                      background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: msg.role === 'user' ? 'white' : 'var(--color-text)',
                      border: msg.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
                      boxShadow: 'var(--shadow-sm)',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MayaAvatar />
                    <div style={{
                      padding: '10px 13px', borderRadius: '4px 16px 16px 16px',
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex', gap: 5, alignItems: 'center',
                    }}>
                      {[0, 1, 2].map(n => (
                        <span key={n} style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: 'var(--color-text-muted)',
                          display: 'inline-block',
                          animation: `blink 1.2s ease-in-out ${n * 0.2}s infinite`,
                        }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Maya input */}
              <div style={{ padding: '10px 12px', borderTop: '1.5px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMaya() } }}
                  placeholder="Ask Maya to change your itinerary..."
                  disabled={chatLoading}
                  style={{
                    flex: 1, border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius)',
                    padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
                    background: 'var(--color-bg)', color: 'var(--color-text)',
                  }}
                />
                <button
                  onClick={handleSendMaya}
                  disabled={chatLoading || !chatInput.trim()}
                  style={{
                    padding: '0 13px', background: 'var(--color-primary)', color: 'white',
                    border: 'none', borderRadius: 'var(--radius)',
                    cursor: chatLoading || !chatInput.trim() ? 'default' : 'pointer',
                    opacity: chatLoading || !chatInput.trim() ? 0.45 : 1,
                    display: 'flex', alignItems: 'center',
                    transition: 'opacity 0.15s',
                  }}
                >
                  <Send size={15} />
                </button>
              </div>

              {/* Advisor escalation */}
              <div style={{ padding: '8px 14px 12px', textAlign: 'center' }}>
                <button
                  onClick={() => setView('advisor')}
                  style={{
                    background: 'transparent', border: 'none',
                    color: 'var(--color-text-muted)', fontSize: 12,
                    cursor: 'pointer', fontFamily: 'inherit',
                    textDecoration: 'underline', textDecorationColor: 'var(--color-border)',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)' }}
                >
                  Speak to your travel advisor →
                </button>
              </div>
            </>
          )}

          {/* Advisor view */}
          {view === 'advisor' && (
            <>
              <div style={{
                flex: 1, overflowY: 'auto', padding: '14px',
                display: 'flex', flexDirection: 'column', gap: 10,
                height: 380, background: 'var(--color-bg)',
              }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: '40px 20px', lineHeight: 1.6 }}>
                    No messages yet. Send a note and your travel advisor will get back to you.
                  </div>
                )}
                {messages.map(msg => {
                  const isOwn = msg.sender_type === 'CLIENT'
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '80%', padding: '9px 13px', fontSize: 13, lineHeight: 1.6,
                        borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                        background: isOwn ? 'var(--color-primary)' : 'var(--color-secondary)',
                        color: 'white', boxShadow: 'var(--shadow-sm)',
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.7, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {isOwn ? 'You' : 'Papaya'} · {formatTime(msg.created_at)}
                        </div>
                        {msg.body}
                      </div>
                    </div>
                  )
                })}
                <div ref={advisorBottomRef} />
              </div>

              {/* Advisor input */}
              <div style={{ padding: '10px 12px 12px', borderTop: '1.5px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={advisorInput}
                  onChange={e => setAdvisorInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendAdvisor() } }}
                  placeholder="Message your travel advisor..."
                  disabled={advisorSending}
                  style={{
                    flex: 1, border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius)',
                    padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
                    background: 'var(--color-bg)', color: 'var(--color-text)',
                  }}
                />
                <button
                  onClick={handleSendAdvisor}
                  disabled={advisorSending || !advisorInput.trim()}
                  style={{
                    padding: '0 13px', background: 'var(--color-secondary)', color: 'white',
                    border: 'none', borderRadius: 'var(--radius)',
                    cursor: advisorSending || !advisorInput.trim() ? 'default' : 'pointer',
                    opacity: advisorSending || !advisorInput.trim() ? 0.45 : 1,
                    display: 'flex', alignItems: 'center',
                    transition: 'opacity 0.15s',
                  }}
                >
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
