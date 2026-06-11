import type { Match, Country } from './types'

export interface TeamStanding {
  team: Country
  group: string
  PG: number   // pontos ganhos
  J: number    // jogos
  V: number    // vitórias
  E: number    // empates
  D: number    // derrotas
  GP: number   // gols pró
  GC: number   // gols contra
  SG: number   // saldo de gols
  pct: number  // aproveitamento %
  lastGames: ('W' | 'D' | 'L')[]
}

export function calculateGroupStandings(matches: Match[]): Map<string, TeamStanding[]> {
  const groupMatches = matches.filter((m) => m.phase === 'grupos')

  // Coleta todos os times por grupo
  const teamMap = new Map<string, TeamStanding>()

  for (const m of groupMatches) {
    for (const country of [m.country1, m.country2]) {
      if (!teamMap.has(country.id)) {
        teamMap.set(country.id, {
          team: country,
          group: m.group,
          PG: 0, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, SG: 0, pct: 0,
          lastGames: [],
        })
      }
    }
  }

  // Calcula estatísticas apenas de jogos FINISHED
  const finishedByTeam = new Map<string, { date: string; result: 'W' | 'D' | 'L' }[]>()

  for (const m of groupMatches) {
    if (m.status !== 'FINISHED' || m.scoreCountry1 == null || m.scoreCountry2 == null) continue

    const s1 = m.scoreCountry1
    const s2 = m.scoreCountry2
    const t1 = teamMap.get(m.country1.id)!
    const t2 = teamMap.get(m.country2.id)!

    t1.J++; t2.J++
    t1.GP += s1; t1.GC += s2
    t2.GP += s2; t2.GC += s1

    let r1: 'W' | 'D' | 'L', r2: 'W' | 'D' | 'L'
    if (s1 > s2)      { t1.V++; t1.PG += 3; t2.D++; r1 = 'W'; r2 = 'L' }
    else if (s1 < s2) { t2.V++; t2.PG += 3; t1.D++; r1 = 'L'; r2 = 'W' }
    else              { t1.E++; t1.PG++; t2.E++; t2.PG++; r1 = 'D'; r2 = 'D' }

    const arr1 = finishedByTeam.get(m.country1.id) ?? []
    arr1.push({ date: m.matchDate, result: r1 })
    finishedByTeam.set(m.country1.id, arr1)

    const arr2 = finishedByTeam.get(m.country2.id) ?? []
    arr2.push({ date: m.matchDate, result: r2 })
    finishedByTeam.set(m.country2.id, arr2)
  }

  // Finaliza cálculos
  for (const [id, s] of teamMap) {
    s.SG = s.GP - s.GC
    s.pct = s.J > 0 ? Math.round((s.PG / (s.J * 3)) * 100) : 0

    const games = (finishedByTeam.get(id) ?? [])
      .sort((a, b) => a.date.localeCompare(b.date))
    s.lastGames = games.slice(-5).map((g) => g.result)
  }

  // Agrupa e ordena: PG desc → SG desc → GP desc → nome asc
  const byGroup = new Map<string, TeamStanding[]>()
  for (const s of teamMap.values()) {
    const arr = byGroup.get(s.group) ?? []
    arr.push(s)
    byGroup.set(s.group, arr)
  }

  for (const [group, arr] of byGroup) {
    byGroup.set(group, arr.sort((a, b) =>
      b.PG - a.PG || b.SG - a.SG || b.GP - a.GP || a.team.name.localeCompare(b.team.name)
    ))
  }

  // Retorna ordenado por grupo (A, B, C…)
  return new Map([...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b)))
}
