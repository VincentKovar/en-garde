export type HapticKind =
  | 'zone_hover'
  | 'swing'
  | 'retreat'
  | 'block'
  | 'parry'
  | 'retreat_counter'
  | 'hit_enemy'
  | 'hit_player'
  | 'guard_break'
  | 'victory'
  | 'defeat';

const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  zone_hover: 8,
  swing: 16,
  retreat: [14, 12, 14],
  block: [20, 14, 24],
  parry: [24, 16, 44],
  retreat_counter: [18, 12, 22, 12, 48],
  hit_enemy: [32, 16, 48],
  hit_player: [65, 24, 75],
  guard_break: [80, 30, 90],
  victory: [35, 25, 35, 25, 95],
  defeat: [110, 40, 130],
};

class HapticsController {
  private enabled = true;
  private lastHoverTime = 0;

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(next: boolean): void {
    this.enabled = next;
  }

  public trigger(kind: HapticKind): void {
    if (!this.enabled || !this.isSupported()) return;
    if (kind === 'zone_hover') {
      const now = performance.now();
      if (now - this.lastHoverTime < 85) return;
      this.lastHoverTime = now;
    }
    try {
      navigator.vibrate(HAPTIC_PATTERNS[kind]);
    } catch {
      // Ignore browser permission restrictions before gesture
    }
  }
}

export const haptics = new HapticsController();
