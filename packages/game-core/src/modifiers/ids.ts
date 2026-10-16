export const MODIFIER_IDS = {
  floorIsLava: 'MOD-A002',
  ventTiles: 'MOD-A003',
  winterIsComing: 'MOD-A004',
  thisIsMySwamp: 'MOD-A006',
  gerald: 'MOD-B002',
  conscientiousObjector: 'MOD-B007',
  reginaldBeak: 'MOD-B008',
  traitor: 'MOD-B006',
  smallCouncil: 'MOD-E002',
  berserker: 'MOD-E006',
  rejectQueen: 'MOD-E007',
  chancellor: 'MOD-E004',
  twinTelepathy: 'MOD-E005',
} as const;

export type ModifierId = (typeof MODIFIER_IDS)[keyof typeof MODIFIER_IDS];
