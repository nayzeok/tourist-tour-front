import { apiFetch } from './http'

/**
 * Отмена бронирования по номеру.
 * Тело запроса опционально (причина, ожидаемая сумма штрафа).
 */
export function cancelBooking(
  bookingNumber: string,
  body?: { reason?: string; expectedPenaltyAmount?: number }
) {
  return apiFetch<{ booking?: { number: string; status?: string } }>(
    `/reservation/bookings/${encodeURIComponent(bookingNumber)}/cancel`,
    {
      method: 'POST',
      body: body ?? {},
    }
  )
}
