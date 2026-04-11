import logoSrc from '../assets/travel-papaya-logo.png'
import markSrc from '../assets/papaya-mark.png'

interface PapayaLogoProps {
  size?: number
  markOnly?: boolean
  light?: boolean
}

export default function PapayaLogo({ size = 40, markOnly = false, light = false }: PapayaLogoProps) {
  return (
    <img
      src={markOnly ? markSrc : logoSrc}
      alt="Travel Papaya"
      height={size}
      style={{ display: 'block', objectFit: 'contain', filter: light ? 'brightness(0) invert(1)' : 'none' }}
    />
  )
}
