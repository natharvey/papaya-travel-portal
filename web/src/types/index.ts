export interface TokenResponse {
  access_token: string
  token_type: string
  role: string
}

export interface IntakeCreatePayload {
  client_name: string
  client_email: string
  trip_title: string
  origin_city: string
  start_date: string
  end_date: string
  budget_range: string
  pace: string
  travellers_count: number
  interests: string[]
  constraints: string
  accommodation_style: string
  must_dos: string
  must_avoid: string
  notes: string
}

export interface IntakeSubmitResponse {
  email: string
  reference_code: string
  trip_id: string
  message: string
}

export interface ClientInfo {
  id: string
  email: string
  name: string
  reference_code: string
  created_at: string
}

export interface IntakeResponseData {
  id: string
  trip_id: string
  travellers_count: number
  interests: string[]
  constraints: string
  accommodation_style: string
  must_dos: string
  must_avoid: string
  notes: string
}

// Itinerary JSON structures
export interface DayBlock {
  title: string
  details: string
  booking_needed: boolean
  est_cost_aud: number | null
}

export interface DayPlan {
  day_number: number
  date: string
  location_base: string
  morning: DayBlock
  afternoon: DayBlock
  evening: DayBlock
  notes: string[]
}

export interface Destination {
  name: string
  nights: number
}

export interface AccommodationSuggestion {
  area: string
  style: string
  notes: string
}

export interface BudgetSummary {
  estimated_total_aud: number | null
  assumptions: string[]
}

export interface ItineraryJSON {
  trip_title: string
  overview: string
  destinations: Destination[]
  day_plans: DayPlan[]
  accommodation_suggestions: AccommodationSuggestion[]
  transport_notes: string[]
  budget_summary: BudgetSummary
  packing_checklist: string[]
  risks_and_notes: string[]
}

export interface Itinerary {
  id: string
  trip_id: string
  itinerary_json: ItineraryJSON
  rendered_md: string | null
  version: number
  created_at: string
}

export interface Message {
  id: string
  trip_id: string
  sender_type: 'CLIENT' | 'ADMIN'
  body: string
  is_read: boolean
  created_at: string
}

export type TripStatus = 'INTAKE' | 'DRAFT' | 'REVIEW' | 'CONFIRMED' | 'ARCHIVED'

export interface Trip {
  id: string
  client_id: string
  title: string
  origin_city: string
  start_date: string
  end_date: string
  budget_range: string
  pace: string
  status: TripStatus
  created_at: string
  updated_at: string
}

export interface TripWithLatestItinerary extends Trip {
  latest_itinerary: Itinerary | null
}

export interface TripDetail extends Trip {
  client: ClientInfo
  intake_response: IntakeResponseData | null
  itineraries: Itinerary[]
  messages: Message[]
}

export interface AdminTripListItem extends Trip {
  client_name: string
  client_email: string
  unread_count: number
}
