import { ReactNode, CSSProperties } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'active' | 'muted'

const STYLES: Record<BadgeVariant, CSSProperties> = {
  default: { background: 'var(--color-accent)',  color: 'var(--color-primary-dark)' },
  success: { background: '#EBF7F1',              color: 'var(--color-success)' },
  warning: { background: '#FEF7E6',              color: 'var(--color-warning)' },
  error:   { background: '#FDECEA',              color: 'var(--color-error)' },
  active:  { background: 'var(--color-secondary)', color: 'white' },
  muted:   { background: '#F1EEE8',              color: 'var(--color-text-muted)' },
}

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  style?: CSSProperties
}

export default function Badge({ children, variant = 'default', style }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 10px',
        borderRadius: 20,
        whiteSpace: 'nowrap',
        ...STYLES[variant],
        ...style,
      }}
    >
      {children}
    </span>
  )
}
