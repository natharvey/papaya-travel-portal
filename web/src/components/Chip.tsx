import { ReactNode } from 'react'

interface ChipProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}

export default function Chip({ children, onClick, disabled = false }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="papaya-chip"
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {children}
    </button>
  )
}
