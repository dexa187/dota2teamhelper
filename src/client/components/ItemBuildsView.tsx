import { useState } from 'react';
import { HeroAvatar } from './HeroAvatar';
import { ItemIcon } from './ItemIcon';
import {
  getCurrentNeutralTier,
  getNeutralTierUnlockLabel,
} from '../../shared/engine/neutralRecommender';
import type {
  GameMode,
  HeroItemBuildRecommendation,
  NeutralTier,
  PrimaryAttr,
  TeamAuraDuty,
  TeamThreatSummary,
} from '../../shared/types';

interface ItemBuildsViewProps {
  mode: GameMode;
  clockSeconds: number;
  threats: TeamThreatSummary[];
  teamDuties: TeamAuraDuty[];
  builds: HeroItemBuildRecommendation[];
}

const NEUTRAL_TIERS: NeutralTier[] = [1, 2, 3, 4];

const ATTR_LABEL: Record<PrimaryAttr, string> = {
  str: 'STR',
  agi: 'AGI',
  int: 'INT',
  all: 'UNI',
};

export function ItemBuildsView({
  mode,
  clockSeconds,
  threats,
  teamDuties,
  builds,
}: ItemBuildsViewProps) {
  const [tierFilter, setTierFilter] = useState<'auto' | NeutralTier | 'all'>('auto');

  if (builds.length === 0) {
    return (
      <div className="empty-state">
        <h2>No Allied Heroes Selected</h2>
        <p>Select heroes in the Draft tab to generate counter-item recommendations tailored against the opposing team.</p>
      </div>
    );
  }

  const liveTier = getCurrentNeutralTier(clockSeconds, mode);
  const visibleTiers: NeutralTier[] =
    tierFilter === 'auto' ? [liveTier] : tierFilter === 'all' ? NEUTRAL_TIERS : [tierFilter];

  return (
    <section aria-label="Counter-Item and Neutral Builds">
      {threats.length > 0 && (
        <div className="threat-strip" aria-label="Primary Enemy Threats">
          {threats.slice(0, 7).map((t) => (
            <span key={t.tag} className={`threat-chip ${t.severity}`}>
              <strong>{t.label}</strong>
              <span style={{ opacity: 0.8 }}>
                ({t.sources.map((s) => s.heroName).join(', ')})
              </span>
            </span>
          ))}
        </div>
      )}

      {teamDuties.length > 0 && (
        <div className="team-duties-bar" aria-label="Coordinated Team Aura Duties">
          {teamDuties.map((duty) => (
            <div key={duty.itemKey} className="duty-card">
              <ItemIcon name={duty.itemName} img={duty.itemImg} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--gold)' }}>
                  Team Duty: {duty.itemName} → {duty.carrierName} (Pos {duty.carrierPosition})
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{duty.reason}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="neutral-toolbar" role="group" aria-label="Neutral Tier Filter">
        <span className="neutral-toolbar-label">Neutral Crafting Tier:</span>
        <div className="filter-pills">
          <button
            type="button"
            className={`filter-pill${tierFilter === 'auto' ? ' active' : ''}`}
            aria-pressed={tierFilter === 'auto'}
            onClick={() => setTierFilter('auto')}
          >
            Live (T{liveTier})
          </button>
          {NEUTRAL_TIERS.map((tier) => (
            <button
              key={tier}
              type="button"
              className={`filter-pill${tierFilter === tier ? ' active' : ''}`}
              aria-pressed={tierFilter === tier}
              onClick={() => setTierFilter(tier)}
            >
              T{tier} · {getNeutralTierUnlockLabel(tier, mode)}
            </button>
          ))}
          <button
            type="button"
            className={`filter-pill${tierFilter === 'all' ? ' active' : ''}`}
            aria-pressed={tierFilter === 'all'}
            onClick={() => setTierFilter('all')}
          >
            All Tiers
          </button>
        </div>
      </div>

      <div className="builds-grid">
        {builds.map((build) => {
          const heroAttrTag = ATTR_LABEL[build.hero.primaryAttr];
          const displayedNeutrals = build.neutrals.filter((n) => visibleTiers.includes(n.tier));

          return (
            <article
              key={build.hero.id}
              className={`card${build.isMyHero ? ' card-highlight' : ''}`}
            >
              <header className="build-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <HeroAvatar hero={build.hero} width={64} height={36} showAttrDot />
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.02rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {build.hero.localizedName}
                      {build.isMyHero && (
                        <span className="status-pill" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
                          ★ My Hero
                        </span>
                      )}
                    </h2>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Pos {build.position} · {build.lane.toUpperCase()} ({build.laneLabel})
                    </div>
                  </div>
                </div>
                {mode === 'turbo' && (
                  <span className="status-pill" style={{ borderColor: 'var(--turbo-amber)', color: 'var(--turbo-amber)' }}>
                    Turbo Tempo
                  </span>
                )}
              </header>

              {build.turboNotes.length > 0 && mode === 'turbo' && (
                <div className="tag-list">
                  {build.turboNotes.map((note) => (
                    <span key={note} className="tag-pill" style={{ borderColor: 'rgba(251,146,60,0.45)', color: '#fed7aa' }}>
                      ⚡ {note}
                    </span>
                  ))}
                </div>
              )}

              <div>
                <h3 className="build-section-title">Starting &amp; Early Laning</h3>
                <div className="item-chip-row">
                  {[...build.starting, ...build.early].map((item) => (
                    <div key={item.key} className="item-chip" title={item.reason}>
                      <ItemIcon name={item.name} img={item.img} cost={item.cost} small />
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="build-section-title">Core Progression</h3>
                <div className="item-chip-row">
                  {build.core.map((item) => (
                    <div key={item.key} className="item-chip" title={item.turboNote ?? item.reason}>
                      <ItemIcon name={item.name} img={item.img} cost={item.cost} small />
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="build-section-title" style={{ color: 'var(--gold)' }}>
                  Priority Counter Items (vs. Opposing Team)
                </h3>
                {build.counters.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Add opposing heroes in the Draft tab to highlight enemy-specific counter items.
                  </p>
                ) : (
                  <div className="counter-list">
                    {build.counters.map((item) => (
                      <div key={item.key} className={`counter-row${item.isTeamDuty ? ' duty' : ''}`}>
                        <div className="counter-item-main">
                          <ItemIcon name={item.name} img={item.img} cost={item.cost} />
                          <div className="counter-item-meta">
                            <div style={{ fontSize: '0.86rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{item.name}</span>
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                {item.cost}g
                              </span>
                              {item.isTeamDuty && (
                                <span className="tag-pill" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
                                  Team Duty
                                </span>
                              )}
                            </div>
                            <div className="counter-reason">{item.reason}</div>
                          </div>
                        </div>
                        {item.countersHeroes.length > 0 && (
                          <div className="counter-targets" title="Targeted enemies">
                            {item.countersHeroes.slice(0, 3).map((target) => (
                              <HeroAvatar
                                key={target.heroId}
                                hero={{ localizedName: target.heroName, img: target.img, primaryAttr: 'all' }}
                                width={36}
                                height={20}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {displayedNeutrals.length > 0 && (
                <div>
                  <h3 className="build-section-title" style={{ color: 'var(--rune-cyan)' }}>
                    Neutral Crafting (Artifacts &amp; Enchantments)
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {displayedNeutrals.map((tierRec) => (
                      <div key={tierRec.tier} className="neutral-tier-block">
                        <div className="neutral-tier-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <strong style={{ fontSize: '0.82rem' }}>
                              Tier {tierRec.tier} · Unlocks {tierRec.unlockLabel}
                            </strong>
                            {tierRec.tier === liveTier && (
                              <span className="tag-pill neutral-active-pill">Active</span>
                            )}
                          </div>
                          <span className="tag-pill">{heroAttrTag} Pool</span>
                        </div>

                        <div className="neutral-artifacts-list" aria-label={`Tier ${tierRec.tier} Artifacts`}>
                          {tierRec.artifacts.map((artifact, idx) => (
                            <div
                              key={artifact.key}
                              className="neutral-artifact-row"
                              title={artifact.summary}
                            >
                              <div className="neutral-artifact-main">
                                <span className={`neutral-rank${idx === 0 ? ' top' : ''}`}>#{idx + 1}</span>
                                <ItemIcon name={artifact.name} img={artifact.img} small />
                                <div className="neutral-artifact-meta">
                                  <div className="neutral-artifact-title">
                                    <span>{artifact.name}</span>
                                    <span className="tag-pill neutral-pool-pill">Pool {artifact.pool}</span>
                                  </div>
                                  <div className="neutral-artifact-reason">{artifact.reason}</div>
                                  <div className="neutral-artifact-summary">{artifact.summary}</div>
                                </div>
                              </div>
                              {artifact.countersHeroes.length > 0 && (
                                <div className="counter-targets" title="Counters enemies">
                                  {artifact.countersHeroes.slice(0, 3).map((target) => (
                                    <HeroAvatar
                                      key={target.heroId}
                                      hero={{ localizedName: target.heroName, img: target.img, primaryAttr: 'all' }}
                                      width={32}
                                      height={18}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {tierRec.enchantments.length > 0 && (
                          <div className="neutral-enchant-grid" aria-label={`Tier ${tierRec.tier} Enchantments`}>
                            {tierRec.enchantments.map((ench, idx) => (
                              <div key={ench.key} className="neutral-enchant-card">
                                <div className="neutral-enchant-head">
                                  <span className={`neutral-rank${idx === 0 ? ' top' : ''}`}>#{idx + 1}</span>
                                  <ItemIcon name={ench.name} img={ench.img} small />
                                  <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{ench.name}</span>
                                  {ench.isAttrExclusive && (
                                    <span className="tag-pill neutral-attr-pill">{heroAttrTag}</span>
                                  )}
                                </div>
                                <div className="neutral-enchant-stats">{ench.stats}</div>
                                {ench.tradeoff && (
                                  <div className="neutral-tradeoff">Drawback: {ench.tradeoff}</div>
                                )}
                                <div className="neutral-enchant-reason">{ench.reason}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {build.late.length > 0 && (
                <div>
                  <h3 className="build-section-title">Late Game &amp; Luxury</h3>
                  <div className="item-chip-row">
                    {build.late.map((item) => (
                      <div key={item.key} className="item-chip" title={item.turboNote ?? item.reason}>
                        <ItemIcon name={item.name} img={item.img} cost={item.cost} small />
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
