"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PriceHistory } from "@/types";

interface PriceChartProps {
  data: PriceHistory[];
  source: string;
}

export function PriceChart({ data, source }: PriceChartProps) {
  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffInMs = now.getTime() - past.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "1 day ago";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 14) return "1 week ago";
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 60) return "1 month ago";
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  const chartData = data
    .filter((item) => item.source === source)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    .map((item) => ({
      date: formatTimeAgo(item.created_at),
      price: item.price,
      fullDate: new Date(item.created_at).toLocaleDateString(),
    }));

  return (
    <div className="w-full h-80 bg-white rounded-2xl p-6">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
        >
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#007AFF" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#007AFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="0"
            stroke="#f0f0f0"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: "#8E8E93" }}
            axisLine={{ stroke: "#f0f0f0" }}
            tickLine={false}
            dy={10}
          />
          <YAxis
            label={{
              value: "Price (USD)",
              angle: -90,
              position: "insideLeft",
              style: { fill: "#8E8E93", fontSize: 12 },
            }}
            tick={{ fontSize: 12, fill: "#8E8E93" }}
            axisLine={false}
            tickLine={false}
            domain={["dataMin - 50", "dataMax + 50"]}
            dx={-10}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(255, 255, 255, 0.98)",
              border: "none",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              padding: "12px 16px",
              fontSize: "14px",
            }}
            itemStyle={{ color: "#007AFF", fontWeight: 600 }}
            labelStyle={{ color: "#8E8E93", marginBottom: "4px" }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                return payload[0].payload.fullDate;
              }
              return label;
            }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#007AFF"
            strokeWidth={3}
            dot={{ fill: "#007AFF", r: 4, strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
            fill="url(#priceGradient)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
