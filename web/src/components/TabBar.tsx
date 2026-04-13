import { ReactNode } from 'react'

interface TabBarProps {
  children: ReactNode
  style?: React.CSSProperties
}

export function TabBar({ children, style }: TabBarProps) {
  return (
    <div
      className="papaya-tabbar"
      style={{
        display: 'flex',
        borderBottom: '1.5px solid var(--color-border)',
        overflowX: 'auto',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

interface TabProps {
  label: string
  active: boolean
  onClick: () => void
}

export function Tab({ label, active, onClick }: TabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`papaya-tab${active ? ' active' : ''}`}
    >
      {label}
    </button>
  )
}
