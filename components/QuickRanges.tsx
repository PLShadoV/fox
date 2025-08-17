'use client'

import { useMemo } from 'react'

type Range = { from: string; to: string }
type Props = {
  value: Range
  onChange: (range: Range) => void
  className?: string
}

/** Szybkie zakresy – po kliknięciu OD RAZU woła onChange (bez „Odśwież”). */
export default function QuickRanges({ value, onChange, className }: Props) {
  const now = new Date()

  const presets = useMemo(() => {
    const startOfDay = (d: Date) => {
      const x = new Date(d); x.setHours(0, 0, 0, 0); return x
    }
    const endOfDay = (d: Date) => {
      const x = new Date(d); x.setHours(23, 59, 59, 999); return x
    }
    const yesterday = () => {
      const y = new Date(now); y.setDate(y.getDate() - 1); return y
    }
    const startOfWeekMon = (d: Date) => {
      const x = new Date(d)
      const day = (x.getDay() + 6) % 7 // pon=0
      x.setDate(x.getDate() - day)
      x.setHours(0, 0, 0, 0)
      return x
    }
    const endOfWeekSun = (d: Date) => {
      const x = startOfWeekMon(d); x.setDate(x.getDate() + 6); x.setHours(23, 59, 59, 999); return x
    }
    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
    const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
    const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0)
    const endOfYear = (d: Date) => new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999)

    return {
      today: { from: startOfDay(now), to: endOfDay(now) },
      yesterday: { from: startOfDay(yesterday()), to: endOfDay(yesterday()) },
      thisWeek: { from: startOfWeekMon(now), to: endOfWeekSun(now) },
      thisMonth: { from: startOfMonth(now), to: endOfMonth(now) },
      thisYear: { from: startOfYear(now), to: endOfYear(now) },
      last24h: (() => {
        const to = new Date()
        const from = new Date(to); from.setDate(to.getDate() - 1)
        return { from, to }
      })(),
    }
  }, [now])

  function setRange(from: Date, to: Date) {
    onChange({ from: toISO(from), to: toISO(to) })
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ''}`}>
      <Btn onClick={() => setRange(presets.today.from, presets.today.to)}>Dziś</Btn>
      <Btn onClick={() => setRange(presets.yesterday.from, presets.yesterday.to)}>Wczoraj</Btn>
      <Btn onClick={() => setRange(presets.thisWeek.from, presets.thisWeek.to)}>Ten tydzień</Btn>
      <Btn onClick={() => setRange(presets.thisMonth.from, presets.thisMonth.to)}>Ten miesiąc</Btn>
      <Btn onClick={() => setRange(presets.thisYear.from, presets.thisYear.to)}>Ten rok</Btn>
      <Btn onClick={() => setRange(presets.last24h.from, presets.last24h.to)}>Ostatnie 24h</Btn>
    </div>
  )
}

function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-xl bg-slate-800/60 hover:bg-slate-700 px-3 py-2 text-sm transition border border-slate-700/50"
    />
  )
}

function toISO(d: Date) {
  // ISO dla konkretnego lokalnego czasu (bez przesunięcia podczas serializacji)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString()
}
