import { lazy, Suspense } from 'react'
import { Download } from 'lucide-react'
import type { ItineraryJSON } from '../types'

// Lazy-load the heavy @react-pdf/renderer bundle
const LazyPDFLink = lazy(() =>
  Promise.all([
    import('@react-pdf/renderer'),
    import('./ItineraryPDF'),
  ]).then(([{ PDFDownloadLink }, { default: ItineraryPDF }]) => ({
    default: function PDFLink({ data, tripTitle, clientName, startDate, endDate, originCity, fileName }: {
      data: ItineraryJSON
      tripTitle: string
      clientName: string
      startDate: string
      endDate: string
      originCity: string
      fileName: string
    }) {
      return (
        <PDFDownloadLink
          document={
            <ItineraryPDF
              data={data}
              tripTitle={tripTitle}
              clientName={clientName}
              startDate={startDate}
              endDate={endDate}
              originCity={originCity}
            />
          }
          fileName={fileName}
          style={{ textDecoration: 'none' }}
        >
          {({ loading }) => (
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: loading ? 'var(--color-border)' : 'var(--color-secondary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius)',
                padding: '7px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: loading ? 'default' : 'pointer',
              }}
            >
              <Download size={13} strokeWidth={2} />
              {loading ? 'Preparing PDF...' : 'Download PDF'}
            </button>
          )}
        </PDFDownloadLink>
      )
    },
  }))
)

interface Props {
  data: ItineraryJSON
  tripTitle: string
  clientName: string
  startDate: string
  endDate: string
  originCity: string
}

export default function PDFDownloadButton(props: Props) {
  const fileName = `${props.tripTitle.replace(/\s+/g, '-').toLowerCase()}-itinerary.pdf`
  return (
    <Suspense fallback={
      <button
        disabled
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--color-border)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius)',
          padding: '7px 14px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'default',
        }}
      >
        <Download size={13} strokeWidth={2} />
        Download PDF
      </button>
    }>
      <LazyPDFLink {...props} fileName={fileName} />
    </Suspense>
  )
}
