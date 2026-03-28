import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// Register fonts — using built-in Helvetica for reliability
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#2D3A4A',
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
  },

  // Header
  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 3,
    borderBottomColor: '#F97316',
  },
  brand: {
    fontSize: 11,
    color: '#F97316',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  tripTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#2D3A4A',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  metaItem: {
    fontSize: 9,
    color: '#64748B',
  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#F97316',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#FED7AA',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Overview
  overviewText: {
    fontSize: 10,
    lineHeight: 1.6,
    color: '#374151',
  },

  // Destinations
  destinationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  destinationName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  destinationNights: {
    fontSize: 10,
    color: '#64748B',
  },

  // Day plan
  dayCard: {
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F97316',
    paddingLeft: 10,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  dayTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: '#2D3A4A',
  },
  dayLocation: {
    fontSize: 9,
    color: '#64748B',
  },
  periodRow: {
    marginBottom: 4,
  },
  periodLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#F97316',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  periodTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1E293B',
  },
  periodDetails: {
    fontSize: 9,
    color: '#475569',
    lineHeight: 1.5,
  },
  periodMeta: {
    fontSize: 8,
    color: '#94A3B8',
    marginTop: 1,
  },
  noteText: {
    fontSize: 9,
    color: '#78716C',
    fontStyle: 'italic',
    marginTop: 3,
  },

  // Lists
  listItem: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  bullet: {
    width: 12,
    fontSize: 10,
    color: '#F97316',
  },
  listText: {
    flex: 1,
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.5,
  },

  // Budget
  budgetTotal: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#2D3A4A',
    marginBottom: 6,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: '#94A3B8',
  },
})

interface TimeBlock {
  title: string
  details: string
  booking_needed: boolean
  est_cost_aud: number | null
}

interface DayPlan {
  day_number: number
  date: string
  location_base: string
  morning: TimeBlock
  afternoon: TimeBlock
  evening: TimeBlock
  notes: string[]
}

interface ItineraryData {
  trip_title: string
  overview: string
  destinations: { name: string; nights: number }[]
  day_plans: DayPlan[]
  accommodation_suggestions: { area: string; style: string; notes: string }[]
  transport_notes: string[]
  budget_summary: { estimated_total_aud: number | null; assumptions: string[] }
  packing_checklist: string[]
  risks_and_notes: string[]
}

interface Props {
  data: ItineraryData
  tripTitle: string
  clientName: string
  startDate: string
  endDate: string
  originCity: string
}

function TimeBlockView({ period, block }: { period: string; block: TimeBlock }) {
  return (
    <View style={styles.periodRow}>
      <Text style={styles.periodLabel}>{period}</Text>
      <Text style={styles.periodTitle}>{block.title}</Text>
      <Text style={styles.periodDetails}>{block.details}</Text>
      {(block.booking_needed || block.est_cost_aud) && (
        <Text style={styles.periodMeta}>
          {block.booking_needed ? 'Booking required  ' : ''}
          {block.est_cost_aud ? `~$${block.est_cost_aud.toLocaleString()} AUD` : ''}
        </Text>
      )}
    </View>
  )
}

export default function ItineraryPDF({ data, tripTitle, clientName, startDate, endDate, originCity }: Props) {
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

  const tripDays = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>Papaya Travel</Text>
          <Text style={styles.tripTitle}>{data.trip_title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>Prepared for {clientName}</Text>
            <Text style={styles.metaItem}>·</Text>
            <Text style={styles.metaItem}>From {originCity}</Text>
            <Text style={styles.metaItem}>·</Text>
            <Text style={styles.metaItem}>{formatDate(startDate)} — {formatDate(endDate)}</Text>
            <Text style={styles.metaItem}>·</Text>
            <Text style={styles.metaItem}>{tripDays} days</Text>
          </View>
        </View>

        {/* Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.overviewText}>{data.overview}</Text>
        </View>

        {/* Destinations */}
        {data.destinations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Destinations</Text>
            {data.destinations.map((d, i) => (
              <View key={i} style={styles.destinationRow}>
                <Text style={styles.destinationName}>{d.name}</Text>
                <Text style={styles.destinationNights}>{d.nights} night{d.nights !== 1 ? 's' : ''}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer on every page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Papaya Travel · {data.trip_title}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* Day plans — each day on its own section, paginated */}
      <Page size="A4" style={styles.page}>
        <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>Day-by-Day Itinerary</Text>
        {data.day_plans.map((day) => (
          <View key={day.day_number} style={styles.dayCard} wrap={false}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>Day {day.day_number} — {day.date}</Text>
              <Text style={styles.dayLocation}>{day.location_base}</Text>
            </View>
            <TimeBlockView period="Morning" block={day.morning} />
            <TimeBlockView period="Afternoon" block={day.afternoon} />
            <TimeBlockView period="Evening" block={day.evening} />
            {day.notes.map((note, i) => (
              <Text key={i} style={styles.noteText}>• {note}</Text>
            ))}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Papaya Travel · {data.trip_title}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* Practical info */}
      <Page size="A4" style={styles.page}>
        {/* Accommodation */}
        {data.accommodation_suggestions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Accommodation Suggestions</Text>
            {data.accommodation_suggestions.map((a, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.bullet}>·</Text>
                <Text style={styles.listText}>
                  <Text style={{ fontFamily: 'Helvetica-Bold' }}>{a.area}</Text> ({a.style}): {a.notes}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Transport */}
        {data.transport_notes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transport Notes</Text>
            {data.transport_notes.map((t, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.bullet}>·</Text>
                <Text style={styles.listText}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Budget */}
        {data.budget_summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Budget Summary</Text>
            {data.budget_summary.estimated_total_aud && (
              <Text style={styles.budgetTotal}>
                Estimated Total: ${data.budget_summary.estimated_total_aud.toLocaleString()} AUD
              </Text>
            )}
            {data.budget_summary.assumptions.map((a, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.bullet}>·</Text>
                <Text style={styles.listText}>{a}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Packing */}
        {data.packing_checklist.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Packing Checklist</Text>
            {data.packing_checklist.map((item, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.bullet}>☐</Text>
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Risks */}
        {data.risks_and_notes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Important Notes</Text>
            {data.risks_and_notes.map((r, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.bullet}>·</Text>
                <Text style={styles.listText}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Papaya Travel · {data.trip_title}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
