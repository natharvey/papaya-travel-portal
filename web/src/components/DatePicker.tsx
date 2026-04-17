import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, parse, isValid } from 'date-fns'

interface DatePickerProps {
  value: string                    // YYYY-MM-DD, same contract as <input type="date">
  onChange: (value: string) => void
  placeholder?: string
  min?: string                     // YYYY-MM-DD
  max?: string                     // YYYY-MM-DD
  style?: React.CSSProperties
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  min,
  max,
  style,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined
  const validSelected = selected && isValid(selected) ? selected : undefined
  const displayValue = validSelected ? format(validSelected, 'd MMM yyyy') : ''

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const fromDate = min ? parse(min, 'yyyy-MM-dd', new Date()) : undefined
  const toDate   = max ? parse(max, 'yyyy-MM-dd', new Date()) : undefined

  // Build disabled matchers so out-of-range dates are visually blurred and unclickable
  const disabled: import('react-day-picker').Matcher[] = []
  if (fromDate) disabled.push({ before: fromDate })
  if (toDate)   disabled.push({ after: toDate })

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          border: `1.5px solid ${open ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 10,
          padding: '10px 14px',
          fontSize: 14,
          fontFamily: 'inherit',
          fontWeight: 400,
          background: 'var(--color-surface)',
          color: displayValue ? 'var(--color-text)' : 'var(--color-text-muted)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'border-color 0.15s',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      >
        <span>{displayValue || placeholder}</span>
        <ChevronDown
          size={15}
          style={{
            color: 'var(--color-text-muted)',
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        />
      </button>

      {/* Calendar popover */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 200,
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(45,74,90,0.14)',
            padding: '16px 16px 12px',
            minWidth: 288,
          }}
        >
          <DayPicker
            mode="single"
            selected={validSelected}
            onSelect={(date) => {
              if (date) {
                onChange(format(date, 'yyyy-MM-dd'))
                setOpen(false)
              }
            }}
            startMonth={fromDate}
            endMonth={toDate}
            defaultMonth={validSelected ?? fromDate}
            disabled={disabled.length > 0 ? disabled : undefined}
            components={{
              Chevron: ({ orientation }) =>
                orientation === 'left'
                  ? <ChevronLeft size={16} />
                  : <ChevronRight size={16} />,
            }}
            styles={{
              root: {
                fontFamily: 'inherit',
                fontSize: 13,
                width: '100%',
              },
              months: {
                width: '100%',
              },
              month: {
                width: '100%',
              },
              month_caption: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
                padding: '0 2px',
              },
              caption_label: {
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--color-text)',
                fontFamily: 'inherit',
              },
              nav: {
                display: 'flex',
                gap: 4,
              },
              button_previous: {
                background: 'transparent',
                border: '1.5px solid var(--color-border)',
                borderRadius: 8,
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                transition: 'border-color 0.15s, color 0.15s',
                fontFamily: 'inherit',
              },
              button_next: {
                background: 'transparent',
                border: '1.5px solid var(--color-border)',
                borderRadius: 8,
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                transition: 'border-color 0.15s, color 0.15s',
                fontFamily: 'inherit',
              },
              month_grid: {
                width: '100%',
                borderCollapse: 'collapse',
              },
              weekdays: {
                marginBottom: 4,
              },
              weekday: {
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                textAlign: 'center',
                padding: '0 0 6px',
                width: 36,
                fontFamily: 'inherit',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              },
              day: {
                width: 36,
                height: 36,
                textAlign: 'center',
                padding: 2,
                fontFamily: 'inherit',
              },
              day_button: {
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                fontSize: 13,
                fontWeight: 400,
                color: 'var(--color-text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.12s, color 0.12s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: 'auto',
              },
            }}
            modifiersStyles={{
              selected: {
                backgroundColor: '#F07332',
                color: 'white',
                borderRadius: 8,
                fontWeight: 700,
              },
              today: {
                color: '#F07332',
                fontWeight: 700,
              },
              outside: {
                color: '#EAE0D0',
              },
              disabled: {
                color: '#EAE0D0',
                cursor: 'default',
                opacity: 0.5,
              },
            }}
          />
        </div>
      )}
    </div>
  )
}
