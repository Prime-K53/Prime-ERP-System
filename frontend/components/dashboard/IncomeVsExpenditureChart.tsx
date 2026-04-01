import React, { memo, useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import CustomTooltip from './CustomTooltip';
import type { DashboardChartPoint, DashboardRange, IncomeVsExpenditureChartProps } from './types';

const CHART_HEIGHT = 360;
const INCOME_COLOR = '#22C55E';
const EXPENDITURE_COLOR = '#EF4444';
const GRID_STROKE = '#E5E7EB';
const TICK_STYLE = {
  fill: '#64748B',
  fontSize: 12,
  fontWeight: 500,
};
const AXIS_LINE_STYLE = {
  stroke: '#CBD5E1',
};
const CHART_MARGIN = {
  top: 8,
  right: 12,
  left: -8,
  bottom: 4,
};
const TOOLTIP_CURSOR = {
  stroke: '#CBD5E1',
  strokeDasharray: '4 4',
  strokeWidth: 1,
};
const INCOME_ACTIVE_DOT = {
  r: 4,
  stroke: INCOME_COLOR,
  strokeWidth: 2,
  fill: '#FFFFFF',
};
const EXPENDITURE_ACTIVE_DOT = {
  r: 4,
  stroke: EXPENDITURE_COLOR,
  strokeWidth: 2,
  fill: '#FFFFFF',
};

const FALLBACK_CHART_DATA: Record<DashboardRange, DashboardChartPoint[]> = {
  weekly: [
    { label: 'Mon', income: 3800, expenditure: 1600 },
    { label: 'Tue', income: 4400, expenditure: 1800 },
    { label: 'Wed', income: 5100, expenditure: 2100 },
    { label: 'Thu', income: 4700, expenditure: 1900 },
    { label: 'Fri', income: 5600, expenditure: 2300 },
    { label: 'Sat', income: 4900, expenditure: 2000 },
    { label: 'Sun', income: 5300, expenditure: 2200 },
  ],
  monthly: [
    { label: '01', income: 3200, expenditure: 1400 },
    { label: '05', income: 4500, expenditure: 1750 },
    { label: '10', income: 4900, expenditure: 1950 },
    { label: '15', income: 5600, expenditure: 2200 },
    { label: '20', income: 6200, expenditure: 2480 },
    { label: '25', income: 5900, expenditure: 2360 },
    { label: '30', income: 6800, expenditure: 2650 },
  ],
  yearly: [
    { label: 'Jan', income: 42000, expenditure: 16500 },
    { label: 'Feb', income: 46800, expenditure: 18200 },
    { label: 'Mar', income: 51000, expenditure: 19400 },
    { label: 'Apr', income: 55800, expenditure: 20700 },
    { label: 'May', income: 60200, expenditure: 22300 },
    { label: 'Jun', income: 64800, expenditure: 23800 },
    { label: 'Jul', income: 69000, expenditure: 25100 },
  ],
};

const formatAxisValue = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return `${value}`;
};

const hasLiveData = (data: DashboardChartPoint[]) =>
  data.some((point) => point.income > 0 || point.expenditure > 0);

const IncomeVsExpenditureChartComponent: React.FC<IncomeVsExpenditureChartProps> = memo(({
  data,
  currencySymbol = '$',
  range,
}) => {
  const chartData = useMemo(() => {
    if (data.length === 0 || !hasLiveData(data)) {
      return FALLBACK_CHART_DATA[range];
    }

    return data;
  }, [data, range]);

  const tooltipContent = useMemo(() => (
    <CustomTooltip currency={currencySymbol} />
  ), [currencySymbol]);

  return (
    <div className="dashboard-chart">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={chartData} margin={CHART_MARGIN}>
          <defs>
            <linearGradient id="dashboard-income-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={INCOME_COLOR} stopOpacity={0.18} />
              <stop offset="100%" stopColor={INCOME_COLOR} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="dashboard-expenditure-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={EXPENDITURE_COLOR} stopOpacity={0.16} />
              <stop offset="100%" stopColor={EXPENDITURE_COLOR} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="4 4" vertical={false} />

          <XAxis
            dataKey="label"
            axisLine={AXIS_LINE_STYLE}
            tickLine={false}
            tick={TICK_STYLE}
            dy={8}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={TICK_STYLE}
            tickFormatter={formatAxisValue}
            width={52}
          />

          <Tooltip content={tooltipContent} cursor={TOOLTIP_CURSOR} />

          <Area
            type="monotone"
            dataKey="income"
            stroke="none"
            fill="url(#dashboard-income-fill)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="expenditure"
            stroke="none"
            fill="url(#dashboard-expenditure-fill)"
            isAnimationActive={false}
          />

          <Line
            type="monotone"
            dataKey="income"
            stroke={INCOME_COLOR}
            strokeWidth={3}
            dot={false}
            activeDot={INCOME_ACTIVE_DOT}
            isAnimationActive={false}
          />

          <Line
            type="monotone"
            dataKey="expenditure"
            stroke={EXPENDITURE_COLOR}
            strokeWidth={3}
            dot={false}
            activeDot={EXPENDITURE_ACTIVE_DOT}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

IncomeVsExpenditureChartComponent.displayName = 'IncomeVsExpenditureChart';

export default IncomeVsExpenditureChartComponent;
