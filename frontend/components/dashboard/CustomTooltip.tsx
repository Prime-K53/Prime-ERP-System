import React, { memo } from 'react';

export interface TooltipPayloadEntry {
  color?: string;
  dataKey?: string;
  name?: string;
  value?: number | string;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  currency?: string;
}

const CURRENCY_OPTIONS = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

const HUMANIZED_LABELS: Record<string, string> = {
  income: 'Income',
  expenditure: 'Expenditure',
};

const formatCurrency = (currency: string, value: number) =>
  `${currency}${value.toLocaleString(undefined, CURRENCY_OPTIONS)}`;

const formatMetricName = (entry: TooltipPayloadEntry) => {
  const fallbackKey = String(entry.dataKey || entry.name || '').trim().toLowerCase();
  return HUMANIZED_LABELS[fallbackKey] || entry.name || entry.dataKey || 'Value';
};

const CustomTooltipComponent: React.FC<CustomTooltipProps> = memo(({
  active,
  payload,
  label,
  currency = '$',
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="dashboard-tooltip">
      {label ? <p className="dashboard-tooltip__label">{label}</p> : null}

      <div className="dashboard-tooltip__items">
        {payload.map((entry, index) => {
          const numericValue = Number(entry.value || 0);

          return (
            <div key={`${entry.dataKey || entry.name || 'value'}-${index}`} className="dashboard-tooltip__row">
              <span className="dashboard-tooltip__name">
                <span
                  className="dashboard-tooltip__dot"
                  style={{ backgroundColor: entry.color || '#4F46E5' }}
                />
                {formatMetricName(entry)}
              </span>
              <span className="dashboard-tooltip__value">{formatCurrency(currency, numericValue)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

CustomTooltipComponent.displayName = 'CustomTooltip';

export default CustomTooltipComponent;
