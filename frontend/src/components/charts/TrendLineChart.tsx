import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useTheme } from '@mui/material';
import { formatCurrency } from '@/utils/format';

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
}

interface TrendLineChartProps {
  data: Array<Record<string, any>>;
  xKey: string;
  series: TrendSeries[];
  height?: number;
  valueFormatter?: (v: number) => string;
}

export function TrendLineChart({ data, xKey, series, height = 300, valueFormatter }: TrendLineChartProps) {
  const theme = useTheme();
  const fmt = valueFormatter || formatCurrency;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: theme.palette.text.secondary }} />
        <YAxis
          tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
          tickFormatter={(v) => fmt(v)}
          width={80}
        />
        <Tooltip
          formatter={(value: number) => [fmt(value)]}
          contentStyle={{
            background: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 8,
            fontSize: 13,
            color: theme.palette.text.primary,
            boxShadow: theme.shadows[4],
          }}
          labelStyle={{ color: theme.palette.text.secondary, marginBottom: 4 }}
          cursor={{ stroke: theme.palette.divider, strokeWidth: 1 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
