import { useMemo, useState } from 'react';
import { HeroAvatar } from './HeroAvatar';
import type {
  DraftState,
  Faction,
  HeroRecord,
  PrimaryAttr,
  RoomHeroClaim,
  TeamThreatSummary,
} from '../../shared/types';

interface DraftBoardProps {
  heroes: HeroRecord[];
  draft: DraftState;
  threats: TeamThreatSummary[];
  heroClaims?: Record<number, RoomHeroClaim>;
  currentClientId?: string;
  onSetFaction: (faction: Faction) => void;
  onAddHero: (side: 'ally' | 'enemy', heroId: number) => void;
  onRemoveHero: (side: 'ally' | 'enemy', heroId: number) => void;
  onSetMyHero: (heroId: number | null) => void;
  onClearDraft: () => void;
  onLoadSampleDraft: () => void;
}

type RoleFilter = 'all' | 'carry' | 'mid' | 'offlane' | 'support';

export function DraftBoard({
  heroes,
  draft,
  threats,
  heroClaims,
  currentClientId,
  onSetFaction,
  onAddHero,
  onRemoveHero,
  onSetMyHero,
  onClearDraft,
  onLoadSampleDraft,
}: DraftBoardProps) {
  const [pickTarget, setPickTarget] = useState<'ally' | 'enemy'>('ally');
  const [search, setSearch] = useState('');
  const [attrFilter, setAttrFilter] = useState<PrimaryAttr | 'all_attrs'>('all_attrs');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const heroMap = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const allySet = useMemo(() => new Set(draft.allies), [draft.allies]);
  const enemySet = useMemo(() => new Set(draft.enemies), [draft.enemies]);

  const filteredHeroes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return heroes.filter((h) => {
      if (attrFilter !== 'all_attrs' && h.primaryAttr !== attrFilter) return false;
      if (roleFilter === 'carry' && h.posScores[0] < 6) return false;
      if (roleFilter === 'mid' && h.posScores[1] < 6) return false;
      if (roleFilter === 'offlane' && h.posScores[2] < 6) return false;
      if (roleFilter === 'support' && h.posScores[3] < 6 && h.posScores[4] < 6) return false;

      if (!q) return true;
      if (h.localizedName.toLowerCase().includes(q)) return true;
      if (h.name.toLowerCase().includes(q)) return true;
      return h.aliases.some((alias) => alias.toLowerCase().includes(q));
    });
  }, [heroes, search, attrFilter, roleFilter]);

  const handleHeroTileClick = (hero: HeroRecord) => {
    if (allySet.has(hero.id)) {
      onRemoveHero('ally', hero.id);
      return;
    }
    if (enemySet.has(hero.id)) {
      onRemoveHero('enemy', hero.id);
      return;
    }
    if (pickTarget === 'ally') {
      if (draft.allies.length < 5) {
        onAddHero('ally', hero.id);
        if (draft.allies.length === 4 && draft.enemies.length < 5) {
          setPickTarget('enemy');
        }
      }
    } else if (draft.enemies.length < 5) {
      onAddHero('enemy', hero.id);
    }
  };

  return (
    <section aria-label="Hero Draft Builder">
      <div className="draft-teams-grid">
        {/* Allied Team */}
        <div className="team-panel ally-panel">
          <div className="team-panel-header">
            <div>
              <strong>Your Team ({draft.allies.length}/5)</strong>
              <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: '0.84rem' }}>
                Side:
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm${draft.faction === 'radiant' ? ' btn-radiant' : ''}`}
                onClick={() => onSetFaction('radiant')}
              >
                Radiant (Safe = Bot)
              </button>
              <button
                type="button"
                className={`btn btn-sm${draft.faction === 'dire' ? ' btn-danger' : ''}`}
                onClick={() => onSetFaction('dire')}
              >
                Dire (Safe = Top)
              </button>
            </div>
          </div>

          <div className="team-slots">
            {Array.from({ length: 5 }).map((_, idx) => {
              const heroId = draft.allies[idx];
              const hero = heroId ? heroMap.get(heroId) : undefined;
              const isMe = hero && draft.myHeroId === hero.id;
              const claim = hero && heroClaims ? heroClaims[hero.id] : undefined;
              const claimedByOther = Boolean(claim && claim.clientId !== currentClientId);
              return (
                <div
                  key={`ally-slot-${idx}`}
                  className={`draft-slot${hero ? ' filled' : ''}${isMe ? ' is-me' : ''}`}
                >
                  {hero ? (
                    <>
                      <HeroAvatar hero={hero} width={64} height={36} showAttrDot />
                      <span className="slot-name">{hero.localizedName}</span>
                      {claimedByOther && claim && (
                        <span className="claim-badge" title={`Claimed by ${claim.playerName}`}>
                          {claim.playerName}
                        </span>
                      )}
                      <div className="slot-actions">
                        <button
                          type="button"
                          className={`icon-btn${isMe ? ' starred' : ''}`}
                          title="Mark as My Hero (pins your item build first)"
                          onClick={() => onSetMyHero(isMe ? null : hero.id)}
                        >
                          {isMe ? '★ Me' : '☆ Me'}
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          title={`Remove ${hero.localizedName}`}
                          onClick={() => onRemoveHero('ally', hero.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setPickTarget('ally')}
                    >
                      + Ally {idx + 1}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Enemy Team */}
        <div className="team-panel enemy-panel">
          <div className="team-panel-header">
            <strong>Opposing Team ({draft.enemies.length}/5)</strong>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn btn-sm btn-gold" onClick={onLoadSampleDraft}>
                Load Sample 5v5
              </button>
              <button type="button" className="btn btn-sm" onClick={onClearDraft}>
                Clear All
              </button>
            </div>
          </div>

          <div className="team-slots">
            {Array.from({ length: 5 }).map((_, idx) => {
              const heroId = draft.enemies[idx];
              const hero = heroId ? heroMap.get(heroId) : undefined;
              return (
                <div key={`enemy-slot-${idx}`} className={`draft-slot${hero ? ' filled' : ''}`}>
                  {hero ? (
                    <>
                      <HeroAvatar hero={hero} width={64} height={36} showAttrDot />
                      <span className="slot-name">{hero.localizedName}</span>
                      <div className="slot-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          title={`Remove ${hero.localizedName}`}
                          onClick={() => onRemoveHero('enemy', hero.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setPickTarget('enemy')}
                    >
                      + Enemy {idx + 1}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Enemy Threat Summary */}
      {threats.length > 0 && (
        <div className="threat-strip" aria-label="Detected Enemy Threats">
          {threats.slice(0, 6).map((t) => (
            <span key={t.tag} className={`threat-chip ${t.severity}`}>
              <span>{t.label}</span>
              <span style={{ opacity: 0.8 }}>
                ({t.sources.map((s) => s.heroName).join(', ')})
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Search & Filters */}
      <div className="picker-toolbar">
        <div className="target-toggle" role="group" aria-label="Pick Target Team">
          <button
            type="button"
            className={pickTarget === 'ally' ? 'pick-ally' : ''}
            onClick={() => setPickTarget('ally')}
          >
            Picking: Your Team
          </button>
          <button
            type="button"
            className={pickTarget === 'enemy' ? 'pick-enemy' : ''}
            onClick={() => setPickTarget('enemy')}
          >
            Picking: Opposing Team
          </button>
        </div>

        <input
          type="search"
          className="search-input"
          aria-label="Search heroes by name or alias"
          placeholder="Search hero or alias (e.g. PA, BB, AM, QoP, ES)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="filter-pills" role="group" aria-label="Primary Attribute Filter">
          {(
            [
              ['all_attrs', 'All Attr'],
              ['str', 'STR'],
              ['agi', 'AGI'],
              ['int', 'INT'],
              ['all', 'UNI'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`filter-pill${attrFilter === key ? ' active' : ''}`}
              onClick={() => setAttrFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="filter-pills" role="group" aria-label="Role Filter">
          {(
            [
              ['all', 'All Roles'],
              ['carry', 'Carry'],
              ['mid', 'Mid'],
              ['offlane', 'Offlane'],
              ['support', 'Support'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`filter-pill${roleFilter === key ? ' active' : ''}`}
              onClick={() => setRoleFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Hero Grid */}
      <div className="hero-grid" aria-label="Hero Roster">
        {filteredHeroes.map((hero) => {
          const isAlly = allySet.has(hero.id);
          const isEnemy = enemySet.has(hero.id);
          return (
            <button
              key={hero.id}
              type="button"
              className={`hero-tile${isAlly ? ' picked-ally' : ''}${isEnemy ? ' picked-enemy' : ''}`}
              onClick={() => handleHeroTileClick(hero)}
            >
              <HeroAvatar hero={hero} width={84} height={47} showAttrDot />
              <span className="hero-tile-name">{hero.localizedName}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
