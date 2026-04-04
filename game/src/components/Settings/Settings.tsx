import { useState } from 'react';
import type { AppSettings } from '../../settings';
import { saveSettings } from '../../settings';
import styles from './Settings.module.css';

interface SettingsProps {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onBack: () => void;
}

// ── Primitive controls ──────────────────────────────────────────────────────

function Toggle({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={styles.row}>
      <div className={styles.rowBody}>
        <span className={styles.rowLabel}>{label}</span>
        {sub && <span className={styles.rowSub}>{sub}</span>}
      </div>
      <button
        role="switch"
        aria-checked={value}
        className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
        onClick={() => onChange(!value)}
        type="button"
      >
        <span className={styles.toggleThumb} />
      </button>
    </label>
  );
}

function VolumeSlider({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className={`${styles.row} ${disabled ? styles.rowDisabled : ''}`}>
      <div className={styles.rowBody}>
        <span className={styles.rowLabel}>{label}</span>
        <span className={styles.rowSub}>{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        disabled={disabled}
        className={styles.slider}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function LockedRow({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className={`${styles.row} ${styles.rowLocked}`}>
      <div className={styles.rowBody}>
        <span className={styles.rowLabel}>{label}</span>
        {sub && <span className={styles.rowSub}>{sub}</span>}
      </div>
      <span className={styles.badge}>SOON</span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function Settings({ settings: initial, onSave, onBack }: SettingsProps) {
  const [s, setS] = useState<AppSettings>(initial);

  function update(partial: Partial<AppSettings>) {
    const next = { ...s, ...partial };
    setS(next);
    saveSettings(next); // live-apply so you can hear volume changes instantly
    onSave(next);
  }

  return (
    <div className={styles.root}>
      <div className={styles.scroll}>
        <div className={styles.content}>

          {/* Header */}
          <header className={styles.header}>
            <button className={styles.backBtn} onClick={onBack}>← Back</button>
            <div className={styles.heading}>
              <h2 className={styles.title}>Settings</h2>
              <p className={styles.sub}>Changes are saved automatically</p>
            </div>
          </header>

          {/* ── Audio ──────────────────────────────────────────────────── */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>Audio</p>

            <Toggle
              label="Background Music"
              sub="Menu and in-game ambient tracks"
              value={s.bgmEnabled}
              onChange={v => update({ bgmEnabled: v })}
            />
            <VolumeSlider
              label="BGM Volume"
              value={s.bgmVolume}
              disabled={!s.bgmEnabled}
              onChange={v => update({ bgmVolume: v })}
            />
            <Toggle
              label="Sound Effects"
              sub="Move, capture, castle sounds"
              value={s.sfxEnabled}
              onChange={v => update({ sfxEnabled: v })}
            />
            <VolumeSlider
              label="SFX Volume"
              value={s.sfxVolume}
              disabled={!s.sfxEnabled}
              onChange={v => update({ sfxVolume: v })}
            />
          </section>

          {/* ── Display ────────────────────────────────────────────────── */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>Display</p>

            <Toggle
              label="Show Coordinates"
              sub="Rank and file labels on the board frame"
              value={s.showCoordinates}
              onChange={v => update({ showCoordinates: v })}
            />
            <LockedRow
              label="Board Theme"
              sub="The Crumbed Board · More themes coming"
            />
            <LockedRow
              label="Piece Set"
              sub="Classic Staunton · Illustrated sets coming"
            />
            <LockedRow
              label="Animation Speed"
              sub="Move arc, capture effects, modifier events"
            />
          </section>

          {/* ── Gameplay ───────────────────────────────────────────────── */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>Gameplay</p>

            <Toggle
              label="Show Legal Move Hints"
              sub="Dots and rings on valid destination squares"
              value={s.showLegalMoves}
              onChange={v => update({ showLegalMoves: v })}
            />
            <Toggle
              label="Auto-Queen on Promotion"
              sub="Skip the promotion modal — always promote to queen"
              value={s.autoQueen}
              onChange={v => update({ autoQueen: v })}
            />
            <Toggle
              label="Confirm Before Resign"
              sub="Show a confirmation prompt before forfeiting"
              value={s.confirmResign}
              onChange={v => update({ confirmResign: v })}
            />
            <LockedRow
              label="Clock"
              sub="Time controls for Quick Play and ranked"
            />
          </section>

          {/* ── Accessibility ──────────────────────────────────────────── */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>Accessibility</p>

            <Toggle
              label="High Contrast Pieces"
              sub="Stronger outlines on pieces for better visibility"
              value={s.highContrast}
              onChange={v => update({ highContrast: v })}
            />
            <LockedRow
              label="Colour-Blind Mode"
              sub="Alternate board and highlight palette"
            />
            <LockedRow
              label="Large Piece Mode"
              sub="Increases piece size to 130%"
            />
          </section>

          {/* ── About ──────────────────────────────────────────────────── */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>About</p>
            <div className={`${styles.row} ${styles.rowStatic}`}>
              <div className={styles.rowBody}>
                <span className={styles.rowLabel}>Pigeon Chess</span>
                <span className={styles.rowSub}>v0.1.0 · Phase 0 · Viktor Crumb's Domain</span>
              </div>
            </div>
            <div className={`${styles.row} ${styles.rowStatic}`}>
              <div className={styles.rowBody}>
                <span className={styles.rowLabel}>Audio</span>
                <span className={styles.rowSub}>
                  SFX from pigeon-chess prototype · BGM: Treasure Trove Tango (CC)
                </span>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
