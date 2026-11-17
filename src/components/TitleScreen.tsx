import type { LevelConfig } from '../game/types';

interface TitleScreenProps {
  levels: LevelConfig[];
  selectedLevelIndex: number;
  onSelectLevel: (index: number) => void;
  onStart: () => void;
}

export function TitleScreen({
  levels,
  selectedLevelIndex,
  onSelectLevel,
  onStart,
}: TitleScreenProps) {
  const activeLevel = levels[selectedLevelIndex];

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none">
      {/* Left-third calm atmospheric gradient scrim so duelist stays focal on right-center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(95deg, rgba(10, 9, 8, 0.9) 0%, rgba(10, 9, 8, 0.68) 40%, rgba(10, 9, 8, 0.14) 75%, rgba(10, 9, 8, 0.35) 100%)',
        }}
      />

      <div className="relative z-10 flex-1 flex items-center px-6 sm:px-12 lg:px-16">
        <div className="max-w-lg w-full pointer-events-auto">
          {/* Bespoke inline SVG crossed-rapiers & shield title lockup */}
          <div className="mb-5">
            <svg
              viewBox="0 0 360 118"
              className="w-72 sm:w-88 h-auto drop-shadow-[0_6px_18px_rgba(0,0,0,0.85)]"
              aria-label="En Garde: Blades of Honor"
              role="img"
            >
              {/* Crossed Rapiers behind crest */}
              <g stroke="#d4a34a" strokeWidth="2.4" strokeLinecap="round" fill="none">
                <line x1="22" y1="92" x2="96" y2="18" />
                <line x1="96" y1="92" x2="22" y2="18" />
                <circle cx="30" cy="84" r="5" fill="#181512" stroke="#d4a34a" strokeWidth="2" />
                <circle cx="88" cy="84" r="5" fill="#181512" stroke="#d4a34a" strokeWidth="2" />
              </g>
              {/* Central Heraldic Shield */}
              <path
                d="M59 18 L84 26 V54 C84 72 59 88 59 88 C59 88 34 72 34 54 V26 Z"
                fill="#191613"
                stroke="#e0b55c"
                strokeWidth="2.5"
              />
              <path
                d="M59 24 L77 30 V53 C77 66 59 79 59 79 C59 79 41 66 41 53 V30 Z"
                fill="#7a1f24"
                stroke="#b88834"
                strokeWidth="1.2"
              />
              <path d="M59 29 V74 M47 45 H71" stroke="#f0d28c" strokeWidth="2.4" strokeLinecap="round" />

              {/* Title Lockup Typography */}
              <text
                x="114"
                y="54"
                fill="#f6efe2"
                fontSize="38"
                fontWeight="800"
                fontFamily="Cinzel, Georgia, serif"
                letterSpacing="3"
              >
                EN GARDE
              </text>
              <line x1="114" y1="65" x2="346" y2="65" stroke="#c99842" strokeWidth="1.6" />
              <text
                x="116"
                y="86"
                fill="#d8be8a"
                fontSize="14"
                fontWeight="600"
                fontFamily="Cinzel, Georgia, serif"
                letterSpacing="4.5"
              >
                BLADES OF HONOR
              </text>
            </svg>
          </div>

          {/* Arena / Challenger Selector */}
          <div className="mb-6">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#b9aa90] mb-2 font-semibold">
              Select Arena &amp; Challenger
            </div>
            <div className="grid grid-cols-2 gap-2">
              {levels.map((lvl, idx) => {
                const selected = idx === selectedLevelIndex;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => {
                      onSelectLevel(idx);
                    }}
                    className={`text-left px-3 py-2.5 border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#261f18]/95 border-[#d4a34a] text-[#fbf5ea]'
                        : 'bg-[#141210]/85 border-[#3c342b] text-[#b8aa95] hover:border-[#856b42] hover:text-[#f3ece0]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-xs font-bold tracking-wider truncate">
                        {lvl.environmentTitle}
                      </span>
                      <span
                        className="w-2.5 h-2.5 shrink-0 border border-black/40"
                        style={{ backgroundColor: lvl.palette.accentHex }}
                      />
                    </div>
                    <div className="text-[11px] text-[#9b8d77] mt-0.5 truncate">
                      {lvl.enemyName} · {lvl.enemySpeedMultiplier.toFixed(1)}x Spd
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 px-3 py-2 bg-[#141210]/80 border-l-2 border-[#d4a34a] text-xs text-[#d6c8b2]">
              <span className="font-semibold text-[#f3e5ca]">{activeLevel.enemyName}</span>{' '}
              ({activeLevel.enemyTitle}) — {activeLevel.combatStyle}
            </div>
          </div>

          {/* Primary Start CTA */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className="px-7 py-3.5 bg-[#9e2729] hover:bg-[#b52e30] active:translate-y-px border border-[#e0b55c] text-[#fcf6eb] font-display text-sm font-bold tracking-[0.16em] uppercase shadow-[0_6px_24px_rgba(0,0,0,0.65)] transition-colors cursor-pointer"
            >
              Enter Duel
            </button>
          </div>
        </div>
      </div>

      {/* Single flat borderless control-hint line in bottom safe margin */}
      <div className="relative z-10 pb-5 px-6 text-center pointer-events-none">
        <p className="text-xs sm:text-[13px] tracking-[0.08em] text-[#d5c8b4]/90 text-stroke-dark">
          Click 6 Zones to Strike · W High Block · A/D Side Block · S Retreat Counter · Esc Pause
        </p>
      </div>
    </div>
  );
}
