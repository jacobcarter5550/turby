import { NextResponse } from 'next/server'

export async function GET() {
  const lat = process.env.WEATHER_LAT ?? '37.7749'
  const lon = process.env.WEATHER_LON ?? '-122.4194'

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weathercode,is_day`,
      { next: { revalidate: 900 } }
    )
    if (!res.ok) return NextResponse.json({ isRainy: false, isNight: false })
    const data = await res.json()
    const weathercode: number = data.current?.weathercode ?? 0
    const is_day: number      = data.current?.is_day      ?? 1
    return NextResponse.json({ isRainy: weathercode >= 45, isNight: is_day === 0 })
  } catch {
    return NextResponse.json({ isRainy: false, isNight: false })
  }
}
