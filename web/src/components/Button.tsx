import { ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  children: ReactNode
  variant?: Variant
  size?: Size
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  style?: React.CSSProperties
  className?: string
  title?: string
  as?: 'button' | 'a'
  href?: string
  target?: string
  rel?: string
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  type = 'button',
  style,
  className = '',
  title,
  as = 'button',
  href,
  target,
  rel,
}: ButtonProps) {
  const classes = `btn btn-${variant} btn-${size} ${className}`.trim()

  if (as === 'a') {
    return (
      <a href={href} target={target} rel={rel} className={classes} style={style} title={title}>
        {children}
      </a>
    )
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
      style={style}
      title={title}
    >
      {children}
    </button>
  )
}
