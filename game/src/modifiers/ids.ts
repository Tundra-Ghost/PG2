export const MODIFIER_IDS = {
  floorIsLava: 'MOD-A002',
  winterIsComing: 'MOD-A004',
  gerald: 'MOD-B002',
  conscientiousObjector: 'MOD-B007',
  berserker: 'MOD-E006',
} as const;

export type ModifierId = (typeof MODIFIER_IDS)[keyof typeof MODIFIER_IDS];
