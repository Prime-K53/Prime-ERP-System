import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { KpiCardProps } from './types';

const CURRENCY_FRACTION_OPTIONS = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

const COUNT_UP_DURATION_MS = 700;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const formatMetricValue = (
  value: number,
  format: 'currency' | 'count',
  currencySymbol: string,
): string => {
  if (format === 'count') {
    return Math.round(value).toLocaleString();
  }

  return `${currencySymbol}${value.toLocaleString(undefined, CURRENCY_FRACTION_OPTIONS)}`;
};

const useCountUp = (targetValue: number) => {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const displayValueRef = useRef(targetValue);

  useEffect(() => {
    displayValueRef.current = displayValue;
  }, [displayValue]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayValue(targetValue);
      displayValueRef.current = targetValue;
      return;
    }

    const startValue = displayValueRef.current;
    const difference = targetValue - startValue;

    if (Math.abs(difference) < 0.01) {
      setDisplayValue(targetValue);
      displayValueRef.current = targetValue;
      return;
    }

    let frameId = 0;
    const startTime = performance.now();

    const step = (timestamp: number) => {
      const elapsed = timestamp - startTime;
      const progress = clamp(elapsed / COUNT_UP_DURATION_MS, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplayValue(startValue + (difference * eased));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      } else {
        displayValueRef.current = targetValue;
      }
    };

    frameId = window.requestAnimationFrame(step);

    return () => window.cancelAnimationFrame(frameId);
  }, [targetValue]);

  return displayValue;
};

const KpiCardComponent: React.FC<KpiCardProps> = memo(({
  title,
  value,
  helperText,
  icon: Icon,
  tone = 'primary',
  format = 'currency',
  currencySymbol = '$',
  emptyLabel,
}) => {
  const animatedValue = useCountUp(value);

  const displayValue = useMemo(() => {
    if (emptyLabel && value <= 0) {
      return emptyLabel;
    }

    return formatMetricValue(animatedValue, format, currencySymbol);
  }, [animatedValue, currencySymbol, emptyLabel, format, value]);

  const valueClassName = useMemo(() => {
    if (emptyLabel && value <= 0) {
      return 'dashboard-kpi__value dashboard-kpi__value--empty';
    }

    return 'dashboard-kpi__value';
  }, [emptyLabel, value]);

  return (
    <article className={`dashboard-card dashboard-kpi dashboard-kpi--${tone}`}>
      <div className="dashboard-kpi__header">
        <div>
          <p className="dashboard-kpi__label">{title}</p>
          <div className={valueClassName}>{displayValue}</div>
        </div>
        <div className="dashboard-kpi__icon-shell" aria-hidden="true">
          <Icon size={18} strokeWidth={2.1} />
        </div>
      </div>

      <p className="dashboard-kpi__helper">{helperText}</p>
    </article>
  );
});

KpiCardComponent.displayName = 'KpiCard';

export default KpiCardComponent;
