import { useMemo, useRef, useState } from 'react';
import {
  ACHIEVEMENTS,
  createProfile,
  getAchievementCompletion,
  getDaysOnPigeonChess,
  getFavoriteModifiers,
  getLockedTitles,
  getProfileLevel,
  getSelectedTitle,
  getTotalModeStats,
  getUnlockedTitles,
  getWinRate,
  saveProfile,
  updateProfile,
  type LocalProfile,
  type MatchMode,
  type ModeStats,
} from '../../profile';
import { createCircularAvatarDataUrl } from '../../profile/avatar';
import { ALL_MODIFIERS } from '../../modifiers/data';
import { playClick } from '../../sound';
import styles from './ProfileSetup.module.css';

interface ProfileSetupProps {
  profile: LocalProfile | null;
  editable?: boolean;
  onSave?: (profile: LocalProfile) => void;
  onBack: () => void;
  heading?: string;
  subtitle?: string;
}

type TabId = 'overview' | 'stats' | 'titles' | 'achievements' | 'history' | 'edit';

const REGIONS = [
  'North America',
  'South America',
  'Europe',
  'Middle East',
  'Africa',
  'East Asia',
  'South Asia',
  'Southeast Asia',
  'Oceania',
  'Local Bot Pool',
];

function getModifierName(id: string): string {
  return ALL_MODIFIERS.find(mod => mod.id === id)?.name ?? id;
}

function StatCard({
  label,
  stats,
  placeholder,
}: {
  label: string;
  stats: ModeStats;
  placeholder?: string;
}) {
  const hasGames = stats.gamesPlayed > 0;

  return (
    <article className={styles.statCard}>
      <span className={styles.statCardLabel}>{label}</span>
      {hasGames ? (
        <>
          <div className={styles.statMain}>{stats.gamesPlayed}</div>
          <div className={styles.statGrid}>
            <span>Wins {stats.wins}</span>
            <span>Losses {stats.losses}</span>
            <span>Draws {stats.draws}</span>
            <span>Win Rate {getWinRate(stats)}%</span>
          </div>
        </>
      ) : (
        <p className={styles.placeholder}>{placeholder ?? 'No data yet.'}</p>
      )}
    </article>
  );
}

export default function ProfileSetup({
  profile,
  editable = true,
  onSave,
  onBack,
  heading,
  subtitle,
}: ProfileSetupProps) {
  const seedProfile = useMemo(
    () =>
      profile ??
      createProfile({
        displayName: '',
        motto: '',
        region: 'North America',
        country: '',
        avatarDataUrl: null,
        selectedTitleId: 'title_street_pigeon',
      }),
    [profile],
  );
  const [draftName, setDraftName] = useState(profile?.displayName ?? '');
  const [draftMotto, setDraftMotto] = useState(profile?.motto ?? '');
  const [draftRegion, setDraftRegion] = useState(profile?.region ?? 'North America');
  const [draftCountry, setDraftCountry] = useState(profile?.country ?? '');
  const [draftAvatarDataUrl, setDraftAvatarDataUrl] = useState<string | null>(profile?.avatarDataUrl ?? null);
  const [draftSelectedTitleId, setDraftSelectedTitleId] = useState(profile?.selectedTitleId ?? 'title_street_pigeon');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabs: TabId[] = editable
    ? ['overview', 'stats', 'titles', 'achievements', 'history', 'edit']
    : ['overview', 'stats', 'titles', 'achievements', 'history'];
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const viewProfile = useMemo<LocalProfile>(() => ({
    ...seedProfile,
    displayName: draftName.trim() || seedProfile.displayName || 'Player',
    motto: draftMotto.trim(),
    region: draftRegion,
    country: draftCountry.trim(),
    avatarDataUrl: draftAvatarDataUrl,
    selectedTitleId: draftSelectedTitleId,
  }), [
    seedProfile,
    draftName,
    draftMotto,
    draftRegion,
    draftCountry,
    draftAvatarDataUrl,
    draftSelectedTitleId,
  ]);

  const level = getProfileLevel(viewProfile);
  const daysOn = getDaysOnPigeonChess(viewProfile);
  const selectedTitle = getSelectedTitle(viewProfile);
  const totalStats = getTotalModeStats(viewProfile);
  const unlockedTitles = getUnlockedTitles(viewProfile);
  const lockedTitles = getLockedTitles(viewProfile);
  const achievementState = getAchievementCompletion(viewProfile);
  const favoriteAllTime = getFavoriteModifiers(viewProfile, 'all');
  const favoriteRecent = getFavoriteModifiers(viewProfile, 'recent');
  const offlineHistory = viewProfile.matchHistory.filter(match => match.mode !== 'online');
  const onlineHistory = viewProfile.matchHistory.filter(match => match.mode === 'online');
  const canSave = editable && draftName.trim().length >= 2;

  const titleLabel = heading ?? (editable ? (profile ? 'Profile Hub' : 'Create Profile') : `${viewProfile.displayName} Profile`);
  const titleSub =
    subtitle ??
    (editable
      ? 'Local-only profile data for the current serverless prototype. Online sections are visible now so the structure survives future backend work.'
      : 'Read-only profile view. Online and long-term progression areas remain scaffolded for future milestones.');

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const nextAvatar = await createCircularAvatarDataUrl(file);
      setDraftAvatarDataUrl(nextAvatar);
    } finally {
      e.target.value = '';
    }
  }

  function handleSave() {
    if (!editable || !onSave || !canSave) return;

    const next = profile
      ? updateProfile(profile, {
          displayName: draftName.trim(),
          motto: draftMotto.trim(),
          region: draftRegion,
          country: draftCountry.trim(),
          avatarDataUrl: draftAvatarDataUrl,
          selectedTitleId: draftSelectedTitleId,
        })
      : saveProfile({
          displayName: draftName.trim(),
          motto: draftMotto.trim(),
          region: draftRegion,
          country: draftCountry.trim(),
          avatarDataUrl: draftAvatarDataUrl,
          selectedTitleId: draftSelectedTitleId,
        });

    onSave(next);
  }

  function renderHistoryGroup(mode: MatchMode, title: string) {
    const history = mode === 'online' ? onlineHistory : offlineHistory.filter(match => match.mode === mode || (mode === 'story' && match.mode === 'story'));
    const isOffline = mode !== 'online';

    return (
      <section className={styles.historySection}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>{title}</span>
        </div>
        {history.length === 0 ? (
          <p className={styles.placeholder}>
            {isOffline ? 'No recorded matches in this category yet.' : 'No data yet. Online history is reserved for future server-backed play.'}
          </p>
        ) : (
          <div className={styles.historyList}>
            {history.map(match => (
              <article key={match.id} className={styles.historyCard}>
                <div className={styles.historyTop}>
                  <span className={styles.historyResult}>{match.result.toUpperCase()}</span>
                  <span className={styles.historyMeta}>
                    {new Date(match.playedAt).toLocaleDateString()} · {match.opponentName}
                  </span>
                </div>
                <div className={styles.historyBody}>
                  <span>{match.mode.toUpperCase()}</span>
                  <span>{match.outcome}</span>
                  <span>{match.moveCount} moves</span>
                </div>
                <div className={styles.historyModifiers}>
                  {match.draftedModifierIds.length > 0
                    ? match.draftedModifierIds.map(id => (
                        <span key={id} className={styles.chip}>
                          {getModifierName(id)}
                        </span>
                      ))
                    : <span className={styles.placeholderInline}>No drafted modifiers</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.scroll}>
        <div className={styles.content}>
          <header className={styles.header}>
            <button
              className={styles.backBtn}
              onClick={() => {
                playClick();
                onBack();
              }}
            >
              Back
            </button>
            <div className={styles.heading}>
              <span className={styles.kicker}>{editable ? 'Local Identity' : 'Profile Viewer'}</span>
              <h2 className={styles.title}>{titleLabel}</h2>
              <p className={styles.sub}>{titleSub}</p>
            </div>
          </header>

          <section className={styles.heroCard}>
            <div className={styles.avatarShell}>
              {viewProfile.avatarDataUrl ? (
                <img src={viewProfile.avatarDataUrl} alt={`${viewProfile.displayName} avatar`} className={styles.avatarImage} />
              ) : (
                <div className={styles.avatarPlaceholder}>{viewProfile.displayName.slice(0, 1).toUpperCase() || 'P'}</div>
              )}
            </div>

            <div className={styles.heroCopy}>
              <div className={styles.heroTop}>
                <span className={styles.heroName}>{viewProfile.displayName || 'Player'}</span>
                <span className={styles.heroTitle}>{selectedTitle.name}</span>
              </div>
              <div className={styles.heroMeta}>
                <span className={styles.chip}>Level {level}</span>
                <span className={styles.chip}>ELO {viewProfile.elo}</span>
                <span className={styles.chip}>Days {daysOn}</span>
                <span className={styles.chip}>{viewProfile.region}{viewProfile.country ? ` · ${viewProfile.country}` : ''}</span>
              </div>
              <p className={styles.heroMotto}>{viewProfile.motto || 'No motto set yet.'}</p>
            </div>

            {editable ? (
              <div className={styles.heroActions}>
                <button
                  className={styles.secondaryBtn}
                  onClick={() => {
                    playClick();
                    fileInputRef.current?.click();
                  }}
                >
                  Upload Avatar
                </button>
                <button
                  className={styles.secondaryBtn}
                  onClick={() => {
                    playClick();
                    setDraftAvatarDataUrl(null);
                  }}
                >
                  Clear Avatar
                </button>
                <button
                  className={styles.primaryBtn}
                  onClick={() => {
                    playClick();
                    handleSave();
                  }}
                  disabled={!canSave}
                >
                  {profile ? 'Save Profile' : 'Create Profile'}
                </button>
                <input
                  ref={fileInputRef}
                  className={styles.fileInput}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </div>
            ) : null}
          </section>

          <div className={styles.tabBar} role="tablist">
            {tabs.map(tab => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                onClick={() => {
                  playClick();
                  setActiveTab(tab);
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <section className={styles.panel}>
            {activeTab === 'overview' && (
              <div className={styles.panelGrid}>
                <article className={styles.infoCard}>
                  <span className={styles.sectionTitle}>Current Title</span>
                  <div className={styles.infoMain}>{selectedTitle.name}</div>
                  <p className={styles.infoBody}>{selectedTitle.unlockText}</p>
                </article>

                <article className={styles.infoCard}>
                  <span className={styles.sectionTitle}>Days On Pigeon Chess</span>
                  <div className={styles.infoMain}>{daysOn}</div>
                  <p className={styles.infoBody}>Time since this local profile was first created.</p>
                </article>

                <article className={styles.infoCard}>
                  <span className={styles.sectionTitle}>Offline Favorite Modifiers</span>
                  <div className={styles.infoList}>
                    <div>
                      <span className={styles.infoMinorLabel}>All Time</span>
                      <div className={styles.inlineList}>
                        {favoriteAllTime.length > 0 ? favoriteAllTime.map(id => (
                          <span key={id} className={styles.chip}>{getModifierName(id)}</span>
                        )) : <span className={styles.placeholderInline}>No data yet</span>}
                      </div>
                    </div>
                    <div>
                      <span className={styles.infoMinorLabel}>Last 10 Games</span>
                      <div className={styles.inlineList}>
                        {favoriteRecent.length > 0 ? favoriteRecent.map(id => (
                          <span key={id} className={styles.chip}>{getModifierName(id)}</span>
                        )) : <span className={styles.placeholderInline}>No data yet</span>}
                      </div>
                    </div>
                  </div>
                </article>

                <article className={styles.infoCard}>
                  <span className={styles.sectionTitle}>Achievement Gallery</span>
                  <div className={styles.infoMain}>{achievementState.unlocked.length}/{ACHIEVEMENTS.length}</div>
                  <p className={styles.infoBody}>Local trophy room unlocked through prototype milestones.</p>
                </article>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className={styles.panelGrid}>
                <StatCard label="Overall" stats={totalStats} placeholder="No games played yet." />
                <StatCard label="Campaign / Story" stats={viewProfile.stats.modes.story} placeholder="No Campaign data yet." />
                <StatCard label="Quick Play" stats={viewProfile.stats.modes.quick} placeholder="No Quick Play data yet." />
                <StatCard label="Online" stats={viewProfile.stats.modes.online} placeholder="No data yet. Online tracking is reserved for future server-backed play." />
              </div>
            )}

            {activeTab === 'titles' && (
              <div className={styles.titleGrid}>
                <section className={styles.titleSection}>
                  <div className={styles.sectionHead}>
                    <span className={styles.sectionTitle}>Unlocked Titles</span>
                  </div>
                  <div className={styles.titleList}>
                    {unlockedTitles.map(title => {
                      const selected = title.id === draftSelectedTitleId;
                      return (
                        <button
                          key={title.id}
                          className={`${styles.titleCard} ${selected ? styles.titleCardSelected : ''}`}
                          onClick={() => {
                            if (!editable) return;
                            playClick();
                            setDraftSelectedTitleId(title.id);
                          }}
                          disabled={!editable}
                        >
                          <span className={styles.titleCardName}>{title.name}</span>
                          <span className={styles.titleCardRule}>{title.unlockText}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className={styles.titleSection}>
                  <div className={styles.sectionHead}>
                    <span className={styles.sectionTitle}>Locked Titles</span>
                  </div>
                  <div className={styles.titleList}>
                    {lockedTitles.map(title => (
                      <article key={title.id} className={`${styles.titleCard} ${styles.titleCardLocked}`}>
                        <span className={styles.titleCardName}>{title.name}</span>
                        <span className={styles.titleCardRule}>{title.unlockText}</span>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'achievements' && (
              <div className={styles.achievementGrid}>
                {ACHIEVEMENTS.map(item => {
                  const unlockedAt = viewProfile.unlockedAchievements[item.id];
                  return (
                    <article
                      key={item.id}
                      className={`${styles.achievementCard} ${unlockedAt ? styles.achievementUnlocked : styles.achievementLocked}`}
                    >
                      <span className={styles.achievementName}>{item.name}</span>
                      <span className={styles.achievementCategory}>{item.category}</span>
                      <p className={styles.achievementBody}>{item.description}</p>
                      <span className={styles.achievementMeta}>
                        {unlockedAt ? `Unlocked ${new Date(unlockedAt).toLocaleDateString()}` : 'Locked'}
                      </span>
                    </article>
                  );
                })}
              </div>
            )}

            {activeTab === 'history' && (
              <div className={styles.historyGrid}>
                {renderHistoryGroup('story', 'Offline Match History')}
                {renderHistoryGroup('online', 'Online Match History')}
              </div>
            )}

            {activeTab === 'edit' && editable && (
              <div className={styles.editGrid}>
                <label className={styles.field}>
                  <span className={styles.label}>Display Name</span>
                  <input
                    className={styles.input}
                    value={draftName}
                    maxLength={20}
                    onChange={e => setDraftName(e.target.value)}
                    placeholder="Enter player name"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Title</span>
                  <select
                    className={styles.select}
                    value={draftSelectedTitleId}
                    onChange={e => setDraftSelectedTitleId(e.target.value)}
                  >
                    {unlockedTitles.map(title => (
                      <option key={title.id} value={title.id}>
                        {title.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Region</span>
                  <select
                    className={styles.select}
                    value={draftRegion}
                    onChange={e => setDraftRegion(e.target.value)}
                  >
                    {REGIONS.map(region => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Country</span>
                  <input
                    className={styles.input}
                    value={draftCountry}
                    maxLength={32}
                    onChange={e => setDraftCountry(e.target.value)}
                    placeholder="Optional country"
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span className={styles.label}>Motto</span>
                  <textarea
                    className={styles.textarea}
                    value={draftMotto}
                    maxLength={120}
                    rows={4}
                    onChange={e => setDraftMotto(e.target.value)}
                    placeholder="Short local flavor line"
                  />
                </label>

                <div className={styles.editActions}>
                  <button
                    className={styles.secondaryBtn}
                    onClick={() => {
                      playClick();
                      fileInputRef.current?.click();
                    }}
                  >
                    Upload Avatar
                  </button>
                  <button
                    className={styles.secondaryBtn}
                    onClick={() => {
                      playClick();
                      setDraftAvatarDataUrl(null);
                    }}
                  >
                    Clear Avatar
                  </button>
                  <button
                    className={styles.primaryBtn}
                    onClick={() => {
                      playClick();
                      handleSave();
                    }}
                    disabled={!canSave}
                  >
                    {profile ? 'Save Changes' : 'Create Profile'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
