"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { depthCurve } from "@/lib/predictions/amm";
import type { PoolState } from "@/lib/predictions/amm";

export default function PredictionDepthChart({
  pool,
  side,
}: {
  pool: PoolState;
  side: "yes" | "no";
}) {
  const data = depthCurve(pool, side, 8).map((d) => ({
    usdc: `$${d.usdc >= 1000 ? `${(d.usdc / 1000).toFixed(1)}k` : d.usdc.toFixed(0)}`,
    prob: Math.round(d.prob * 100),
    raw: d.usdc,
  }));

  const fill = side === "yes" ? "#22c55e" : "#ef4444";
  const fillDim = side === "yes" ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)";

  return (
    <div className="h-32 w-full mt-2">
      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
        Depth · implied prob by size
      </p>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 2, right: 2, left: -8, bottom: 0 }}>
          <XAxis
            dataKey="usdc"
            tick={{ fill: "#64748b", fontSize: 7, fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
            interval={1}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 7, fontWeight: 700 }}
            width={24}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              background: "#0a1219",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
            }}
            formatter={(v) => [`${Number(v ?? 0)}%`, side === "yes" ? "YES" : "NO"]}
            labelFormatter={(_, payload) =>
              payload?.[0]?.payload?.raw != null
                ? `~$${Number(payload[0].payload.raw).toLocaleString()} USDC`
                : ""
            }
          />
          <Bar dataKey="prob" radius={[3, 3, 0, 0]} maxBarSize={28}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === data.length - 1 ? fill : fillDim} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
