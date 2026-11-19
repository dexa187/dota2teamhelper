import { formatClock } from '../../shared/engine/cueScheduler';
import type { FiredCueBatch } from '../../shared/types';

interface CueToastBannerProps {
  batch: FiredCueBatch | null;
  onDismiss: () => void;
}

export function CueToastBanner({ batch, onDismiss }: CueToastBannerProps) {
  if (!batch) return null;

  return (
    <aside className="cue-toast-bar" role="status" aria-live="polite">
      <div>
        <div className="cue-toast-title">
          {batch.title} ({formatClock(batch.firedAtClock)})
        </div>
        <div className="cue-toast-body">{batch.spokenText}</div>
      </div>
      <button type="button" className="btn btn-sm" onClick={onDismiss} aria-label="Dismiss cue notification">
        Dismiss
      </button>
    </aside>
  );
}
