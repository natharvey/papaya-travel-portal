import logoSrc from '../assets/papaya-logo.png'

interface PapayaLogoProps {
  size?: number
}

export default function PapayaLogo({ size = 32 }: PapayaLogoProps) {
  return (
    <img
      src={logoSrc}
      alt="Papaya"
      width={size}
      height={size}
      style={{
        display: 'block',
        objectFit: 'contain',
      }}
    />
  )
}
