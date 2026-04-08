import logoSrc from '../assets/travel-papaya-logo.png'
import markSrc from '../assets/papaya-mark.png'

interface PapayaLogoProps {
  size?: number
  markOnly?: boolean
}

export default function PapayaLogo({ size = 40, markOnly = false }: PapayaLogoProps) {
  return (
    <img
      src={markOnly ? markSrc : logoSrc}
      alt="Travel Papaya"
      height={size}
      style={{ display: 'block', objectFit: 'contain' }}
    />
  )
}
