export interface Housemate {
  id: string
  name: string
  about: string
  imageUrl: string | null
}

export interface Happening {
  id: string
  label: string
  url: string
}

export async function getHousemates(): Promise<Housemate[]> {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      // don't cache — image URLs expire after 1 hour
      cache: 'no-store',
    }
  )

  if (!res.ok) throw new Error(`Notion query failed: ${res.status}`)

  const data = await res.json()

  return data.results.map((page: any) => ({
    id:       page.id,
    name:     page.properties.Name?.title?.[0]?.plain_text     ?? '',
    about:    page.properties.About?.rich_text?.[0]?.plain_text ?? '',
    imageUrl: page.properties.Image?.files?.[0]?.file?.url     ?? null,
  }))
}

export async function getHappenings(): Promise<Happening[]> {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${process.env.NOTION_HAPPENINGS_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    }
  )

  if (!res.ok) throw new Error(`Notion happenings query failed: ${res.status}`)

  const data = await res.json()

  return data.results
    .map((page: any) => ({
      id:    page.id,
      label: page.properties.Name?.title?.[0]?.plain_text ?? '',
      url:   page.properties.Link?.rich_text?.[0]?.plain_text ?? '',
    }))
    .filter((h: Happening) => h.label && h.url)
}
