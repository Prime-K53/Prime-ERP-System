import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/80 ${className || ''}`} />;
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="h-full overflow-auto bg-[#F5F7FA] p-6">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5">
        <div className="rounded-[24px] border border-slate-200/70 bg-white/90 p-4 shadow-[0_24px_40px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Skeleton className="h-11 w-full max-w-[520px] rounded-full" />
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-12 w-44 rounded-full" />
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200/70 bg-white/90 p-7 shadow-[0_24px_40px_rgba(15,23,42,0.06)]">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-10 w-3/4" />
          <Skeleton className="mt-3 h-4 w-full max-w-[560px]" />
          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Skeleton className="h-12 w-full max-w-[320px] rounded-full" />
            <Skeleton className="h-10 w-44 rounded-full" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="rounded-[24px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_24px_40px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-4 h-10 w-40" />
                </div>
                <Skeleton className="h-12 w-12" />
              </div>
              <Skeleton className="mt-10 h-3 w-full" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="rounded-[24px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_24px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="mt-3 h-3 w-64" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>
            </div>
            <Skeleton className="mt-6 h-[340px] w-full rounded-[20px]" />
          </div>

          <div className="rounded-[24px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_24px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-3 h-3 w-48" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-9" />
                <Skeleton className="h-9 w-9" />
              </div>
            </div>
            <Skeleton className="mt-6 h-40 w-full rounded-[22px]" />
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Skeleton className="h-20 w-full rounded-[18px]" />
              <Skeleton className="h-20 w-full rounded-[18px]" />
            </div>
            <Skeleton className="mt-6 h-10 w-full rounded-full" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="rounded-[24px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_24px_40px_rgba(15,23,42,0.06)]">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-3 h-3 w-48" />
              <div className="mt-6 space-y-3">
                {[1, 2, 3, 4].map((row) => (
                  <Skeleton key={row} className="h-14 w-full rounded-[18px]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
