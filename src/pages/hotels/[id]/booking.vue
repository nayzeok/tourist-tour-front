<script setup lang="ts">
import type { FetchError } from 'ofetch'
import type { RoomOffer } from '~/src/entities/offer/Offer.vue'
import { useAuthStore, useCitiesStore } from '~/src/shared/store'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const router = useRouter()
const runtimeConfig = useRuntimeConfig()
const toast = useToast()
const authStore = useAuthStore()
const citiesStore = useCitiesStore()

await authStore.ensureStatus()
await citiesStore.getCities()

// Получаем параметры из query
const propertyId = computed(() => route.params.id as string)
const ratePlanId = computed(() => route.query.ratePlanId as string | undefined)
const roomTypeId = computed(() => route.query.roomTypeId as string | undefined)
const dates = computed(() => route.query.dates as string | undefined)
const adultCount = computed(() => {
  const raw = Number(route.query.adultCount)
  return Number.isFinite(raw) && raw > 0 ? raw : 1
})
const childAges = computed(() => {
  const raw = route.query.childAges
  if (!raw || typeof raw !== 'string') {
    return [] as number[]
  }
  return raw
    .split(',')
    .map((age) => Number(age))
    .filter((age) => Number.isFinite(age) && age >= 0)
})

const guestsCount = computed(() => ({
  adultCount: adultCount.value,
  ...(childAges.value.length ? { childAges: childAges.value } : {}),
}))

function parseDateSegment(date?: string | null) {
  if (!date) {
    return null
  }
  const [day, month, year] = date.split('.')
  if (!day || !month || !year) {
    return null
  }
  return `${year}-${month}-${day}`
}

const stayDates = computed(() => {
  if (!dates.value) {
    return null
  }
  const [arrivalRaw, departureRaw] = dates.value.split('-')
  const arrival = parseDateSegment(arrivalRaw)
  const departure = parseDateSegment(departureRaw)
  if (!arrival || !departure) {
    return null
  }
  return { arrival, departure }
})

// Загружаем данные отеля и предложения
const {
  data: hotel,
  status,
  error: hotelError,
} = await useAsyncData<any>(`hotel-${propertyId.value}`, async () => {
  if (!dates.value) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Отсутствуют даты для бронирования',
    })
  }

  const params = new URLSearchParams({
    cityId: route.query.cityId as string || '',
    dates: dates.value,
    ...(adultCount.value && { adultCount: String(adultCount.value) }),
    ...(childAges.value.length && { childAges: childAges.value.join(',') }),
  })

  return $fetch(
    `${runtimeConfig.public.apiUrl}/offer/${propertyId.value}?${params.toString()}`
  )
})

// Находим нужное предложение
const offer = computed<RoomOffer | null>(() => {
  if (!hotel.value?.offers || !ratePlanId.value) {
    return null
  }

  return hotel.value.offers.find(
    (o: RoomOffer) => o.ratePlanId === ratePlanId.value
  ) || null
})

// Проверяем наличие предложения после загрузки
watch([hotel, ratePlanId], () => {
  if (status.value === 'success' && hotel.value && ratePlanId.value && !offer.value) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Предложение не найдено',
    })
  }
})

const cityName = computed(() => {
  const cityId = route.query.cityId as string
  return citiesStore.currentCity(cityId)?.name || ''
})

const form = reactive({
  guestLastName: '',
  guestFirstName: '',
  payerLastName: '',
  payerFirstName: '',
  payerEmail: '',
  payerPhone: '',
  shareWithHotel: true,
  arrivalTime: 'Неизвестно',
  specialRequests: '',
})

const bookingResult = ref<any | null>(null)
const bookingError = ref<string | null>(null)
const submitting = ref(false)
const paymentMethod = ref<'card' | 'sbp'>('card')
const promoCode = ref('')
const promoCodeExpanded = ref(false)
const specialRequestsExpanded = ref(false)
const consentPersonalData = ref(false)
const consentMarketing = ref(false)

const requiredFieldsMissing = computed(() => {
  return (
    !form.guestLastName.trim() ||
    !form.guestFirstName.trim() ||
    !form.payerLastName.trim() ||
    !form.payerFirstName.trim() ||
    !form.payerEmail.trim() ||
    !form.payerPhone.trim() ||
    !consentPersonalData.value
  )
})

function formatDisplayDate(date: string) {
  const [year, month, day] = date.split('-')
  if (!year || !month || !day) {
    return date
  }
  return `${day}.${month}.${year}`
}

function formatDateForHeader(date: string) {
  const [year, month, day] = date.split('-')
  if (!year || !month || !day) {
    return date
  }
  const monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
  const monthIndex = parseInt(month) - 1
  return `${day} ${monthNames[monthIndex]}`
}

const headerDates = computed(() => {
  if (!stayDates.value) {
    return ''
  }
  return `${formatDateForHeader(stayDates.value.arrival)}-${formatDateForHeader(stayDates.value.departure)}`
})

const guestsLabel = computed(() => {
  const adults = guestsCount.value.adultCount
  const children = guestsCount.value.childAges?.length ?? 0
  if (adults === 1 && children === 0) {
    return '1 гость'
  }
  return `${adults} ${children > 0 ? `+ ${children}` : ''} гост${adults === 1 ? 'ь' : 'ей'}`
})

const nightsCount = computed(() => {
  if (!stayDates.value) {
    return null
  }
  const arrival = new Date(stayDates.value.arrival)
  const departure = new Date(stayDates.value.departure)
  const diff = Math.round(
    (departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)
  )
  return diff > 0 ? diff : null
})

const checkInTime = computed(() => {
  if (!stayDates.value) {
    return ''
  }
  const date = new Date(stayDates.value.arrival)
  const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
  const dayName = days[date.getDay()]
  return `${formatDisplayDate(stayDates.value.arrival)}, ${dayName} c 15:00`
})

const checkOutTime = computed(() => {
  if (!stayDates.value) {
    return ''
  }
  const date = new Date(stayDates.value.departure)
  const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
  const dayName = days[date.getDay()]
  return `${formatDisplayDate(stayDates.value.departure)}, ${dayName} до 12:00`
})

const roomDescription = computed(() => {
  if (!offer.value) {
    return ''
  }
  // Можно добавить более детальное описание из API
  return 'Стандартный номер с двумя раздельными кроватями, низкий этаж'
})

const freeCancelDate = computed(() => {
  if (!stayDates.value || !offer.value?.freeCancel) {
    return null
  }
  const arrival = new Date(stayDates.value.arrival)
  arrival.setDate(arrival.getDate() - 1)
  return formatDisplayDate(arrival.toISOString().split('T')[0])
})

function resolveErrorMessage(error: unknown) {
  const fallback = 'Не удалось создать бронирование. Попробуйте ещё раз.'

  if (error && typeof error === 'object') {
    const fetchError = error as FetchError<any>
    const data = fetchError?.data as any

    if (typeof data === 'string' && data) {
      return data
    }

    if (data?.message) {
      return data.message
    }

    if (Array.isArray(data?.errors) && data.errors[0]?.message) {
      return data.errors[0].message
    }

    if ('message' in error && fetchError.message) {
      return fetchError.message
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

function goBack() {
  router.push({
    path: `/hotels/${propertyId.value}`,
    query: { ...route.query },
  })
}

async function submitBooking() {
  if (!offer.value || !propertyId.value || !stayDates.value) {
    bookingError.value =
      'Отсутствуют обязательные данные для бронирования. Обновите страницу и попробуйте снова.'
    return
  }

  if (requiredFieldsMissing.value) {
    bookingError.value = 'Заполните все обязательные поля и дайте согласие на обработку персональных данных.'
    return
  }

  submitting.value = true
  bookingError.value = null

  const payload = {
    propertyId: propertyId.value,
    roomStay: offer.value,
    arrival: stayDates.value.arrival,
    departure: stayDates.value.departure,
    guestsCount: {
      adultCount: guestsCount.value.adultCount,
      ...(guestsCount.value.childAges?.length
        ? { childAges: guestsCount.value.childAges }
        : {}),
    },
    customer: {
      firstName: form.payerFirstName.trim(),
      lastName: form.payerLastName.trim(),
      phone: form.payerPhone.trim(),
      email: form.payerEmail.trim(),
      ...(form.specialRequests.trim() ? { comment: form.specialRequests.trim() } : {}),
    },
    guests: [
      {
        firstName: form.guestFirstName.trim(),
        lastName: form.guestLastName.trim(),
      },
    ],
  }

  try {
    const result = await $fetch(
      `${runtimeConfig.public.apiUrl}/reservation/quick-book`,
      {
        method: 'POST',
        body: payload,
      }
    )

    bookingResult.value = result
    toast.add({
      id: 'booking-success',
      title: 'Бронирование создано',
      description: result?.created?.booking?.number
        ? `Номер брони ${result.created.booking.number}`
        : 'Запрос успешно отправлен в отель',
      color: 'success',
    })
  } catch (error) {
    const message = resolveErrorMessage(error)
    bookingError.value = message
    toast.add({
      id: 'booking-error',
      title: 'Не удалось забронировать',
      description: message,
      color: 'error',
    })
  } finally {
    submitting.value = false
  }
}

// Проверяем наличие обязательных данных
if (!ratePlanId.value || !dates.value) {
  throw createError({
    statusCode: 400,
    statusMessage: 'Отсутствуют обязательные параметры для бронирования',
  })
}

// Проверяем ошибку загрузки отеля
if (hotelError.value) {
  throw createError({
    statusCode: 500,
    statusMessage: 'Не удалось загрузить данные отеля',
  })
}
</script>

<template>
  <div class="container pt-4 pb-8">
    <div v-if="status === 'pending'" class="flex items-center justify-center min-h-[400px]">
      <div class="flex flex-col items-center gap-4">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary" />
        <p class="text-gray-600">Загрузка данных...</p>
      </div>
    </div>

    <div v-else class="grid lg:grid-cols-[1fr_400px] gap-6">
      <!-- Левая колонка -->
      <div class="flex flex-col gap-6">
        <!-- Хедер с городом, датами и гостями -->
        <div class="flex items-center justify-between bg-white rounded-2xl p-4">
          <div class="flex items-center gap-4">
            <div class="font-semibold">{{ cityName }}</div>
            <div class="text-gray-600">{{ headerDates }}</div>
            <div class="text-gray-600">{{ guestsLabel }}</div>
          </div>
          <UButton
            icon="i-lucide-arrow-up"
            size="xs"
            variant="ghost"
            @click="goBack"
          />
        </div>

        <!-- Информация об отеле -->
        <div class="bg-white rounded-2xl p-4 relative overflow-hidden">
          <div class="flex gap-4">
            <div class="flex-1">
              <div class="flex gap-1 mb-2">
                <UIcon
                  v-for="i in hotel?.property?.stars || 0"
                  :key="i"
                  class="w-4 h-4 text-yellow-500"
                  name="i-heroicons-star-solid"
                />
              </div>
              <h1 class="text-xl font-semibold mb-2">
                {{ hotel?.property?.name }}
              </h1>
              <p class="text-sm text-gray-600 mb-4">
                {{ hotel?.property?.address }}
              </p>
              <div class="flex flex-col gap-1 text-sm text-gray-600">
                <span>{{ checkInTime }}</span>
                <span>{{ checkOutTime }}</span>
              </div>
            </div>
            <div v-if="offer?.images?.[0]" class="flex-shrink-0">
              <div class="relative">
                <img
                  :src="offer.images[0]"
                  :alt="offer.roomTypeName"
                  class="w-24 h-24 object-cover rounded-lg"
                >
                <span v-if="offer.images.length > 1" class="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {{ offer.images.length }} фото
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Детали номера -->
        <div class="bg-white rounded-2xl p-4">
          <p class="text-sm text-gray-600 mb-2">
            1 номер для {{ adultCount }} взросл{{ adultCount === 1 ? 'ого' : 'ых' }} на {{ nightsCount }} {{ nightsCount === 1 ? 'ночь' : nightsCount < 5 ? 'ночи' : 'ночей' }}
          </p>
          <p class="text-sm text-gray-700 mb-2">
            {{ roomDescription }}
          </p>
          <button class="text-sm text-primary hover:underline">
            Подробнее о номере
          </button>
        </div>

        <!-- Политики бронирования -->
        <div class="bg-white rounded-2xl p-4">
          <div class="flex items-center gap-2 text-sm text-gray-700 mb-2">
            <UIcon name="i-lucide-utensils-crossed" class="w-4 h-4" />
            <span>Питание не включено</span>
          </div>
          <div v-if="freeCancelDate" class="flex items-center gap-2 text-sm text-green-700 mb-2">
            <UIcon name="i-lucide-info" class="w-4 h-4" />
            <span>Бесплатная отмена до {{ freeCancelDate }} 11:59</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-gray-700">
            <UIcon name="i-lucide-credit-card" class="w-4 h-4" />
            <span>Оплата онлайн</span>
          </div>
        </div>

        <!-- Информация о госте -->
        <div class="bg-white rounded-2xl p-4">
          <h2 class="font-semibold mb-1">Гость</h2>
          <p class="text-sm text-gray-600 mb-4">Взрослый, старше 18 лет</p>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium text-gray-700 mb-1 block">Фамилия</label>
              <UInput v-model="form.guestLastName" placeholder="Иванов" />
            </div>
            <div>
              <label class="text-sm font-medium text-gray-700 mb-1 block">Имя</label>
              <UInput v-model="form.guestFirstName" placeholder="Иван" />
            </div>
          </div>
          <UButton class="mt-4" variant="outline" color="primary">
            Выбрать
          </UButton>
        </div>

        <!-- Информация о покупателе -->
        <div class="bg-white rounded-2xl p-4">
          <h2 class="font-semibold mb-1">Покупатель</h2>
          <p class="text-sm text-gray-600 mb-4">
            Отправим подтверждение брони, свяжемся в случае проблем
          </p>
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label class="text-sm font-medium text-gray-700 mb-1 block">Фамилия</label>
              <UInput v-model="form.payerLastName" placeholder="Иванов" />
            </div>
            <div>
              <label class="text-sm font-medium text-gray-700 mb-1 block">Имя</label>
              <UInput v-model="form.payerFirstName" placeholder="Иван" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label class="text-sm font-medium text-gray-700 mb-1 block">Электронная почта</label>
              <UInput v-model="form.payerEmail" type="email" placeholder="user@example.com" />
            </div>
            <div>
              <label class="text-sm font-medium text-gray-700 mb-1 block">Телефон</label>
              <UInput v-model="form.payerPhone" type="tel" placeholder="+7 (999) 123-45-67" />
            </div>
          </div>
          <UCheckbox v-model="form.shareWithHotel" label="Передать в отель для связи" />
        </div>

        <!-- Информация о заезде -->
        <div class="bg-white rounded-2xl p-4">
          <h2 class="font-semibold mb-4">Информация о заезде</h2>
          <div class="mb-4">
            <label class="text-sm font-medium text-gray-700 mb-1 block">Время заезда</label>
            <USelect
              v-model="form.arrivalTime"
              :options="['Неизвестно', '14:00', '15:00', '16:00', '17:00', '18:00']"
            />
          </div>
          <p class="text-sm text-gray-600 mb-4">
            Ваш номер будет готов к 15:00
          </p>
          <div>
            <button
              class="flex items-center justify-between w-full text-sm font-medium text-gray-700"
              @click="specialRequestsExpanded = !specialRequestsExpanded"
            >
              <span>Особые пожелания</span>
              <UIcon
                :name="specialRequestsExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="w-4 h-4"
              />
            </button>
            <div v-if="specialRequestsExpanded" class="mt-4">
              <UTextarea
                v-model="form.specialRequests"
                placeholder="На языке страны отеля или английском"
                :rows="4"
                :maxlength="500"
              />
              <p class="text-xs text-gray-500 mt-2">
                Выполнение пожеланий не гарантируется и остаётся на усмотрение отеля
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Правая колонка -->
      <div class="flex flex-col gap-6">
        <!-- Вход в аккаунт -->
        <div v-if="!authStore.isAuthenticated" class="bg-white rounded-2xl p-4">
          <NuxtLink
            to="/login"
            class="flex items-center justify-between text-sm font-medium text-gray-700 hover:text-primary"
          >
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-user" class="w-4 h-4" />
              <span>Войдите в аккаунт</span>
            </div>
            <UIcon name="i-lucide-chevron-right" class="w-4 h-4" />
          </NuxtLink>
        </div>

        <!-- Способ оплаты -->
        <div class="bg-white rounded-2xl p-4">
          <h2 class="font-semibold mb-4">Способ оплаты</h2>
          <div class="grid grid-cols-2 gap-4">
            <button
              class="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors"
              :class="paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'border-gray-200'"
              @click="paymentMethod = 'card'"
            >
              <UIcon name="i-lucide-credit-card" class="w-6 h-6" />
              <span class="text-sm font-medium">Банковская карта</span>
              <UIcon
                v-if="paymentMethod === 'card'"
                name="i-lucide-check"
                class="w-5 h-5 text-primary"
              />
            </button>
            <button
              class="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors"
              :class="paymentMethod === 'sbp' ? 'border-primary bg-primary/5' : 'border-gray-200'"
              @click="paymentMethod = 'sbp'"
            >
              <UIcon name="i-lucide-smartphone" class="w-6 h-6" />
              <span class="text-sm font-medium">СБП</span>
              <UIcon
                v-if="paymentMethod === 'sbp'"
                name="i-lucide-check"
                class="w-5 h-5 text-primary"
              />
            </button>
          </div>
        </div>

        <!-- Промокод -->
        <div class="bg-white rounded-2xl p-4">
          <button
            class="flex items-center justify-between w-full text-sm font-medium text-gray-700 mb-4"
            @click="promoCodeExpanded = !promoCodeExpanded"
          >
            <span>Промокод, сертификат</span>
            <UIcon
              :name="promoCodeExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              class="w-4 h-4"
            />
          </button>
          <div v-if="promoCodeExpanded" class="flex gap-2">
            <UInput v-model="promoCode" placeholder="Введите промокод" />
            <UButton color="primary">Применить</UButton>
          </div>
        </div>

        <!-- Итоговая сумма -->
        <div class="bg-white rounded-2xl p-4 sticky top-4">
          <div class="flex items-center justify-between mb-2">
            <div>
              <div class="text-2xl font-bold">
                {{ offer?.price?.total?.toLocaleString('ru-RU') || '0' }} ₽
              </div>
              <div class="text-sm text-gray-600">
                {{ guestsLabel }}, {{ nightsCount }} {{ nightsCount === 1 ? 'ночь' : nightsCount < 5 ? 'ночи' : 'ночей' }}
              </div>
            </div>
            <UIcon name="i-lucide-chevron-up" class="w-4 h-4 text-gray-400" />
          </div>
          <USeparator class="my-4" />
          <div class="flex justify-between text-sm mb-4">
            <span>Проживание</span>
            <span class="font-medium">{{ offer?.price?.total?.toLocaleString('ru-RU') || '0' }} ₽</span>
          </div>

          <!-- Чекбоксы согласия -->
          <div class="space-y-3 mb-4">
            <UCheckbox v-model="consentPersonalData">
              <template #label>
                <span class="text-sm">
                  Даю согласие на обработку
                  <NuxtLink to="/oferta" class="text-primary hover:underline">персональных данных</NuxtLink>
                </span>
              </template>
            </UCheckbox>
            <UCheckbox v-model="consentMarketing">
              <template #label>
                <span class="text-sm">
                  Даю согласие на получение информации об интересных местах, рекламы и выгодных предложений
                </span>
              </template>
            </UCheckbox>
          </div>

          <!-- Кнопка оплаты -->
          <UButton
            block
            size="lg"
            :disabled="requiredFieldsMissing"
            :loading="submitting"
            @click="submitBooking"
          >
            Оплатить
          </UButton>

          <p class="text-xs text-gray-500 text-center mt-4">
            Нажимая «Оплатить», вы соглашаетесь с
            <NuxtLink to="/oferta" class="text-primary hover:underline">публичной офертой</NuxtLink>
          </p>

          <div v-if="bookingError" class="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {{ bookingError }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
