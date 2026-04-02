export interface WeatherData {
  isRainy: boolean
  isNight: boolean
}

export async function getWeather(): Promise<WeatherData> {
  const lat = process.env.WEATHER_LAT ?? '51.5074'
  const lon = process.env.WEATHER_LON ?? '-0.1278'

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weathercode,is_day`,
      { next: { revalidate: 900 } }
    )

    if (!res.ok) return { isRainy: false, isNight: false }

    const data = await res.json()
    const weathercode: number = data.current?.weathercode ?? 0
    const is_day: number      = data.current?.is_day      ?? 1

    // WMO codes ≥ 45: fog, drizzle, rain, snow, showers, thunderstorm
    return { isRainy: weathercode >= 45, isNight: is_day === 0 }
  } catch {
    return { isRainy: false, isNight: false }
  }
}
