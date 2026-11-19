import { HeroAvatar } from './HeroAvatar';
import type { Faction, GameMode, LaneMatchupPlan, LaneName, Position } from '../../shared/types';

interface LaneViewProps {
  plan: LaneMatchupPlan;
  faction: Faction;
  mode: GameMode;
  allyCount: number;
  enemyCount: number;
  onSetLockedPosition: (pos: Position, heroId: number | null) => void;
  onUnlockAll: () => void;
}

const LANE_ORDER: LaneName[] = ['top', 'mid', 'bot'];
const POS_LABELS: Record<Position, string> = {
  1: 'Pos 1 (Carry)',
  2: 'Pos 2 (Mid)',
  3: 'Pos 3 (Offlane)',
  4: 'Pos 4 (Soft Sup)',
  5: 'Pos 5 (Hard Sup)',
};

export function LaneView({
  plan,
  faction,
  mode,
  allyCount,
  enemyCount,
  onSetLockedPosition,
  onUnlockAll,
}: LaneViewProps) {
  if (allyCount === 0) {
    return (
      <div className="empty-state">
        <h2>No Allied Heroes Selected</h2>
        <p>Pick up to 5 heroes for Your Team in the Draft tab to calculate optimal lane assignments and matchups.</p>
      </div>
    );
  }

  const hasLocks = LANE_ORDER.some((l) => plan.lanes[l].allies.some((a) => a.locked));

  return (
    <section aria-label="Lane Recommendations">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Side: <strong style={{ color: faction === 'radiant' ? 'var(--radiant)' : 'var(--dire)' }}>{faction.toUpperCase()}</strong>
          {' · '}
          Mode: <strong style={{ color: mode === 'turbo' ? 'var(--turbo-amber)' : 'var(--text-primary)' }}>{mode === 'turbo' ? 'Turbo' : 'Regular'}</strong>
          {enemyCount === 0 && ' · Tip: Add opposing heroes in Draft for matchup scores'}
        </div>
        {hasLocks && (
          <button type="button" className="btn btn-sm" onClick={onUnlockAll}>
            Unlock All Positions
          </button>
        )}
      </div>

      {plan.swapRecommendation && (
        <div className="callout-banner" role="status">
          <strong>Flex / Lane Swap Tip: </strong>
          {plan.swapRecommendation.message}
        </div>
      )}

      <div className="lanes-grid">
        {LANE_ORDER.map((laneKey) => {
          const lane = plan.lanes[laneKey];
          return (
            <article key={lane.lane} className="card">
              <div className="lane-header">
                <h2 className="lane-title">
                  <span>{lane.lane.toUpperCase()}</span>
                  <span style={{ color: 'var(--gold)', fontSize: '0.88rem' }}>({lane.label})</span>
                </h2>
                <span className={`rating-badge rating-${lane.matchupRating}`}>
                  {lane.matchupRating} ({lane.score >= 0 ? `+${lane.score}` : lane.score})
                </span>
              </div>

              <div className="matchup-split">
                <div className="lane-side-box">
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--radiant)', textTransform: 'uppercase' }}>
                    Your Lane
                  </div>
                  {lane.allies.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Unassigned</span>
                  ) : (
                    lane.allies.map((slot) => (
                      <div key={slot.hero.id} className="lane-hero-row">
                        <div className="lane-hero-info">
                          <HeroAvatar hero={slot.hero} width={48} height={27} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>{slot.hero.localizedName}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                              {POS_LABELS[slot.position]} · Fit {slot.suitabilityScore}/10
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <select
                            className="pos-select"
                            aria-label={`Lock position for ${slot.hero.localizedName}`}
                            value={slot.locked ? String(slot.position) : 'auto'}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'auto') {
                                onSetLockedPosition(slot.position, null);
                              } else {
                                const newPos = Number(val) as Position;
                                if (slot.locked) {
                                  onSetLockedPosition(slot.position, null);
                                }
                                onSetLockedPosition(newPos, slot.hero.id);
                              }
                            }}
                          >
                            <option value="auto">Auto (Pos {slot.position})</option>
                            <option value="1">Lock Pos 1</option>
                            <option value="2">Lock Pos 2</option>
                            <option value="3">Lock Pos 3</option>
                            <option value="4">Lock Pos 4</option>
                            <option value="5">Lock Pos 5</option>
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="lane-side-box">
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dire)', textTransform: 'uppercase' }}>
                    Predicted Opponents
                  </div>
                  {lane.enemies.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No enemy predicted</span>
                  ) : (
                    lane.enemies.map((enemy) => (
                      <div key={enemy.hero.id} className="lane-hero-row">
                        <div className="lane-hero-info">
                          <HeroAvatar hero={enemy.hero} width={48} height={27} />
                          <div>
                            <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>{enemy.hero.localizedName}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                              Est. Pos {enemy.position}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {lane.synergyTags.length > 0 && (
                <div className="tag-list">
                  {lane.synergyTags.map((tag) => (
                    <span key={tag} className="tag-pill">
                      ✓ {tag}
                    </span>
                  ))}
                </div>
              )}

              {lane.threatWarnings.length > 0 && (
                <div className="tag-list">
                  {lane.threatWarnings.map((warn) => (
                    <span key={warn} className="tag-pill" style={{ borderColor: 'rgba(248,113,113,0.45)', color: '#fecaca' }}>
                      ⚠ {warn}
                    </span>
                  ))}
                </div>
              )}

              <div>
                <h3 className="build-section-title">Laning Gameplan</h3>
                <ul className="gameplan-list">
                  {lane.gameplan.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
