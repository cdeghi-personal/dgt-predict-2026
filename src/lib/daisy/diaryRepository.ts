// Server-side only
import { sydleCall, parseSearch } from '@/lib/sydle/client'
import { DAISY_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import type { SydleDaisyDiary, DaisyDiary } from '@/lib/types'

function mapDiary(raw: SydleDaisyDiary): DaisyDiary {
  const toDate = (v: number | string | undefined) => {
    if (!v) return new Date().toISOString()
    if (typeof v === 'number') return new Date(v).toISOString()
    return new Date(v).toISOString()
  }
  return {
    id: raw._id,
    title: raw.tytle ?? '',
    subtitle: raw.subtytle ?? '',
    content: raw.content ?? '',
    active: raw.Active ?? false,
    date: raw.date,
    createdAt: toDate(raw._creationDate),
    updatedAt: raw._lastUpdateDate ? toDate(raw._lastUpdateDate) : undefined,
  }
}

export async function getActiveDiaries(token: string): Promise<DaisyDiary[]> {
  const raw = await sydleCall(
    DAISY_PACKAGE,
    SYDLE_CLASS.daisyDiary,
    SYDLE_METHOD.search,
    {
      query: { term: { Active: true } },
      sort: [{ _creationDate: { order: 'desc' } }],
      size: 20,
    },
    token,
  )
  return parseSearch<SydleDaisyDiary>(raw).map(mapDiary)
}

export async function getAllDiaries(token: string): Promise<DaisyDiary[]> {
  const raw = await sydleCall(
    DAISY_PACKAGE,
    SYDLE_CLASS.daisyDiary,
    SYDLE_METHOD.search,
    {
      query: { match_all: {} },
      sort: [{ _creationDate: { order: 'desc' } }],
      size: 50,
    },
    token,
  )
  return parseSearch<SydleDaisyDiary>(raw).map(mapDiary)
}

export async function getDiaryById(id: string, token: string): Promise<DaisyDiary | null> {
  const raw = await sydleCall(
    DAISY_PACKAGE,
    SYDLE_CLASS.daisyDiary,
    SYDLE_METHOD.search,
    { query: { term: { _id: id } }, size: 1 },
    token,
  )
  const items = parseSearch<SydleDaisyDiary>(raw)
  return items[0] ? mapDiary(items[0]) : null
}

export async function createDiary(
  title: string,
  subtitle: string,
  content: string,
  token: string,
  date?: string,
): Promise<DaisyDiary> {
  const raw = await sydleCall<SydleDaisyDiary>(
    DAISY_PACKAGE,
    SYDLE_CLASS.daisyDiary,
    SYDLE_METHOD.create,
    {
      tytle: title,
      subtytle: subtitle,
      content,
      Active: true,
      ...(date ? { date } : {}),
    },
    token,
  )
  return mapDiary(raw)
}

export async function toggleDiaryActive(
  id: string,
  active: boolean,
  token: string,
): Promise<void> {
  await sydleCall(
    DAISY_PACKAGE,
    SYDLE_CLASS.daisyDiary,
    SYDLE_METHOD.patch,
    { _id: id, Active: active },
    token,
  )
}
