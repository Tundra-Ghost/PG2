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

function StaticRow({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className={`${styles.row} ${styles.rowStatic}`}>
      <div className={styles.rowBody}>
        <span className={styles.rowLabel}>{label}</span>
        {sub && <span className={styles.rowSub}>{sub}</span>}
      </div>
    </div>
  );
}

// ── Tab definitions ─────────────────────────────────────────────────────────

type TabId = 'audio' | 'display' | 'gameplay' | 'accessibility' | 'about';

const TABS: { id: TabId; label: string }[] = [
  { id: 'audio',         label: 'Audio' },
  { id: 'display',       label: 'Display' },
  { id: 'gameplay',      label: 'Gameplay' },
  { id: 'accessibility', label: 'Access.' },
  { id: 'about',         label: 'About' },
];

// ── Main component ──────────────────────────────────────────────────────────

export default function Settings({ settings: initial, onSave, onBack }: SettingsProps) {
  const [s, setS] = useState<AppSettings>(initial);
  const [activeTab, setActiveTab] = useState<TabId>('audio');

  function update(partial: Partial<AppSettings>) {
    const next = { ...s, ...partial };
    setS(next);
    saveSettings(next);
    onSave(next);
  }

  return (
    <div className={styles.root}>
      {/* Backdrop — click outside to close */}
      <div className={styles.backdrop} onClick={onBack} />

      <div className={styles.box}>
        {/* ── Box header ─────────────────────────────────────── */}
        <div className={styles.boxHeader}>
          <span className={styles.boxTitle}>Settings</span>
          <button className={styles.closeBtn} onClick={onBack} aria-label="Close settings">✕</button>
        </div>

        {/* ── Tabs ───────────────────────────────────────────── */}
        <div className={styles.tabBar} role="tablist">
          {TABS.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab panels ─────────────────────────────────────── */}
        <div className={styles.panel} role="tabpanel">

          {activeTab === 'audio' && (
            <>
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
                sub="Move, capture, and castle sounds"
                value={s.sfxEnabled}
                onChange={v => update({ sfxEnabled: v })}
              />
              <VolumeSlider
                label="SFX Volume"
                value={s.sfxVolume}
                disabled={!s.sfxEnabled}
                onChange={v => update({ sfxVolume: v })}
              />
            </>
          )}

          {activeTab === 'display' && (
            <>
              <Toggle
                label="Show Coordinates"
                sub="Rank and file labels on the board frame"
                value={s.showCoordinates}
                onChange={v => update({ showCoordinates: v })}
              />
              <LockedRow label="Board Theme" sub="The Crumbed Board · More themes coming" />
              <LockedRow label="Piece Set"   sub="Classic Staunton · Illustrated sets coming" />
              <LockedRow label="Animation Speed" sub="Move arc, capture effects, modifier events" />
            </>
          )}

          {activeTab === 'gameplay' && (
            <>
              <Toggle
                label="Show Legal Move Hints"
                sub="Dots and rings on valid destination squares"
                value={s.showLegalMoves}
                onChange={v => update({ showLegalMoves: v })}
              />
              <Toggle
                label="Auto-Queen on Promotion"
                sub="Skip the modal — always promote to queen"
                value={s.autoQueen}
                onChange={v => update({ autoQueen: v })}
              />
              <Toggle
                label="Confirm Before Resign"
                sub="Show a prompt before forfeiting"
                value={s.confirmResign}
                onChange={v => update({ confirmResign: v })}
              />
              <LockedRow label="Clock" sub="Time controls for Quick Play and ranked" />
            </>
          )}

          {activeTab === 'accessibility' && (
            <>
              <Toggle
                label="High Contrast Pieces"
                sub="Stronger outlines for better readability"
                value={s.highContrast}
                onChange={v => update({ highContrast: v })}
              />
              <LockedRow label="Colour-Blind Mode"  sub="Alternate board and highlight palette" />
              <LockedRow label="Large Piece Mode"   sub="Increases piece size to 130%" />
            </>
          )}

          {activeTab === 'about' && (
            <>
              <StaticRow label="Pigeon Chess"  sub="v0.1.0 · Phase 0 · Viktor Crumb's Domain" />
              <StaticRow label="Audio Credits" sub="SFX from pigeon-chess prototype · BGM: Treasure Trove Tango (CC)" />
              <StaticRow label="Engine"        sub="Custom chess engine · Vite + React + TypeScript" />
              <StaticRow label="Modifiers"     sub="Modifier Bible v0.2 · 5 of 40 implemented" />
            </>
          )}

        </div>
      </div>
    </div>
  );
}
