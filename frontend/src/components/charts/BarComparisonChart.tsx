import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useTheme } from '@mui/material';
import { formatCurrency } from '@/utils/format';

interface BarSeries {
  key: string;
  label: string;
  color: string;
}

interface BarComparisonChartProps {
  data: Array<Record<string, any>>;
  xKey: string;
  series: BarSeries[];
  height?: number;
  horizontal?: boolean;
  valueFormatter?: (v: number) => string;
}

export function BarComparisonChart({
  data,
  xKey,
  series,
  height = 320,
  horizontal = false,
  valueFormatter,
}: BarComparisonChartProps) {
  const theme = useTheme();
  const fmt = valueFormatter || formatCurrency;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 12, fill: theme.palette.text.secondary }} tickFormatter={fmt} />
            <YAxis
              type="category"
              dataKey={xKey}
              width={120}
              tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: theme.palette.text.secondary }} />
            <YAxis tick={{ fontSize: 12, fill: theme.palette.text.secondary }} tickFormatter={fmt} width={80} />
          </>
        )}
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
          cursor={{ fill: theme.palette.action?.hover ?? 'rgba(255,255,255,0.05)' }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: theme.palette.text.secondary }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
