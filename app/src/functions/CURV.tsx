import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTreasuryRates } from "@/lib/api";
import { fmtPctFromDecimal, fmtDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useSymbolsRT } from "@/lib/realtime";

const TENORS: { k: keyof import("@/lib/api").TreasuryRow; label: string; years: number; rtSym: string }[] = [
  { k: "month_1", label: "1M", years: 1/12, rtSym: "US01M" },
  { k: "month_3", label: "3M", years: 3/12, rtSym: "US03M" },
  { k: "month_6", label: "6M", years: 6/12, rtSym: "US06M" },
  { k: "year_1",  label: "1Y", years: 1,    rtSym: "US01Y" },
  { k: "year_2",  label: "2Y", years: 2,    rtSym: "US02Y" },
  { k: "year_3",  label: "3Y", years: 3,    rtSym: "US03Y" },
  { k: "year_5",  label: "5Y", years: 5,    rtSym: "US05Y" },
  { k: "year_7",  label: "7Y", years: 7,    rtSym: "US07Y" },
  { k: "year_10", label: "10Y", years: 10,  rtSym: "US10Y" },
  { k: "year_20", label: "20Y", years: 20,  rtSym: "US20Y" },
  { k: "year_30", label: "30Y", years: 30,  rtSym: "US30Y" },
];

export function CURV() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["treasury-rates"], queryFn: () => fetchTreasuryRates(40),
    staleTime: 3600_000,
  });
  const rt = useSymbolsRT(TENORS.map(t => t.rtSym));

  const sorted = useMemo(() => [...data].sort((a, b) => (a.date > b.date ? -1 : 1)), [data]);
  const histToday = sorted[0];
  const week = sorted.find((r) => new Date(r.date).getTime() <= new Date(histToday?.date ?? "").getTime() - 7 * 864e5);
  const month = sorted.find((r) => new Date(r.date).getTime() <= new Date(histToday?.date ?? "").getTime() - 30 * 864e5);

  // Merge RT data into today's rates
  const today = useMemo(() => {
    if (!histToday) return null;
    const merged = { ...histToday } as import("@/lib/api").TreasuryRow;
    for (const t of TENORS) {
      const r = rt[t.rtSym];
      if (r?.lp != null) {
        (merged as any)[t.k] = r.lp / 100;
      }
    }
    return merged;
  }, [histToday, rt]);

  if (isLoading) return <div className="p-4 text-term-muted uppercase text-[11px] tracking-widest">Loading yield curve…</div>;
  if (error) return <div className="p-4 text-term-red">{(error as Error).message}</div>;
  if (!today) return <div className="p-4 text-term-muted">No data.</div>;

  // Build SVG curve
  const W = 800, H = 220, padL = 40, padR = 12, padT = 16, padB = 28;
  const vals = TENORS.map((t) => today[t.k] as number | undefined).filter((v) => v != null) as number[];
  const minV = Math.min(...vals) * 0.98;
  const maxV = Math.max(...vals) * 1.02;
  const xFor = (yr: number) => padL + (Math.log10(yr + 0.05) - Math.log10(0.05)) / (Math.log10(30.05) - Math.log10(0.05)) * (W - padL - padR);
  const yFor = (v: number) => padT + (1 - (v - minV) / (maxV - minV)) * (H - padT - padB);

  function points(row?: import("@/lib/api").TreasuryRow) {
    if (!row) return "";
    return TENORS
      .map((t) => {
        const v = row[t.k] as number | undefined;
        return v != null ? `${xFor(t.years)},${yFor(v)}` : null;
      })
      .filter(Boolean)
      .join(" ");
  }

  return (
    <div className="p-4 text-[12px] grid grid-rows-[auto_auto_1fr] gap-4 h-full">
      <div className="flex items-center gap-6">
        <div>
          <div className="sub-header">AS OF</div>
          <div className="num text-term-heading text-lg">{fmtDate(today.date)}</div>
        </div>
        <div>
          <div className="sub-header">2s-10s SPREAD</div>
          <div className={cn("num text-lg",
            today.year_10 != null && today.year_2 != null && (today.year_10 - today.year_2 >= 0 ? "up" : "down"))}>
            {today.year_10 != null && today.year_2 != null
              ? ((today.year_10 - today.year_2) * 100).toFixed(0) + " bps"
              : "—"}
          </div>
        </div>
        <div>
          <div className="sub-header">3M - 10Y</div>
          <div className="num text-lg">
            {today.year_10 != null && today.month_3 != null
              ? ((today.year_10 - today.month_3) * 100).toFixed(0) + " bps"
              : "—"}
          </div>
        </div>
      </div>

      <div>
        <table className="w-full grid-data">
          <thead>
            <tr>
              <th>Tenor</th>
              {TENORS.map((t) => <th key={t.k} className="text-right num">{t.label}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-term-amber">TODAY</td>
              {TENORS.map((t) => <td key={t.k} className="num text-right text-term-heading">{fmtPctFromDecimal(today[t.k] as number | undefined, 3)}</td>)}
            </tr>
            {week && (
              <tr>
                <td className="text-term-muted">1 W AGO</td>
                {TENORS.map((t) => <td key={t.k} className="num text-right text-term-muted">{fmtPctFromDecimal(week[t.k] as number | undefined, 3)}</td>)}
              </tr>
            )}
            {month && (
              <tr>
                <td className="text-term-muted">1 M AGO</td>
                {TENORS.map((t) => <td key={t.k} className="num text-right text-term-muted">{fmtPctFromDecimal(month[t.k] as number | undefined, 3)}</td>)}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="relative border border-term-border bg-term-bg2 flex items-center justify-center min-h-[220px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
          {/* grid */}
          {TENORS.map((t) => (
            <g key={t.k}>
              <line x1={xFor(t.years)} y1={padT} x2={xFor(t.years)} y2={H - padB} stroke="#1f1f1f" />
              <text x={xFor(t.years)} y={H - padB + 14} fontSize="9" textAnchor="middle" fill="#6e6e6e">{t.label}</text>
            </g>
          ))}
          {[minV, (minV + maxV) / 2, maxV].map((v, i) => (
            <g key={i}>
              <line x1={padL} y1={yFor(v)} x2={W - padR} y2={yFor(v)} stroke="#1f1f1f" />
              <text x={padL - 4} y={yFor(v) + 3} fontSize="9" textAnchor="end" fill="#6e6e6e">{(v * 100).toFixed(2)}</text>
            </g>
          ))}
          {/* month-ago curve */}
          {month && <polyline fill="none" stroke="#555" strokeWidth="1" strokeDasharray="3,3" points={points(month)} />}
          {/* week-ago curve */}
          {week && <polyline fill="none" stroke="#a55f00" strokeWidth="1.2" points={points(week)} />}
          {/* today curve */}
          <polyline fill="none" stroke="#ff8c00" strokeWidth="2" points={points(today)} />
          {TENORS.map((t) => {
            const v = today[t.k] as number | undefined;
            return v != null ? <circle key={t.k} cx={xFor(t.years)} cy={yFor(v)} r="3" fill="#ffaa33" /> : null;
          })}
        </svg>
        <div className="absolute top-2 right-3 text-[10px] uppercase tracking-widest text-term-muted flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-term-amber" />TODAY</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-term-amberDim" />1W AGO</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 border-t border-dashed border-term-muted" />1M AGO</span>
        </div>
      </div>
    </div>
  );
}
