import axios, { AxiosInstance, AxiosError } from 'axios'
import type {
  TokenResponse,
  IntakeCreatePayload,
  IntakeSubmitResponse,
  TripWithLatestItinerary,
  TripDetail,
  Message,
  Itinerary,
  AdminTripListItem,
  Flight,
  Stay,
} from '../types'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Token storage
const TOKEN_KEY = 'papaya_token'
const ROLE_KEY = 'papaya_role'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredRole(): string | null {
  return localStorage.getItem(ROLE_KEY)
}

export function storeToken(token: string, role: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(ROLE_KEY, role)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ROLE_KEY)
}

function createApiClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' },
  })

  instance.interceptors.request.use((config) => {
    const token = getStoredToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        // Token expired or invalid
        clearToken()
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }
  )

  return instance
}

export const api = createApiClient()

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function adminLogin(password: string): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>('/auth/admin-login', { password })
  return res.data
}

export async function requestMagicLink(email: string): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>('/auth/request-magic-link', { email })
  return res.data
}

// ─── Intake ──────────────────────────────────────────────────────────────────

export async function submitIntake(payload: IntakeCreatePayload): Promise<IntakeSubmitResponse> {
  const res = await api.post<IntakeSubmitResponse>('/intake', payload)
  return res.data
}

export async function intakeChat(
  messages: { role: string; content: string }[],
  seedData: Record<string, string | number>
): Promise<{ message: string; complete: boolean }> {
  const res = await api.post<{ message: string; complete: boolean }>('/intake/chat', {
    messages,
    seed_data: seedData,
  })
  return res.data
}

// ─── Client Portal ───────────────────────────────────────────────────────────

export async function getClientMe(): Promise<{ id: string; name: string; email: string; reference_code: string }> {
  const res = await api.get<{ id: string; name: string; email: string; reference_code: string }>('/client/me')
  return res.data
}

export async function getClientTrips(): Promise<TripWithLatestItinerary[]> {
  const res = await api.get<TripWithLatestItinerary[]>('/client/trips')
  return res.data
}

export async function getClientTrip(tripId: string): Promise<TripDetail> {
  const res = await api.get<TripDetail>(`/client/trips/${tripId}`)
  return res.data
}

export async function confirmTrip(tripId: string): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>(`/client/trips/${tripId}/confirm`)
  return res.data
}

export async function requestChanges(tripId: string, body: string): Promise<Message> {
  const res = await api.post<Message>(`/client/trips/${tripId}/request-changes`, { body })
  return res.data
}

export async function getClientMessages(tripId: string): Promise<Message[]> {
  const res = await api.get<Message[]>(`/client/trips/${tripId}/messages`)
  return res.data
}

export async function markClientMessagesRead(tripId: string): Promise<void> {
  await api.post(`/client/trips/${tripId}/messages/read`)
}

export async function sendClientMessage(tripId: string, body: string): Promise<Message> {
  const res = await api.post<Message>(`/client/trips/${tripId}/messages`, { body })
  return res.data
}

export async function editItineraryBlock(
  tripId: string,
  payload: { day_number: number; period: string; block_title: string; instruction: string }
): Promise<{ message: string; itinerary_updated: boolean; new_itinerary: import('../types').Itinerary | null }> {
  const res = await api.post(`/client/trips/${tripId}/edit-block`, payload)
  return res.data
}

export async function tripChat(
  tripId: string,
  messages: { role: string; content: string }[]
): Promise<{ message: string; itinerary_updated: boolean; new_itinerary: import('../types').Itinerary | null }> {
  const res = await api.post(`/client/trips/${tripId}/chat`, { messages })
  return res.data
}

export async function getAccommodationSuggestions(tripId: string): Promise<{ suggestions: AccommodationSuggestion[] }> {
  const res = await api.post(`/client/trips/${tripId}/accommodation-suggestions`)
  return res.data
}

export async function getFlightSuggestions(tripId: string): Promise<{ suggestions: FlightSuggestion[] }> {
  const res = await api.post(`/client/trips/${tripId}/flight-suggestions`)
  return res.data
}

export interface AccommodationSuggestion {
  destination: string
  name: string
  area: string
  style: string
  price_per_night_aud: number | null
  why_suits: string
  google_maps_url: string
  booking_com_search: string
  notes: string
}

export interface FlightSuggestion {
  route: string
  airlines: string[]
  typical_price_aud: string
  flight_time: string
  tips: string
  google_flights_url: string
  skyscanner_url: string
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export async function getAdminTrips(status?: string): Promise<AdminTripListItem[]> {
  const params = status ? { status } : {}
  const res = await api.get<AdminTripListItem[]>('/admin/trips', { params })
  return res.data
}

export async function getAdminTrip(tripId: string): Promise<TripDetail> {
  const res = await api.get<TripDetail>(`/admin/trips/${tripId}`)
  return res.data
}

export async function updateAdminTrip(
  tripId: string,
  data: { status?: string; title?: string; admin_notes?: string }
): Promise<TripDetail> {
  const res = await api.patch<TripDetail>(`/admin/trips/${tripId}`, data)
  return res.data
}

export async function generateItinerary(tripId: string): Promise<Itinerary> {
  const res = await api.post<Itinerary>(`/admin/trips/${tripId}/generate-itinerary`)
  return res.data
}

export async function regenerateItinerary(tripId: string, instructions: string): Promise<Itinerary> {
  const res = await api.post<Itinerary>(`/admin/trips/${tripId}/regenerate-itinerary`, { instructions })
  return res.data
}

export async function getAdminMessages(tripId: string): Promise<Message[]> {
  const res = await api.get<Message[]>(`/admin/trips/${tripId}/messages`)
  return res.data
}

export async function markAdminMessagesRead(tripId: string): Promise<void> {
  await api.post(`/admin/trips/${tripId}/messages/read`)
}

export async function sendAdminMessage(tripId: string, body: string): Promise<Message> {
  const res = await api.post<Message>(`/admin/trips/${tripId}/messages`, { body })
  return res.data
}

// ─── Flights (Admin) ─────────────────────────────────────────────────────────

export interface FlightPayload {
  leg_order: number
  flight_number: string
  airline: string
  departure_airport: string
  arrival_airport: string
  departure_time: string
  arrival_time: string
  terminal_departure?: string
  terminal_arrival?: string
  booking_ref?: string
}

export interface FlightLookupResult {
  flight_number: string
  airline: string
  departure_airport: string
  arrival_airport: string
  departure_time: string
  arrival_time: string
  terminal_departure: string
  terminal_arrival: string
}

export async function parseScreenshot(file: File, type: 'flight'): Promise<Record<string, string>[]>
export async function parseScreenshot(file: File, type: 'stay'): Promise<Record<string, string>>
export async function parseScreenshot(file: File, type: 'flight' | 'stay'): Promise<Record<string, string>[] | Record<string, string>> {
  const form = new FormData()
  form.append('file', file)
  form.append('type', type)
  const res = await api.post<Record<string, string>[] | Record<string, string>>('/admin/parse-screenshot', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function lookupFlight(flightNumber: string, date: string): Promise<FlightLookupResult> {
  const res = await api.get<FlightLookupResult>('/admin/flights/lookup', {
    params: { flight_number: flightNumber, date },
  })
  return res.data
}

export async function addFlight(tripId: string, payload: FlightPayload): Promise<Flight> {
  const res = await api.post<Flight>(`/admin/trips/${tripId}/flights`, payload)
  return res.data
}

export async function updateFlight(tripId: string, flightId: string, payload: FlightPayload): Promise<Flight> {
  const res = await api.patch<Flight>(`/admin/trips/${tripId}/flights/${flightId}`, payload)
  return res.data
}

export async function deleteFlight(tripId: string, flightId: string): Promise<void> {
  await api.delete(`/admin/trips/${tripId}/flights/${flightId}`)
}

// ─── Stays (Admin) ───────────────────────────────────────────────────────────

export interface StayPayload {
  stay_order: number
  name: string
  address?: string
  check_in: string
  check_out: string
  confirmation_number?: string
  notes?: string
}

export async function addStay(tripId: string, payload: StayPayload): Promise<Stay> {
  const res = await api.post<Stay>(`/admin/trips/${tripId}/stays`, payload)
  return res.data
}

export async function updateStay(tripId: string, stayId: string, payload: StayPayload): Promise<Stay> {
  const res = await api.patch<Stay>(`/admin/trips/${tripId}/stays/${stayId}`, payload)
  return res.data
}

export async function deleteStay(tripId: string, stayId: string): Promise<void> {
  await api.delete(`/admin/trips/${tripId}/stays/${stayId}`)
}

// ─── Documents ───────────────────────────────────────────────────────────────

export interface TripDocument {
  key: string
  filename: string
  size: number
  uploaded_at: string
  uploaded_by: 'admin' | 'client'
}

export async function listAdminDocuments(tripId: string): Promise<TripDocument[]> {
  const res = await api.get<TripDocument[]>(`/admin/trips/${tripId}/documents`)
  return res.data
}

export async function uploadAdminDocument(tripId: string, file: File): Promise<{ key: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post<{ key: string }>(`/admin/trips/${tripId}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function getAdminDocumentUrl(tripId: string, key: string): Promise<string> {
  const res = await api.get<{ url: string }>(`/admin/trips/${tripId}/documents/download-url`, { params: { key } })
  return res.data.url
}

export async function deleteAdminDocument(tripId: string, key: string): Promise<void> {
  await api.delete(`/admin/trips/${tripId}/documents`, { params: { key } })
}

export async function listClientDocuments(tripId: string): Promise<TripDocument[]> {
  const res = await api.get<TripDocument[]>(`/client/trips/${tripId}/documents`)
  return res.data
}

export async function uploadClientDocument(tripId: string, file: File): Promise<{ key: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post<{ key: string }>(`/client/trips/${tripId}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function getClientDocumentUrl(tripId: string, key: string): Promise<string> {
  const res = await api.get<{ url: string }>(`/client/trips/${tripId}/documents/download-url`, { params: { key } })
  return res.data.url
}

export async function deleteClientDocument(tripId: string, key: string): Promise<void> {
  await api.delete(`/client/trips/${tripId}/documents`, { params: { key } })
}

// ─── Utilities ───────────────────────────────────────────────────────────────

export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(', ')
    }
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred'
}
