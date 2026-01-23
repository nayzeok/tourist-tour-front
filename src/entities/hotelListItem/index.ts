export interface HotelPrice {
  value: number
  currency: string
  per: 'night' | 'stay'
}

export interface HotelCoordinates {
  lat?: number
  lon?: number
}

export interface Hotel {
  id: string
  name: string
  address: string
  coordinates?: HotelCoordinates
  stars?: number
  thumbnail?: string[] | null
  amenities?: string[] // коды для иконок
  roomName?: string
  mealLabel?: string | null
  freeCancel?: boolean | string // true | "до 12.10.2025" | false
  payOnSite?: boolean
  price?: HotelPrice
  guestsNote?: string
  left?: number
  rating?: number
  reviewsCount?: number
  checkInTime?: string // "14:00"
  checkOutTime?: string // "12:00"
  timeZone?: string // "Europe/London"
  cancellationPenaltyAmount?: number | null // размер штрафа
  cancellationPenaltyDeadline?: string | null // после какого времени начисляется штраф
  cancellationPenaltyCurrency?: string // валюта штрафа
}
