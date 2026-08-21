import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useTheme } from '@mui/material';
import { formatCurrency } from '@/utils/format';

interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

export function DonutBreakdownChart({ data, height = 260 }: { data: DonutSlice[]; height?: number }) {
  const theme = useTheme();
  const nonZero = data.filter((d) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={nonZero}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
        >
          {nonZero.map((slice) => (
            <Cell key={slice.name} fill={slice.color} stroke="none" />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [formatCurrency(value)]}
          contentStyle={{
            background: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 8,
            fontSize: 13,
            color: theme.palette.text.primary,
            boxShadow: theme.shadows[4],
          }}
          labelStyle={{ color: theme.palette.text.secondary }}
        />
        <Legend verticalAlign="bottom" height={48} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
