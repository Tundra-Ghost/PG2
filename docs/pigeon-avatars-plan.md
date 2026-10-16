# Pigeon Avatars: Plan

Players get a customizable pigeon instead of an uploaded photo, dressed with "swag" the way Roblox and Reddit avatars work. This doc is the way forward: what to build, in what order, and what the art needs to look like.

## Constraints from the GDD and Art Direction

- **Cosmetic only.** The GDD's Iron Rule: nothing purchasable may affect play. Avatars are pure expression.
- **Earned through play first.** Achievements, titles and rank tiers (Egg to Flock King) already exist or are planned; they become the first unlock sources. A battle pass and store come later (GDD Phase 2).
- **The look is already defined by the menu art**: painterly pigeons in beanies, sunglasses, flat caps, a monocle, a hoodie. Avatars should look like those pigeons, not like a separate cartoon style.
- **Deadpan grandeur.** A pigeon in a crown and gold chain is presented with complete seriousness.

## How it works

### One pose, many layers

Every avatar is the same base pigeon in the same pose, with items stacked on top as transparent image layers. This is how Reddit avatars and most 2D dress-up systems work, and it keeps the art pipeline simple.

- **Canvas:** 1024 x 1024, transparent. Every layer (base and items) is exported at the full canvas size, so they line up with no positioning maths. WebP keeps the empty areas nearly free (about 20-60 KB per layer).
- **Pose:** a three-quarter bust facing right, like the menu card pigeons. A bust reads well at small sizes (chat bubbles, friends list) where a full body would not.

### Slots

Each item belongs to one slot. Slots also set the stacking order.

| Order | Slot | Examples |
|---|---|---|
| 0 | Frame / background | Plain parchment, gold crumb frame, rooftop at dusk |
| 10 | Back | Cape, wings badge, hood (back half) |
| 20 | Body (the pigeon) | Feather palettes: rock dove, slate, white fantail, pied, iridescent |
| 30 | Outfit | Hoodie, tweed jacket, tracksuit, tuxedo bib |
| 40 | Neck | Scarf, gold chain, bow tie, medal |
| 50 | Eyes | Default, sleepy, suspicious, starry |
| 60 | Face | Sunglasses, monocle, aviators, eyepatch |
| 70 | Head | Beanie, flat cap, crown, top hat, bread slice |
| 80 | Held | Chess piece, baguette, tiny trophy |
| 90 | Companion | A tiny named pigeon sidekick (GDD "Pigeon Companions") |

An item can have more than one layer when it wraps around the pigeon. A hood, for example, has a back layer at order 10 and a front layer at order 72. An item can also hide another slot; the hood hides Head.

### Data

```ts
// Saved in the profile, which already syncs to the player's account.
interface AvatarConfig {
  palette: string;                          // e.g. 'rock-dove'
  items: Partial<Record<Slot, string>>;     // slot -> item id
}

// The catalog is data, so new items need art and one entry, no code.
interface CosmeticItem {
  id: string;                    // 'beanie-olive'
  slot: Slot;
  name: string;                  // 'The Olive Beanie'
  flavor: string;                // deadpan one-liner, Playfair italic
  layers: { src: string; order: number }[];
  hides?: Slot[];
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlock:
    | { type: 'starter' }
    | { type: 'achievement'; id: string }
    | { type: 'title'; id: string }
    | { type: 'rank'; tier: string }
    | { type: 'pass'; season: number; tier: number };
}
```

### Rendering

- A `<PigeonAvatar config size />` React component stacks the layers as absolutely positioned images. It's cheap, crisp, and needs no canvas.
- For places that need a single image (sharing, and later Steam), draw the layers onto a canvas once and cache the result.
- **Where avatars appear:** the menu profile button, the profile screen, match banners, the chat log, the friends list, and the opponent's banner online. The server would send each player's avatar config with the room, the same way it sends usernames now.

### Ownership

- **Prototype:** unlocks are computed on the device from achievements and titles, as titles are today.
- **Before anything is sold or ranked:** the server owns the inventory (an `owned_cosmetic` table next to the accounts), so items can't be granted by editing local data. Accounts already exist, so this is a small step.

## The art pipeline

1. **Template file.** One layered file (Photoshop, Procreate or Krita) with the base pigeon locked on the 1024 canvas and guide layers marking the head top, eye line, beak and neck. Every artist and every item starts from it.
2. **Base palettes.** Paint the base pigeon once, then palette variants. Iridescent neck feathers (green and purple, as in the menu art) are part of each palette.
3. **Items.** Each item is painted on its own layer in the template, then exported as a full-canvas WebP with transparency.
4. **Import script.** A small script checks each export is 1024 x 1024 with transparency, compresses it, makes a thumbnail for the editor, and flags anything missing from the catalog.

**Who makes the art** is the main open question. The options:
- **Commission an illustrator** to match the menu style. Best quality and consistency. Budget for the base plus about 25 starter items.
- **AI-assisted with paint-over.** Generate in the menu style, then have it cleaned up and aligned to the template. Faster and cheaper, but the alignment work is real.
- **Placeholder vector art (me) first, real art later.** I draw simple flat items in SVG to prove the system works, and they get swapped one-for-one when real art lands. This is the recommended start, because it unblocks the code now.

## Roadmap

### Phase 0: prototype (code, placeholder art)
- `PigeonAvatar` component, the slot and stacking rules, and the catalog format.
- About 8 placeholder items, 3 palettes and 2 frames.
- An **avatar editor** in the profile screen: a big preview, slot tabs, and an item grid with locked items greyed out, each showing how to unlock it.
- Avatars shown in the menu, the match banners and the friends list.
- Replaces photo upload as the default. Photos of real people in a public game would need moderation, which pigeons don't.

### Phase 1: starter set (real art)
- The base pigeon in 6 palettes and about 25 items, mostly starter or achievement unlocks.
- Unlocks wired to the existing achievements and titles.
- Opponents see your pigeon online.

### Phase 2: earned and seasonal
- A server-owned inventory.
- Rank-tier rewards from the GDD, such as the Owlmaster pigeon companion and the Flock King crown.
- Simple idle animation: blink and feather ruffle via CSS on the layers, so no new art is needed.

### Phase 3: battle pass and store (GDD Phase 2)
- Seasonal item sets, a free and premium track, and store bundles.
- Cosmetic only, per the Iron Rule.

## Decisions needed

1. **Art source:** commission, AI-assisted, or placeholders first? Placeholders first is recommended either way.
2. **Pose:** bust (recommended) or full body?
3. **Photo upload:** remove it, or keep it as an option behind the pigeon?
4. **Names:** do avatars get a name of their own ("Sir Reginald Beak"), separate from the username? It fits Pillar 3, "the flock is alive".
