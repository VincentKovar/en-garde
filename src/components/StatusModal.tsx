import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { computeZoneAnalytics } from '../game/combat';
import { LEVELS } from '../game/levels';
import type { DuelStats, GamePhase } from '../game/types';

interface StatusModalProps {
  phase: Extract<GamePhase, 'paused' | 'victory' | 'gameover'>;
  levelIndex: number;
  stats: DuelStats;
  onResume: () => void;
  onRestart: () => void;
  onNextLevel: () => void;
  onReturnTitle: () => void;
}

type ModalTab = 'summary' | 'analytics';

export function StatusModal({
  phase,
  levelIndex,
  stats,
  onResume,
  onRestart,
  onNextLevel,
  onReturnTitle,
}: StatusModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>('summary');
  const level = LEVELS[levelIndex];
  const hasNextLevel = levelIndex < LEVELS.length - 1;
  const { overallAccuracyPct, zoneSeries } = computeZoneAnalytics(stats);

  const heading =
    phase === 'paused'
      ? 'Duel Paused'
      : phase === 'victory'
        ? hasNextLevel
          ? 'Challenger Bested'
          : 'Grand Champion'
        : 'Felled in Combat';

  const subtitle =
    phase === 'paused'
      ? `${level.name} — ${level.enemyName}`
      : phase === 'victory'
        ? hasNextLevel
          ? `${level.enemyName} yielded in ${level.environmentTitle}.`
          : 'All four masters of steel have fallen before your blade.'
        : `${level.enemyName} prevailed in ${level.environmentTitle}.`;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(10, 9, 8, 0.72)' }}
      role="dialog"
      aria-modal="true"
      aria-label={heading}
    >
      <div
        className={`w-full ${
          activeTab === 'analytics' ? 'max-w-xl' : 'max-w-md'
        } max-h-[92vh] overflow-y-auto border border-[#b38b46] p-4 sm:p-5 shadow-[0_18px_48px_rgba(0,0,0,0.85)]`}
        style={{ backgroundColor: 'rgba(18, 15, 13, 0.96)' }}
      >
        <div className="text-center mb-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#c79d52] font-semibold mb-0.5">
            {level.environmentTitle}
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-[0.1em] text-[#f7efe2] uppercase">
            {heading}
          </h2>
          <p className="text-xs text-[#c1b39c] mt-0.5">{subtitle}</p>
        </div>

        {/* Tab Switcher: Summary | Combat Analytics */}
        <div
          role="tablist"
          aria-label="Duel report views"
          className="grid grid-cols-2 gap-1.5 p-1 bg-[#12100e] border border-[#3d3326] mb-4"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'summary'}
            onClick={() => setActiveTab('summary')}
            className={`py-1.5 text-[11px] font-display font-bold tracking-[0.14em] uppercase transition-colors cursor-pointer ${
              activeTab === 'summary'
                ? 'bg-[#2a2219] border border-[#b38b46] text-[#faf1e2]'
                : 'border border-transparent text-[#9c8d76] hover:text-[#e6d7bd]'
            }`}
          >
            Summary
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'analytics'}
            onClick={() => setActiveTab('analytics')}
            className={`py-1.5 text-[11px] font-display font-bold tracking-[0.14em] uppercase transition-colors cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-[#2a2219] border border-[#b38b46] text-[#faf1e2]'
                : 'border border-transparent text-[#9c8d76] hover:text-[#e6d7bd]'
            }`}
          >
            Combat Analytics
          </button>
        </div>

        {activeTab === 'summary' ? (
          /* 3 Tabular-Nums Mastery / Progress Stat Tiles */
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            <div className="px-2.5 py-2.5 bg-[#12100e] border border-[#3d3326] text-center">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#9b8c76]">
                Damage
              </div>
              <div className="tabular-nums text-lg font-bold text-[#f3e6cf] mt-0.5">
                {Math.round(stats.damageDealt)}
              </div>
            </div>
            <div className="px-2.5 py-2.5 bg-[#12100e] border border-[#3d3326] text-center">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#9b8c76]">
                Parries
              </div>
              <div className="tabular-nums text-lg font-bold text-[#f3e6cf] mt-0.5">
                {stats.parriesAndCounters}
              </div>
            </div>
            <div className="px-2.5 py-2.5 bg-[#12100e] border border-[#3d3326] text-center">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#9b8c76]">
                Time
              </div>
              <div className="tabular-nums text-lg font-bold text-[#f3e6cf] mt-0.5">
                {formatTime(stats.elapsedSeconds)}
              </div>
            </div>
          </div>
        ) : (
          /* Combat Analytics Tab with Recharts Visualizations */
          <div className="space-y-3 mb-4" data-testid="combat-analytics-panel">
            {/* Key Accuracy Metrics Strip */}
            <div className="grid grid-cols-3 gap-2">
              <div className="px-2.5 py-1.5 bg-[#12100e] border border-[#3d3326] text-center">
                <div className="text-[10px] uppercase tracking-[0.12em] text-[#9b8c76]">
                  Hit Accuracy
                </div>
                <div className="tabular-nums text-base font-bold text-[#e6bd67]">
                  {overallAccuracyPct}%
                </div>
              </div>
              <div className="px-2.5 py-1.5 bg-[#12100e] border border-[#3d3326] text-center">
                <div className="text-[10px] uppercase tracking-[0.12em] text-[#9b8c76]">
                  Hits / Swings
                </div>
                <div className="tabular-nums text-base font-bold text-[#f3e6cf]">
                  {stats.hitsLanded} / {stats.swingsAttempted}
                </div>
              </div>
              <div className="px-2.5 py-1.5 bg-[#12100e] border border-[#3d3326] text-center">
                <div className="text-[10px] uppercase tracking-[0.12em] text-[#9b8c76]">
                  Best Chain
                </div>
                <div className="tabular-nums text-base font-bold text-[#f3e6cf]">
                  {stats.bestCombo}×
                </div>
              </div>
            </div>

            {/* Chart 1: 6-Zone Strike Distribution (Landed vs Blocked) */}
            <div className="p-2.5 bg-[#12100e] border border-[#3d3326]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-display font-bold uppercase tracking-[0.14em] text-[#d8c4a0]">
                  6-Zone Strike Distribution
                </span>
                <div className="flex items-center gap-3 text-[10px] text-[#a99a83]">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-[#d4a34a]" />
                    Landed
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-[#b54548]" />
                    Blocked
                  </span>
                </div>
              </div>
              <div className="w-full h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={zoneSeries}
                    margin={{ top: 4, right: 8, left: -22, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2c251d" vertical={false} />
                    <XAxis
                      dataKey="shortLabel"
                      tick={{ fill: '#c5b79f', fontSize: 10 }}
                      axisLine={{ stroke: '#4a3e30' }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#9c8d76', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(212, 163, 74, 0.08)' }}
                      contentStyle={{
                        backgroundColor: '#15120f',
                        border: '1px solid #b38b46',
                        fontSize: '11px',
                        color: '#f3ece0',
                      }}
                      itemStyle={{ color: '#f3ece0' }}
                      formatter={(value, name) => {
                        const label =
                          name === 'hits'
                            ? 'Hits Landed'
                            : name === 'blocked'
                              ? 'Blocked'
                              : String(name);
                        return [value, label];
                      }}
                      labelFormatter={(label, payload) => {
                        const row = payload?.[0]?.payload as
                          | { label?: string; accuracyPct?: number; damage?: number }
                          | undefined;
                        if (!row) return String(label);
                        return `${row.label} · ${row.accuracyPct}% Acc (${row.damage} dmg)`;
                      }}
                    />
                    <Bar dataKey="hits" stackId="zone" fill="#d4a34a" isAnimationActive={false} />
                    <Bar
                      dataKey="blocked"
                      stackId="zone"
                      fill="#b54548"
                      radius={[2, 2, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Cumulative Hit Accuracy Over Course of Duel */}
            <div className="p-2.5 bg-[#12100e] border border-[#3d3326]">
              <div className="text-[10px] font-display font-bold uppercase tracking-[0.14em] text-[#d8c4a0] mb-1.5">
                Accuracy Over Course of Duel (%)
              </div>
              {stats.accuracyHistory.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-xs text-[#8f806b]">
                  Strike an enemy zone to record duel accuracy telemetry.
                </div>
              ) : (
                <div className="w-full h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats.accuracyHistory}
                      margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#2c251d" vertical={false} />
                      <XAxis
                        dataKey="swingIndex"
                        tick={{ fill: '#c5b79f', fontSize: 10 }}
                        axisLine={{ stroke: '#4a3e30' }}
                        tickLine={false}
                        tickFormatter={(v) => `#${v}`}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: '#9c8d76', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#15120f',
                          border: '1px solid #b38b46',
                          fontSize: '11px',
                          color: '#f3ece0',
                        }}
                        itemStyle={{ color: '#e6bd67' }}
                        formatter={(value) => [`${value}%`, 'Cumulative Accuracy']}
                        labelFormatter={(swing) => `Strike #${swing}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="cumulativeAccuracy"
                        stroke="#e0b55c"
                        strokeWidth={2}
                        fill="#b38b46"
                        fillOpacity={0.22}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Primary & Secondary Actions */}
        <div className="flex flex-col gap-2.5">
          {phase === 'paused' && (
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 bg-[#9e2729] hover:bg-[#b52e30] border border-[#e0b55c] text-[#fcf6eb] font-display text-xs font-bold tracking-[0.16em] uppercase cursor-pointer"
            >
              Resume Duel
            </button>
          )}

          {phase === 'victory' && hasNextLevel && (
            <button
              type="button"
              data-start="true"
              onClick={onNextLevel}
              className="w-full py-3 bg-[#9e2729] hover:bg-[#b52e30] border border-[#e0b55c] text-[#fcf6eb] font-display text-xs font-bold tracking-[0.16em] uppercase cursor-pointer"
            >
              Next Challenger
            </button>
          )}

          {(phase === 'gameover' || (phase === 'victory' && !hasNextLevel)) && (
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="w-full py-3 bg-[#9e2729] hover:bg-[#b52e30] border border-[#e0b55c] text-[#fcf6eb] font-display text-xs font-bold tracking-[0.16em] uppercase cursor-pointer"
            >
              {phase === 'victory' ? 'Duel Again' : 'Try Again'}
            </button>
          )}

          {phase === 'paused' && (
            <button
              type="button"
              onClick={onRestart}
              className="w-full py-2.5 bg-[#211c17] hover:bg-[#2c251e] border border-[#5e4d35] text-[#ebe0cd] font-display text-xs font-bold tracking-[0.14em] uppercase cursor-pointer"
            >
              Restart Duel
            </button>
          )}

          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-2.5 bg-[#141210] hover:bg-[#1e1a16] border border-[#3d3326] text-[#c2b49d] font-display text-xs font-semibold tracking-[0.14em] uppercase cursor-pointer"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
}
