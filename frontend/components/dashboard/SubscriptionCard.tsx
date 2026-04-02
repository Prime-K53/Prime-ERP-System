import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CalendarClock, ChevronLeft, ChevronRight, CirclePause, Settings2 } from 'lucide-react';
import type { DashboardSubscription, SubscriptionCardProps } from './types';

const CURRENCY_OPTIONS = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
};

const clampIndex = (index: number, total: number) => {
  if (total <= 0) return 0;
  if (index < 0) return total - 1;
  if (index >= total) return 0;
  return index;
};

const formatPrice = (price: number, currencySymbol: string, frequencyLabel: string) =>
  `${currencySymbol}${price.toLocaleString(undefined, CURRENCY_OPTIONS)} ${frequencyLabel}`;

const getStatusTone = (status: DashboardSubscription['status']) => {
  switch (status) {
    case 'Active':
      return 'success';
    case 'Paused':
      return 'warning';
    case 'Cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
};

const SubscriptionCardComponent: React.FC<SubscriptionCardProps> = memo(({
  subscriptions,
  currencySymbol = '$',
  isLoading = false,
  onManage,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitionKey, setTransitionKey] = useState(0);

  useEffect(() => {
    setActiveIndex((currentIndex) => clampIndex(currentIndex, subscriptions.length));
  }, [subscriptions.length]);

  const activeSubscription = useMemo(() => {
    if (subscriptions.length === 0) return null;
    return subscriptions[activeIndex];
  }, [activeIndex, subscriptions]);

  const handleAdvance = useCallback((delta: number) => {
    setActiveIndex((currentIndex) => clampIndex(currentIndex + delta, subscriptions.length));
    setTransitionKey((currentKey) => currentKey + 1);
  }, [subscriptions.length]);

  const handlePrevious = useCallback(() => {
    handleAdvance(-1);
  }, [handleAdvance]);

  const handleNext = useCallback(() => {
    handleAdvance(1);
  }, [handleAdvance]);

  const handleManage = useCallback(() => {
    if (!activeSubscription) return;
    onManage(activeSubscription.id);
  }, [activeSubscription, onManage]);

  const handleDotClick = useCallback((nextIndex: number) => {
    setActiveIndex(nextIndex);
    setTransitionKey((currentKey) => currentKey + 1);
  }, []);

  const handleDotSelection = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const nextIndex = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(nextIndex)) return;
    handleDotClick(nextIndex);
  }, [handleDotClick]);

  return (
    <section className="dashboard-card dashboard-subscription">
      <header className="dashboard-card__header">
        <div className="dashboard-card__heading">
          <h2 className="dashboard-card__title">Active Subscriptions</h2>
          <p className="dashboard-card__subtitle">Enterprise plans and upcoming billing cycles.</p>
        </div>

        {subscriptions.length > 1 ? (
          <div className="dashboard-subscription__navigation">
            <button
              type="button"
              className="dashboard-icon-button"
              onClick={handlePrevious}
              aria-label="Previous subscription"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="dashboard-icon-button"
              onClick={handleNext}
              aria-label="Next subscription"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : null}
      </header>

      {activeSubscription ? (
        <div key={`${activeSubscription.id}-${transitionKey}`} className="dashboard-subscription__panel">
          <div className="dashboard-subscription__hero">
            <div className="dashboard-subscription__hero-top">
              <div className="dashboard-subscription__company-block">
                <div className="dashboard-subscription__avatar" aria-hidden="true">
                  <Building2 size={18} />
                </div>
                <div>
                  <p className="dashboard-subscription__eyebrow">Company</p>
                  <h3 className="dashboard-subscription__company">{activeSubscription.companyName}</h3>
                </div>
              </div>

              <span className={`dashboard-status-badge dashboard-status-badge--${getStatusTone(activeSubscription.status)}`}>
                {activeSubscription.status}
              </span>
            </div>

            <div className="dashboard-subscription__plan-block">
              <p className="dashboard-subscription__eyebrow">Plan</p>
              <p className="dashboard-subscription__plan">{activeSubscription.planName}</p>
              <p className="dashboard-subscription__notes">{activeSubscription.notes}</p>
            </div>

            <div className="dashboard-subscription__price-row">
              <div>
                <p className="dashboard-subscription__eyebrow">Price</p>
                <p className="dashboard-subscription__price">
                  {formatPrice(activeSubscription.price, currencySymbol, activeSubscription.frequencyLabel)}
                </p>
              </div>
              <div className="dashboard-subscription__meta-chip">
                <CalendarClock size={15} />
                <span>{activeSubscription.cycleLabel}</span>
              </div>
            </div>
          </div>

          <div className="dashboard-subscription__metrics">
            <div className="dashboard-subscription__metric">
              <span className="dashboard-subscription__metric-label">Next billing</span>
              <span className="dashboard-subscription__metric-value">{activeSubscription.nextBillingDate}</span>
            </div>
            <div className="dashboard-subscription__metric">
              <span className="dashboard-subscription__metric-label">Time remaining</span>
              <span className="dashboard-subscription__metric-value">
                {activeSubscription.daysUntilBilling} day{activeSubscription.daysUntilBilling === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div className="dashboard-progress">
            <div className="dashboard-progress__labels">
              <span>Billing cycle progress</span>
              <span>{Math.round(activeSubscription.cycleProgress * 100)}%</span>
            </div>
            <div className="dashboard-progress__track" aria-hidden="true">
              <div
                className="dashboard-progress__bar"
                style={{ width: `${Math.max(10, Math.round(activeSubscription.cycleProgress * 100))}%` }}
              />
            </div>
          </div>

          <div className="dashboard-subscription__actions">
            <button type="button" className="dashboard-button dashboard-button--primary" onClick={handleManage}>
              <Settings2 size={16} />
              <span>Manage</span>
            </button>
            <div className="dashboard-subscription__supporting-action">
              <CirclePause size={14} />
              <span>{activeSubscription.status === 'Paused' ? 'Paused plan' : 'Pause from subscriptions'}</span>
            </div>
          </div>

          {subscriptions.length > 1 ? (
            <div className="dashboard-subscription__dots" aria-label="Subscription navigation">
              {subscriptions.map((subscription, index) => (
                <button
                  key={subscription.id}
                  type="button"
                  data-index={index}
                  className={index === activeIndex ? 'dashboard-dot dashboard-dot--active' : 'dashboard-dot'}
                  onClick={handleDotSelection}
                  aria-label={`Go to ${subscription.companyName}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="dashboard-empty">
          <CirclePause size={28} />
          <h3>No active subscriptions</h3>
          <p>Recurring billing plans will appear here as soon as they are configured.</p>
        </div>
      )}

      {isLoading ? (
        <div className="dashboard-card__loading" aria-hidden="true">
          <span className="dashboard-card__skeleton-line dashboard-card__skeleton-line--lg" />
          <span className="dashboard-card__skeleton-line dashboard-card__skeleton-line--md" />
          <span className="dashboard-card__skeleton-line dashboard-card__skeleton-line--sm" />
        </div>
      ) : null}
    </section>
  );
});

SubscriptionCardComponent.displayName = 'SubscriptionCard';

export default SubscriptionCardComponent;
