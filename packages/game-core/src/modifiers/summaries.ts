/**
 * One plain line per modifier: what it does, in words a new player gets at a
 * glance. The draft shows these on its cards. The full rules stay in each
 * card's description and prototypeRules.
 */
export const MODIFIER_SUMMARIES: Record<string, string> = {
  'MOD-A001': 'Infection spreads across the board and slows pieces that sit on it.',
  'MOD-A002': 'Four lava squares move around and burn any piece that lands on them.',
  'MOD-A003': 'Hidden vents throw the first piece to the opposite side of the board.',
  'MOD-A004': 'Pieces entering either home zone freeze for a turn.',
  'MOD-A005': 'A storm eats the board edge every few turns, shrinking it to 6×6.',
  'MOD-A006': 'The four centre squares slow pieces to one step and trap knights.',
  'MOD-A007': 'Every 12 turns all pieces slide one square sideways.',
  'MOD-A008': 'Your moves on one side get copied by the mirror piece on the other.',
  'MOD-B001': 'Every 7th turn, one of your pieces makes a random move for you.',
  'MOD-B002': 'Gerald the pigeon sits on your pieces. Shooing him costs a turn.',
  'MOD-B003': 'For your first 5 moves, your clicks are flipped across the board.',
  'MOD-B004': 'Your King must announce its move a turn before making it.',
  'MOD-B005': 'Your move history goes dark for a few moves at a time.',
  'MOD-B006': 'Late in the game, your best piece switches sides.',
  'MOD-B007': 'One of your pawns refuses to capture.',
  'MOD-B008': 'A pigeon critic reviews every move. No effect on play.',
  'MOD-C001': 'Your King closes a row or column to enemy pieces for 3 turns.',
  'MOD-C002': 'A bishop forces an enemy piece to announce its next move.',
  'MOD-C003': 'Once in a while, a knight moves like a rook.',
  'MOD-C004': 'A pawn can capture diagonally backwards.',
  'MOD-C005': 'Your Queen stands still and keeps enemies out of the squares around her.',
  'MOD-C006': 'A rook fires down its line and destroys the first piece it hits.',
  'MOD-C007': 'Sacrifice a piece now to take an extra move later.',
  'MOD-C008': 'Save an en passant capture and use it up to 3 turns later.',
  'MOD-D001': 'Fog of war. You only see 2 squares around your own pieces.',
  'MOD-D002': 'Two fake pieces fool your opponent. They can\'t capture.',
  'MOD-D003': 'Smoke clouds hide pieces from the side that didn\'t make them.',
  'MOD-D004': 'Each player has a 2×2 blind spot they cannot see into.',
  'MOD-D005': 'One of your pieces looks like a different piece to your opponent.',
  'MOD-D006': 'See 3 squares in the dark instead of 2. Needs the fog card.',
  'MOD-D007': 'Fake move dots appear. Picking one wastes the selection, not the turn.',
  'MOD-D008': 'A golden eye square reveals any piece that moves near it.',
  'MOD-E001': 'Your knights become pigeons that sometimes hop on their own.',
  'MOD-E002': 'Swap your knights and bishops for 4 extra pawns.',
  'MOD-E003': 'Your Queen becomes two Royal Guards that move like kings.',
  'MOD-E004': 'One rook becomes a Chancellor: it moves like a rook or a knight.',
  'MOD-E005': 'When one of your bishops moves, the other slides the same way.',
  'MOD-E006': 'One piece is a Berserker that captures twice in a row.',
  'MOD-E007': 'Pawns can\'t become queens, but promoted pieces capture twice.',
  'MOD-E008': 'Lost pieces earn tokens to buy them back onto the board.',
};

export function getModifierSummary(id: string): string | undefined {
  return MODIFIER_SUMMARIES[id];
}
