import { useEffect, useState } from 'react';
import type { HudSnapshot } from '../engine/FencingScene';
import { LEVELS, STRIKE_ZONES } from '../game/levels';
import type { DefenseAction } from '../game/types';

interface CombatHudProps {
  hud: HudSnapshot;
  muted: boolean;
  hapticsEnabled: boolean;
  onToggleMute: () => void;
  onToggleHaptics: () => void;
  onPause: () => void;
  onTouchDefense: (defense: DefenseAction) => void;
}

export function CombatHud({
  hud,
  muted,
  hapticsEnabled,
  onToggleMute,
  onToggleHaptics,
  onPause,
  onTouchDefense,
}: CombatHudProps) {
  const level = LEVELS[hud.levelIndex];

  // Delayed trailing ghost bars for player & enemy HP
  const [playerGhostHp, setPlayerGhostHp] = useState(hud.playerHp);
  const [enemyGhostHp, setEnemyGhostHp] = useState(hud.enemyHp);

  useEffect(() => {
    const t = window.setTimeout(() => setPlayerGhostHp(hud.playerHp), 280);
    return () => clearTimeout(t);
  }, [hud.playerHp]);

  useEffect(() => {
    const t = window.setTimeout(() => setEnemyGhostHp(hud.enemyHp), 280);
    return () => clearTimeout(t);
  }, [hud.enemyHp]);

  const playerHpPct = Math.max(0, Math.min(100, (hud.playerHp / hud.playerMaxHp) * 100));
  const playerGhostPct = Math.max(playerHpPct, Math.min(100, (playerGhostHp / hud.playerMaxHp) * 100));
  const playerStamPct = Math.max(0, Math.min(100, (hud.playerStamina / hud.playerMaxStamina) * 100));

  const enemyHpPct = Math.max(0, Math.min(100, (hud.enemyHp / hud.enemyMaxHp) * 100));
  const enemyGhostPct = Math.max(enemyHpPct, Math.min(100, (enemyGhostHp / hud.enemyMaxHp) * 100));
  const enemyStamPct = Math.max(0, Math.min(100, (hud.enemyStamina / hud.enemyMaxStamina) * 100));

  const telegraphDef = hud.enemyTelegraphZone ? STRIKE_ZONES[hud.enemyTelegraphZone] : null;
  const hoveredDef = hud.hoveredZone ? STRIKE_ZONES[hud.hoveredZone] : null;
  const lowHpDanger = hud.playerHp <= 30 && hud.playerHp > 0;

  const formatClock = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
      {/* Subtle low-HP crimson peripheral vignette */}
      {lowHpDanger && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 95px rgba(175, 22, 28, 0.55)',
          }}
        />
      )}

      {/* TOP PERIMETER CLUSTERS */}
      <div className="flex items-start justify-between gap-1.5 sm:gap-4">
        {/* TOP-LEFT: PLAYER VITALITY & STAMINA */}
        <div
          className="flex-1 min-w-0 max-w-[165px] sm:max-w-[270px] px-2.5 sm:px-3 py-2 sm:py-2.5 border border-[#6e5a3b] shadow-[0_6px_20px_rgba(0,0,0,0.65)]"
          style={{ backgroundColor: 'rgba(15, 13, 11, 0.86)' }}
        >
          <div className="flex items-center justify-between gap-1.5 mb-1">
            <div className="flex items-center gap-1 min-w-0">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true">
                <path
                  d="M12 2 L19 5 V12 C19 16.5 12 21 12 21 C12 21 5 16.5 5 12 V5 Z"
                  fill="#8f2426"
                  stroke="#e0b55c"
                  strokeWidth="1.8"
                />
                <path d="M12 6 V16 M8.5 10.5 H15.5" stroke="#f7ebd4" strokeWidth="1.8" />
              </svg>
              <span className="font-display text-[10px] sm:text-xs font-bold tracking-[0.06em] sm:tracking-[0.14em] text-[#efe5d2] uppercase truncate">
                You
              </span>
            </div>
            <span className="tabular-nums text-xs sm:text-base font-bold text-[#faf2e3] shrink-0">
              {hud.playerHp}
            </span>
          </div>

          {/* Health Bar + Ghost */}
          <div className="relative h-2 sm:h-2.5 bg-[#241e19] border border-[#4a3e30] overflow-hidden mb-1.5 sm:mb-2">
            <div
              className="absolute inset-y-0 left-0 bg-[#f0c774] transition-[width] duration-300 ease-out"
              style={{ width: `${playerGhostPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-[#b32b2d] transition-[width] duration-100"
              style={{ width: `${playerHpPct}%` }}
            />
          </div>

          {/* Stamina Bar */}
          <div className="flex items-center justify-between text-[9px] sm:text-[10px] tracking-[0.08em] sm:tracking-[0.14em] uppercase text-[#c7b89c] mb-0.5">
            <span>Stamina</span>
            <span className="tabular-nums font-semibold text-[#e8d9bd]">{hud.playerStamina}</span>
          </div>
          <div className="relative h-1.5 bg-[#1b1814] border border-[#3e3428] overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 transition-[width] duration-75 ${
                hud.playerStamina < 16 ? 'bg-[#d9603b]' : 'bg-[#d4a34a]'
              }`}
              style={{ width: `${playerStamPct}%` }}
            />
          </div>

          {/* Riposte / Guard state */}
          {hud.riposteActive && (
            <div className="mt-1.5 text-[10px] sm:text-[11px] font-display font-bold tracking-[0.12em] text-[#ffd773] uppercase">
              Riposte Ready · 1.6×
            </div>
          )}
        </div>

        {/* TOP-CENTER: ARENA & CLOCK */}
        <div
          className="hidden md:flex flex-col items-center px-4 py-1.5 border border-[#544632] shadow-[0_4px_14px_rgba(0,0,0,0.55)]"
          style={{ backgroundColor: 'rgba(15, 13, 11, 0.82)' }}
        >
          <span className="font-display text-xs font-bold tracking-[0.14em] text-[#e5cfa4] uppercase">
            {level.name}
          </span>
          <div className="flex items-center gap-3 text-[11px] text-[#afa088] mt-0.5 tabular-nums">
            <span>{formatClock(hud.stats.elapsedSeconds)}</span>
            {hud.stats.comboStreak > 1 && (
              <span className="text-[#ffd275] font-semibold">
                {hud.stats.comboStreak}× Chain
              </span>
            )}
          </div>
        </div>

        {/* TOP-RIGHT: ENEMY VITALITY, STAMINA & UTILITY BUTTONS */}
        <div className="flex items-start gap-1.5 sm:gap-2 flex-1 sm:flex-initial justify-end min-w-0">
          <div
            className="flex-1 min-w-0 max-w-[165px] sm:w-[270px] sm:max-w-[270px] px-2.5 sm:px-3 py-2 sm:py-2.5 border border-[#6e5a3b] shadow-[0_6px_20px_rgba(0,0,0,0.65)]"
            style={{ backgroundColor: 'rgba(15, 13, 11, 0.86)' }}
          >
            <div className="flex items-center justify-between gap-1.5 mb-1">
              <span className="tabular-nums text-xs sm:text-base font-bold text-[#faf2e3] shrink-0">
                {hud.enemyHp}
              </span>
              <div className="text-right min-w-0">
                <div className="font-display text-[10px] sm:text-xs font-bold tracking-[0.06em] sm:tracking-[0.12em] text-[#efe5d2] uppercase truncate">
                  {level.enemyName}
                </div>
              </div>
            </div>

            {/* Enemy HP + Ghost */}
            <div className="relative h-2 sm:h-2.5 bg-[#241e19] border border-[#4a3e30] overflow-hidden mb-1.5 sm:mb-2">
              <div
                className="absolute inset-y-0 right-0 bg-[#f0c774] transition-[width] duration-300 ease-out"
                style={{ width: `${enemyGhostPct}%` }}
              />
              <div
                className="absolute inset-y-0 right-0 bg-[#9e3336] transition-[width] duration-100"
                style={{ width: `${enemyHpPct}%` }}
              />
            </div>

            {/* Enemy Stamina */}
            <div className="flex items-center justify-between text-[9px] sm:text-[10px] tracking-[0.08em] sm:tracking-[0.14em] uppercase text-[#c7b89c] mb-0.5">
              <span className="tabular-nums font-semibold text-[#e8d9bd]">{hud.enemyStamina}</span>
              <span className="truncate">Stamina</span>
            </div>
            <div className="relative h-1.5 bg-[#1b1814] border border-[#3e3428] overflow-hidden">
              <div
                className="absolute inset-y-0 right-0 bg-[#7fb8d4] transition-[width] duration-75"
                style={{ width: `${enemyStamPct}%` }}
              />
            </div>

            <div className="hidden sm:block mt-1 text-[10px] text-[#a5967e] text-right truncate">
              {level.combatStyle}
            </div>
          </div>

          {/* Compact Utility Icon Buttons */}
          <div className="flex flex-col gap-1.5 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              title={muted ? 'Unmute [M]' : 'Mute [M]'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-8 h-8 flex items-center justify-center border border-[#5e4d34] text-[#e6d7bc] hover:border-[#d4a34a] hover:text-white cursor-pointer"
              style={{ backgroundColor: 'rgba(15, 13, 11, 0.86)' }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" fillOpacity="0.2" />
                {muted ? (
                  <path d="M22 9l-6 6M16 9l6 6" />
                ) : (
                  <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
                )}
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label={hapticsEnabled ? 'Disable mobile haptics' : 'Enable mobile haptics'}
              title={hapticsEnabled ? 'Haptics On' : 'Haptics Off'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleHaptics();
              }}
              className={`w-8 h-8 flex items-center justify-center border cursor-pointer ${
                hapticsEnabled
                  ? 'border-[#5e4d34] text-[#e6d7bc] hover:border-[#d4a34a]'
                  : 'border-[#3a3125] text-[#756958]'
              }`}
              style={{ backgroundColor: 'rgba(15, 13, 11, 0.86)' }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="7" y="4" width="10" height="16" rx="2" />
                <path d="M3 9v6M21 9v6" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause duel"
              title="Pause [Esc]"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="w-8 h-8 flex items-center justify-center border border-[#5e4d34] text-[#e6d7bc] hover:border-[#d4a34a] hover:text-white cursor-pointer"
              style={{ backgroundColor: 'rgba(15, 13, 11, 0.86)' }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" />
                <rect x="14" y="5" width="4" height="14" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* INCOMING ENEMY TELEGRAPH ALERT (TOP-MID-HIGH, CLEAR OF CENTER) */}
      <div className="relative flex-1 flex flex-col items-center pointer-events-none">
        {telegraphDef && (
          <div
            className="mt-3 px-4 py-1.5 border border-[#d64545] shadow-[0_4px_16px_rgba(0,0,0,0.75)] flex items-center gap-2.5"
            style={{ backgroundColor: 'rgba(34, 12, 12, 0.9)' }}
          >
            <span className="font-display text-xs font-bold tracking-[0.14em] text-[#ffb8b8]">
              {telegraphDef.telegraphLabel}
            </span>
            <span className="px-1.5 py-0.5 bg-[#d64545] text-[#fff5f5] text-[11px] font-bold tracking-wider">
              [{telegraphDef.defenseHintKey}]{' '}
              {telegraphDef.defenseHintKey === 'S' ? 'RETREAT' : 'BLOCK'}
            </span>
          </div>
        )}

        {/* FLOATING COMBAT CALLOUT */}
        {hud.callout && (
          <div
            key={hud.callout.id}
            className={`mt-4 font-display text-lg sm:text-2xl font-extrabold tracking-[0.15em] uppercase text-stroke-dark ${
              hud.callout.tone === 'gold'
                ? 'text-[#ffd875]'
                : hud.callout.tone === 'crimson'
                  ? 'text-[#ff6b6b]'
                  : hud.callout.tone === 'cyan'
                    ? 'text-[#7ce0ff]'
                    : 'text-[#f3ece0]'
            }`}
          >
            {hud.callout.text}
          </div>
        )}

        {/* PROJECTED HOVER RETICLE OVER ENEMY ZONE */}
        {hoveredDef && hud.hoveredScreenPos && (
          <div
            className="fixed -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center"
            style={{
              left: `${hud.hoveredScreenPos.x}px`,
              top: `${hud.hoveredScreenPos.y}px`,
            }}
          >
            <div className="w-8 h-8 border-2 border-[#f2ca6b] rotate-45 flex items-center justify-center shadow-[0_0_8px_rgba(0,0,0,0.8)]">
              <div className="w-1.5 h-1.5 bg-[#f2ca6b]" />
            </div>
            <span className="mt-1.5 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase text-[#fff3d6] bg-[#14110e]/85 border border-[#8a6d3b] whitespace-nowrap">
              {hoveredDef.label}
            </span>
          </div>
        )}
      </div>

      {/* BOTTOM ERGONOMIC DEFENSE STRIP (KEYBOARD INDICATOR + MOBILE TOUCH BUTTONS) */}
      <div className="flex flex-col items-center gap-1.5 pointer-events-none">
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          {(
            [
              { key: 'W', label: 'High Block', action: 'block_high' },
              { key: 'A', label: 'Left Block', action: 'block_left' },
              { key: 'S', label: 'Retreat', action: 'retreat' },
              { key: 'D', label: 'Right Block', action: 'block_right' },
            ] as const
          ).map((btn) => {
            const active = hud.playerDefense === btn.action;
            return (
              <button
                key={btn.key}
                type="button"
                tabIndex={-1}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onTouchDefense(btn.action);
                }}
                onPointerUp={() => onTouchDefense('none')}
                onPointerLeave={() => onTouchDefense('none')}
                onPointerCancel={() => onTouchDefense('none')}
                className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 border text-xs font-medium tracking-wider transition-colors cursor-pointer select-none ${
                  active
                    ? 'bg-[#b38632] border-[#ffe19c] text-[#14100c] font-bold'
                    : 'bg-[#141210]/88 border-[#544632] text-[#dfd2bc] hover:border-[#b38632]'
                }`}
              >
                <span className="font-display font-bold mr-1">[{btn.key}]</span>
                <span className="hidden sm:inline">{btn.label}</span>
                <span className="sm:hidden">{btn.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
