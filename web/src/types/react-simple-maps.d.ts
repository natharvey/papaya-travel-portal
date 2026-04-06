declare module 'react-simple-maps' {
  import { ReactNode, CSSProperties } from 'react'

  interface ComposableMapProps {
    projection?: string
    projectionConfig?: {
      center?: [number, number]
      scale?: number
      rotate?: [number, number, number]
      parallels?: [number, number]
    }
    width?: number
    height?: number
    style?: CSSProperties
    children?: ReactNode
  }

  interface GeographiesProps {
    geography: string | object
    children: (args: { geographies: object[] }) => ReactNode
  }

  interface GeographyProps {
    geography: object
    key?: string
    fill?: string
    stroke?: string
    strokeWidth?: number
    style?: {
      default?: CSSProperties
      hover?: CSSProperties
      pressed?: CSSProperties
    }
  }

  interface MarkerProps {
    coordinates: [number, number]
    children?: ReactNode
  }

  interface LineProps {
    from: [number, number]
    to: [number, number]
    stroke?: string
    strokeWidth?: number
    strokeLinecap?: string
    strokeDasharray?: string
    fill?: string
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element
  export function Geographies(props: GeographiesProps): JSX.Element
  export function Geography(props: GeographyProps): JSX.Element
  export function Marker(props: MarkerProps): JSX.Element
  export function Line(props: LineProps): JSX.Element
  export function ZoomableGroup(props: { center?: [number, number]; zoom?: number; children?: ReactNode }): JSX.Element
  export function Graticule(props: { stroke?: string; strokeWidth?: number }): JSX.Element
  export function Sphere(props: { fill?: string; stroke?: string; strokeWidth?: number }): JSX.Element
}
