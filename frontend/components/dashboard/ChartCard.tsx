import React, { memo } from 'react';
import type { ChartCardProps } from './types';

const joinClassNames = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(' ');

const ChartCardComponent: React.FC<ChartCardProps> = memo(({
  title,
  subtitle,
  headerMeta,
  footer,
  className,
  loading = false,
  children,
}) => {
  return (
    <section className={joinClassNames('dashboard-card', className)}>
      <header className="dashboard-card__header">
        <div className="dashboard-card__heading">
          <h2 className="dashboard-card__title">{title}</h2>
          {subtitle ? <p className="dashboard-card__subtitle">{subtitle}</p> : null}
        </div>
        {headerMeta ? <div className="dashboard-card__meta">{headerMeta}</div> : null}
      </header>

      <div className="dashboard-card__body">{children}</div>

      {footer ? <footer className="dashboard-card__footer">{footer}</footer> : null}

      {loading ? (
        <div className="dashboard-card__loading" aria-hidden="true">
          <span className="dashboard-card__skeleton-line dashboard-card__skeleton-line--lg" />
          <span className="dashboard-card__skeleton-line dashboard-card__skeleton-line--md" />
          <span className="dashboard-card__skeleton-line dashboard-card__skeleton-line--sm" />
        </div>
      ) : null}
    </section>
  );
});

ChartCardComponent.displayName = 'ChartCard';

export default ChartCardComponent;
