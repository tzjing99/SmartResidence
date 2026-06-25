'use client';

import {
  formatHandoverSubmissionDuration,
  handoverReportEstimateSeconds,
  handoverSubmissionStatusMessage,
} from '@smartresidence/shared-types';
import { cn } from '@smartresidence/ui-web';
import { CheckCircle2, Loader2 } from 'lucide-react';
import * as React from 'react';

interface DefectSubmissionProgressProps {
  visible: boolean;
  itemCount: number;
  complete?: boolean;
}

export function DefectSubmissionProgress({
  visible,
  itemCount,
  complete = false,
}: DefectSubmissionProgressProps) {
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const estimateSec = handoverReportEstimateSeconds(itemCount);

  React.useEffect(() => {
    if (!visible) {
      setElapsedMs(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => setElapsedMs(Date.now() - started), 250);
    return () => clearInterval(id);
  }, [visible]);

  if (!visible) return null;

  const progress = complete ? 100 : Math.min(95, (elapsedMs / 1000 / estimateSec) * 100);
  const remainingSec = Math.max(0, estimateSec - elapsedMs / 1000);
  const statusMessage = handoverSubmissionStatusMessage(itemCount, elapsedMs, complete);
  const showRemaining = !complete && remainingSec >= 4 && progress < 92;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="defect-submit-progress-title"
      aria-busy={!complete}
    >
      <div
        className={cn(
          'w-full max-w-sm rounded-2xl border border-[rgb(var(--sr-border))]',
          'bg-[rgb(var(--sr-card))] p-6 shadow-xl',
        )}
      >
        <div className="flex items-start gap-3 mb-4">
          {complete ? (
            <CheckCircle2 className="size-6 shrink-0 text-emerald-500" aria-hidden />
          ) : (
            <Loader2
              className="size-6 shrink-0 animate-spin text-[rgb(var(--sr-coral))]"
              aria-hidden
            />
          )}
          <div className="min-w-0">
            <h3 id="defect-submit-progress-title" className="font-semibold text-base leading-snug">
              {complete ? 'Submitted!' : 'Submitting your defects'}
            </h3>
            <p className="text-sm sr-muted mt-1">
              {itemCount === 1 ? '1 defect' : `${itemCount} defects`} in this report
            </p>
          </div>
        </div>

        <p className="text-sm text-[rgb(var(--sr-fg))] mb-3">{statusMessage}</p>

        {!complete ? (
          <p className="text-xs sr-muted mb-4">
            Usually takes {formatHandoverSubmissionDuration(estimateSec)}
            {showRemaining ? ` · roughly ${Math.ceil(remainingSec)}s left` : null}
          </p>
        ) : null}

        <div
          className="h-2 rounded-full bg-[rgb(var(--sr-border))]/60 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label="Submission progress"
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-300 ease-out',
              complete ? 'bg-emerald-500' : 'bg-[rgb(var(--sr-coral))]',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        {!complete ? (
          <p className="text-[11px] sr-muted mt-4 leading-relaxed">
            Please keep this page open until you see confirmation.
          </p>
        ) : null}
      </div>
    </div>
  );
}
