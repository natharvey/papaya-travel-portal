import { useState, useRef, useEffect } from 'react'
import type { Message } from '../types'

interface MessageThreadProps {
  messages: Message[]
  currentRole: 'CLIENT' | 'ADMIN'
  onSend: (body: string) => Promise<void>
  loading?: boolean
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

export default function MessageThread({ messages, currentRole, onSend, loading }: MessageThreadProps) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    setSendError('')
    try {
      await onSend(body.trim())
      setBody('')
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '500px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px', padding: '40px' }}>
            Loading messages...
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px', padding: '40px' }}>
            No messages yet. Start the conversation!
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.sender_type === currentRole
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: isOwn ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{
                maxWidth: '70%',
                background: isOwn ? 'var(--color-primary)' : 'var(--color-secondary)',
                color: 'white',
                padding: '10px 14px',
                borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {msg.sender_type === 'ADMIN' ? 'Papaya Team' : 'You'}
                  </span>
                  <span style={{ fontSize: '10px', opacity: 0.7, whiteSpace: 'nowrap' }}>
                    {formatTime(msg.created_at)}
                  </span>
                </div>
                <p style={{ fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {msg.body}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Send form */}
      <form
        onSubmit={handleSubmit}
        style={{
          borderTop: '1px solid var(--color-border)',
          background: 'white',
          padding: '12px 16px',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ flex: 1 }}>
          {sendError && (
            <div style={{ color: 'var(--color-error)', fontSize: '12px', marginBottom: '6px' }}>
              {sendError}
            </div>
          )}
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e as unknown as React.FormEvent)
              }
            }}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            rows={2}
            style={{
              width: '100%',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: '10px 12px',
              fontSize: '14px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
            }}
            disabled={sending}
          />
        </div>
        <button
          type="submit"
          disabled={sending || !body.trim()}
          style={{
            background: body.trim() ? 'var(--color-primary)' : 'var(--color-border)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius)',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: body.trim() ? 'pointer' : 'default',
            transition: 'background 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          {sending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  )
}
