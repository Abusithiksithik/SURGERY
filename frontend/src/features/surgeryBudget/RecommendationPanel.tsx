import { Fragment } from 'react';
import {
  Box,
  Stack,
  Typography,
  Divider,
  Switch,
  FormControlLabel,
  Button,
  Chip,
  LinearProgress,
  Tooltip,
  Alert,
} from '@mui/material';
import { AutoAwesome, CheckCircle, InfoOutlined } from '@mui/icons-material';
import { DonutBreakdownChart } from '@/components/charts/DonutBreakdownChart';
import { LoadingState } from '@/components/common/AsyncStates';
import { formatCurrency, formatPercent, formatDuration, formatDate } from '@/utils/format';
import { palette } from '@/theme/tokens';
import type { RecommendationResult } from '@/api/types';

interface RecommendationPanelProps {
  result: RecommendationResult | undefined;
  isLoading: boolean;
  excludeOutliers: boolean;
  onToggleOutliers: (value: boolean) => void;
  onApplyAll: () => void;
  onApplyField: (field: string, value: number) => void;
  disabled?: boolean;
}

/**
 * Confidence is derived from sample size: this isn't a statistical
 * p-value, just a legible signal so a Finance user can tell "this
 * recommendation rests on 40 similar cases" apart from "this rests on 2".
 */
function confidenceFromSampleSize(n: number): { label: string; pct: number; color: string } {
  if (n >= 20) return { label: 'High confidence', pct: 100, color: palette.green600 };
  if (n >= 8) return { label: 'Medium confidence', pct: 65, color: palette.amber600 };
  if (n >= 1) return { label: 'Low confidence', pct: 30, color: palette.red500 };
  return { label: 'No data', pct: 0, color: palette.slate500 };
}

const COMPONENT_ROWS: Array<{ key: keyof NonNullable<RecommendationResult['components']>; label: string; overallField: string }> = [
  { key: 'surgeonFee', label: 'Surgeon Fee', overallField: 'recommendedSurgeonFee' },
  { key: 'assistant', label: 'Assistant', overallField: 'recommendedAssistantBudget' },
  { key: 'anaesthetist', label: 'Anaesthetist', overallField: 'recommendedAnaesthetistBudget' },
  { key: 'consumables', label: 'Consumables', overallField: 'recommendedConsumables' },
  { key: 'pharmacy', label: 'Pharmacy', overallField: 'recommendedPharmacy' },
  { key: 'miscellaneous', label: 'Miscellaneous', overallField: 'recommendedMiscellaneous' },
];

const BUDGET_FIELD_MAP: Record<string, string> = {
  recommendedSurgeonFee: 'budgetSurgeonFee',
  recommendedAssistantBudget: 'budgetAssistantCost',
  recommendedAnaesthetistBudget: 'budgetAnaesthetistFee',
  recommendedOTBudget: 'budgetOtCost',
  recommendedConsumables: 'budgetConsumables',
  recommendedPharmacy: 'budgetPharmacy',
  recommendedMiscellaneous: 'budgetMiscellaneous',
};

export function RecommendationPanel({
  result,
  isLoading,
  excludeOutliers,
  onToggleOutliers,
  onApplyAll,
  onApplyField,
  disabled,
}: RecommendationPanelProps) {
  return (
    <Box
      sx={{
        borderLeft: `3px solid ${palette.teal600}`,
        borderRadius: 1,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderLeftWidth: 3,
        borderLeftColor: palette.teal600,
        p: 2.5,
        position: { md: 'sticky' },
        top: { md: 88 },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <AutoAwesome sx={{ color: palette.teal600, fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={700}>
          Recommendation Engine
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Based on historical completed surgeries matching this surgeon and surgery type.
      </Typography>

      <FormControlLabel
        sx={{ mt: 1.5, mb: 0.5 }}
        control={
          <Switch
            size="small"
            checked={!excludeOutliers}
            onChange={(e) => onToggleOutliers(!e.target.checked)}
            disabled={disabled}
          />
        }
        label={<Typography variant="caption">Include outliers</Typography>}
      />

      <Divider sx={{ my: 1.5 }} />

      {isLoading ? (
        <LoadingState label="Generating recommendation…" minHeight={200} />
      ) : !result ? (
        <Alert severity="info" icon={<InfoOutlined fontSize="small" />} sx={{ fontSize: 13 }}>
          Select a surgeon and surgery type to generate a recommendation.
        </Alert>
      ) : result.sampleSize === 0 ? (
        <Alert severity="warning" sx={{ fontSize: 13 }}>
          {result.warning || 'No historical data available for this combination. Manual entry required.'}
        </Alert>
      ) : (
        <RecommendationBody
          result={result}
          onApplyAll={onApplyAll}
          onApplyField={onApplyField}
          disabled={disabled}
        />
      )}
    </Box>
  );
}

function RecommendationBody({
  result,
  onApplyAll,
  onApplyField,
  disabled,
}: {
  result: RecommendationResult;
  onApplyAll: () => void;
  onApplyField: (field: string, value: number) => void;
  disabled?: boolean;
}) {
  const confidence = confidenceFromSampleSize(result.sampleSize);
  const overall = result.overall;
  const components = result.components;

  const breakdownData = overall
    ? [
        { name: 'Surgeon Fee', value: overall.recommendedSurgeonFee || 0, color: palette.slate700 },
        { name: 'Assistant', value: overall.recommendedAssistantBudget || 0, color: palette.teal600 },
        { name: 'Anaesthetist', value: overall.recommendedAnaesthetistBudget || 0, color: palette.amber500 },
        { name: 'OT', value: overall.recommendedOTBudget || 0, color: palette.red500 },
        { name: 'Consumables', value: overall.recommendedConsumables || 0, color: palette.slate500 },
        { name: 'Pharmacy', value: overall.recommendedPharmacy || 0, color: palette.teal500 },
        { name: 'Misc', value: overall.recommendedMiscellaneous || 0, color: '#9C7BC9' },
      ]
    : [];

  return (
    <Stack spacing={2}>
      {/* Confidence meter — signature element */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="caption" fontWeight={700} sx={{ color: confidence.color }}>
            {confidence.label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {result.sampleSize} similar case{result.sampleSize === 1 ? '' : 's'}
            {result.outlierCount > 0 && ` · ${result.outlierCount} outlier${result.outlierCount === 1 ? '' : 's'} excluded`}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={confidence.pct}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': { bgcolor: confidence.color, borderRadius: 3 },
          }}
        />
      </Box>

      {overall && (
        <>
          <Box sx={{ bgcolor: 'action.hover', borderRadius: 1.5, p: 1.5 }}>
            <Stack spacing={0.75}>
              <SummaryRow label="Recommended Total Cost" value={formatCurrency(overall.recommendedTotalCost)} bold />
              <SummaryRow label="Recommended Quote" value={formatCurrency(overall.recommendedPatientQuote)} />
              <SummaryRow label="Recommended Margin" value={formatPercent(overall.recommendedMarginPct)} />
              <SummaryRow label="Recommended Profit" value={formatCurrency(overall.recommendedProfit)} positive />
              <SummaryRow label="Expected OT Duration" value={formatDuration(overall.recommendedOTDurationMinutes)} />
            </Stack>
          </Box>

          <Button
            fullWidth
            variant="contained"
            size="small"
            startIcon={<CheckCircle fontSize="small" />}
            onClick={onApplyAll}
            disabled={disabled}
            sx={{ bgcolor: palette.teal600, '&:hover': { bgcolor: palette.teal600, opacity: 0.9 } }}
          >
            Apply all to budget
          </Button>

          <DonutBreakdownChart data={breakdownData} height={200} />
        </>
      )}

      <Divider />

      <Typography variant="caption" fontWeight={700} color="text.secondary">
        BY COMPONENT
      </Typography>

      <Stack spacing={1.5}>
        {COMPONENT_ROWS.map(({ key, label, overallField }) => {
          const stats = components?.[key];
          if (!stats) return null;
          const recommendedValue =
            (stats as any).recommendedFee ?? (stats as any).recommendedBudget ?? null;
          return (
            <Fragment key={key}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Avg {formatCurrency((stats as any).average ?? null)} · Median {formatCurrency((stats as any).median ?? null)} · n={(stats as any).sampleSize ?? 0}
                  </Typography>
                </Box>
                <Tooltip title={`Apply ${formatCurrency(recommendedValue)} to ${label}`}>
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={disabled || recommendedValue == null}
                      onClick={() =>
                        recommendedValue != null &&
                        onApplyField(BUDGET_FIELD_MAP[overallField] || '', recommendedValue)
                      }
                      sx={{ minWidth: 0, px: 1.2, fontSize: 11 }}
                    >
                      {formatCurrency(recommendedValue)}
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </Fragment>
          );
        })}
      </Stack>

      {result.last10SimilarSurgeries && result.last10SimilarSurgeries.length > 0 && (
        <>
          <Divider />
          <Typography variant="caption" fontWeight={700} color="text.secondary">
            TOP SIMILAR CASES
          </Typography>
          <Stack spacing={1}>
            {result.last10SimilarSurgeries.slice(0, 5).map((c) => (
              <Stack key={c.surgeryId} direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 150 }}>
                  {c.mrNumber} · {formatDate(c.surgeryDate)}
                </Typography>
                <Chip
                  size="small"
                  label={`${Math.round(c.similarityScore)}% match`}
                  sx={{ height: 20, fontSize: 10, bgcolor: palette.teal100, color: palette.teal600 }}
                />
              </Stack>
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}

function SummaryRow({ label, value, bold, positive }: { label: string; value: string; bold?: boolean; positive?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="caption"
        fontWeight={bold ? 800 : 700}
        sx={{
          fontFamily: 'IBM Plex Mono, monospace',
          color: positive ? palette.green600 : 'text.primary',
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}
