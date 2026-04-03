import type { ModifierID } from '../engine/types';
import type { ModifierDefinition } from './types';

// Phase 1: Register modifiers here
export class ModifierRegistry {
  private modifiers = new Map<ModifierID, ModifierDefinition>();

  register(mod: ModifierDefinition): void {
    this.modifiers.set(mod.id, mod);
  }

  get(id: ModifierID): ModifierDefinition | undefined {
    return this.modifiers.get(id);
  }

  getAll(): ModifierDefinition[] {
    return Array.from(this.modifiers.values());
  }
}

export const modifierRegistry = new ModifierRegistry();
