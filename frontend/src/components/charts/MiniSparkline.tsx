import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { useTheme } from '@mui/material';

export function MiniSparkline({ data, dataKey = 'value' }: { data: Array<Record<string, number>>; dataKey?: string }) {
  const theme = useTheme();
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width={90} height={28}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={theme.palette.primary.main}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
