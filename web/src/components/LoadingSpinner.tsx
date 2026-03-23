interface LoadingSpinnerProps {
  size?: number
  color?: string
  label?: string
}

export default function LoadingSpinner({
  size = 32,
  color = 'var(--color-primary)',
  label = 'Loading...',
}: LoadingSpinnerProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '32px',
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          border: `3px solid var(--color-border)`,
          borderTopColor: color,
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      {label && (
        <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>{label}</span>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
