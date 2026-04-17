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
  conversation_transcript: string
}

export interface IntakeSubmitResponse {
  email: string
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
  photo_query?: string
  tip?: string | null
  // Populated by background geocoding pass after generation
  lat?: number | null
  lng?: number | null
  place_id?: string | null
}

export interface DayPlan {
  day_number: number
  date: string
  location_base: string
  morning: DayBlock | null
  afternoon: DayBlock | null
  evening: DayBlock | null
  notes: string[]
}

export interface Destination {
  name: string
  nights: number
  country_code?: string
}

export interface AccommodationSuggestion {
  area: string
  style: string
  notes: string
}

export interface BudgetSummary {
  per_person_aud: number | null
  estimated_total_aud: number | null
  assumptions: string[]
}

export interface HeadsUp {
  category: 'visa' | 'book' | 'weather' | 'dress' | 'health' | 'money' | 'etiquette'
  title: string
  description: string
}

export type TransportMode = 'flight' | 'drive' | 'train' | 'bus' | 'ferry' | 'cruise' | 'transfer'

export interface TransportLeg {
  from: string               // matches origin_city or a destination name exactly
  to: string                 // matches origin_city or a destination name exactly
  mode: TransportMode
  duration: string           // e.g. "~24 hrs", "3.5 hrs"
  notes: string              // AI-generated tip, e.g. "Book 3+ months ahead"
  confirmed_booking?: string // populated when client adds a real booking, e.g. "QF1 · BNE→EDI · 14 Jan"
}

export interface HotelSuggestion {
  destination: string
  name: string
  area: string
  style: string
  why_suits: string
  price_per_night_aud: number | null
  booking_com_search: string
  google_maps_url: string
  // Enriched by Google Places verification at generation time
  place_id?: string | null
  photo_url?: string | null
  rating?: number | null
  address?: string | null
  website?: string | null
  lat?: number | null
  lng?: number | null
}

export interface ClientStayCreate {
  name: string
  address?: string
  check_in: string   // ISO datetime string
  check_out: string  // ISO datetime string
  confirmation_number?: string
  notes?: string
  latitude?: number
  longitude?: number
  google_place_id?: string
  website?: string
  rating?: number
  photo_reference?: string
}

export interface ItineraryJSON {
  trip_title: string
  overview: string
  destinations: Destination[]
  day_plans: DayPlan[]
  hotel_suggestions?: HotelSuggestion[]
  accommodation_suggestions?: AccommodationSuggestion[]
  transport_legs?: TransportLeg[]  // structured legs for map + timeline — optional for backward compat
  transport_notes: string[]        // human-readable notes displayed alongside map
  budget_summary: BudgetSummary
  packing_checklist: string[]
  risks_and_notes: string[]
  heads_up?: HeadsUp[]
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

export type TripStatus = 'GENERATING' | 'ACTIVE' | 'COMPLETED'

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
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export interface TripWithLatestItinerary extends Trip {
  latest_itinerary: Itinerary | null
}

export interface Stay {
  id: string
  trip_id: string
  stay_order: number
  name: string
  address: string | null
  check_in: string
  check_out: string
  confirmation_number: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  website: string | null
  google_place_id: string | null
  photo_reference: string | null
  rating: number | null
  created_at: string
}

export interface Flight {
  id: string
  trip_id: string
  leg_order: number
  flight_number: string
  airline: string
  departure_airport: string
  arrival_airport: string
  departure_time: string
  arrival_time: string
  terminal_departure: string | null
  terminal_arrival: string | null
  booking_ref: string | null
  created_at: string
}

export interface TripDetail extends Trip {
  client: ClientInfo
  intake_response: IntakeResponseData | null
  itineraries: Itinerary[]
  messages: Message[]
  flights: Flight[]
  stays: Stay[]
}

export interface AdminTripListItem extends Trip {
  client_name: string
  client_email: string
  unread_count: number
}
