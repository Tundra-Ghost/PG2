import { useMemo, useState } from 'react';
import type { LocalProfile } from '../../profile';
import { ALL_MODIFIERS } from '../../modifiers/data';
import { saveProfile } from '../../profile';
import styles from './ProfileSetup.module.css';

interface ProfileSetupProps {
  profile: LocalProfile | null;
  onSave: (profile: LocalProfile) => void;
  onBack: () => void;
}

export default function ProfileSetup({ profile, onSave, onBack }: ProfileSetupProps) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [motto, setMotto] = useState(profile?.motto ?? '');
  const trimmedName = displayName.trim();
  const canSubmit = trimmedName.length >= 2;
  const heading = profile ? 'Edit Profile' : 'Create Profile';
  const favoriteModifierName = profile?.stats.favoriteModifierId
    ? (ALL_MODIFIERS.find(mod => mod.id === profile.stats.favoriteModifierId)?.name ?? 'Unknown')
    : 'None yet';
  const helper = useMemo(() => {
    if (trimmedName.length === 0) return 'Choose the name the prototype should use for local runs.';
    if (trimmedName.length < 2) return 'Profile name must be at least 2 characters.';
    return 'Saved locally on this device. No server account required.';
  }, [trimmedName]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    onSave(saveProfile({ displayName: trimmedName, motto }));
  }

  return (
    <div className={styles.root}>
      <div className={styles.scroll}>
        <div className={styles.content}>
          <header className={styles.header}>
            <button className={styles.backBtn} onClick={onBack}>
              Back
            </button>
            <div className={styles.heading}>
              <span className={styles.kicker}>Local Identity</span>
              <h2 className={styles.title}>{heading}</h2>
              <p className={styles.sub}>
                TDD/GDD note: this profile is local-only until the project leaves the current serverless prototype phase.
              </p>
            </div>
          </header>

          <section className={styles.card}>
            <div className={styles.preview}>
              <span className={styles.previewLabel}>Preview</span>
              <div className={styles.previewName}>{trimmedName || 'Unnamed Pigeon'}</div>
              <div className={styles.previewMotto}>{motto.trim() || 'No motto set yet.'}</div>
              {profile ? (
                <div className={styles.statsBlock}>
                  <span className={styles.statChip}>Runs {profile.stats.runsPlayed}</span>
                  <span className={styles.statChip}>Wins {profile.stats.wins}</span>
                  <span className={styles.statChip}>Favorite {favoriteModifierName}</span>
                </div>
              ) : null}
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.field}>
                <span className={styles.label}>Display Name</span>
                <input
                  className={styles.input}
                  value={displayName}
                  maxLength={20}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Enter player name"
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Motto</span>
                <textarea
                  className={styles.textarea}
                  value={motto}
                  maxLength={80}
                  rows={3}
                  onChange={e => setMotto(e.target.value)}
                  placeholder="Short local flavor line"
                />
              </label>

              <p className={styles.helper}>{helper}</p>

              <div className={styles.actions}>
                <button type="button" className={styles.secondaryBtn} onClick={onBack}>
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={!canSubmit}>
                  {profile ? 'Update Profile' : 'Create Profile'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
