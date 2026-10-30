# Pigeon Chess: Art Direction Guide

**Ref:** PC-ART-001 · **Version:** 0.2 · **Status:** Draft
**Related:** [GDD](gdd.md) · [Modifier Bible](modifier-bible.md) · [TDD](tdd.md)
**Renderer:** Phaser 3 for the board (planned), React for UI. The board is React + CSS today.
**Tone:** Chaotic and absurd, presented with deadpan grandeur.

## Change log

**v0.2 (2026-10-30)**
- Converted from HTML to Markdown.
- Pieces: side profile, not top-down. Documented the engraved SVG pieces that ship today.
- New: sprite sheet spec for animated pieces (section 5.4).
- New: modifier icon set rules (section 7.3).
- Fixed colour clashes. Each colour now has one meaning (section 2.4).
- New: accessibility rules (section 13) and audio direction (section 14).
- All-caps rule clarified for big event screens.
- Phaser layer notes kept, with a note on the current React board.

**v0.1** First draft.

## 1. Vision

**The one sentence:** Pigeon Chess looks like a prestigious Victorian chess journal that has slowly been taken over by pigeons and refuses to admit it.

The look is built on one tension: dignified formality vs. growing chaos. The base is serious and classical: aged parchment, engraved type, candlelit wood. Over that, chaos builds up. Mold spreads, tiles burn, cards quote memes, a pigeon named Gerald sits on your queen. The board does not explain itself.

A lava tile should feel truly dramatic, not cartoonish. Gerald's arrival should feel truly absurd, not cute. The deadpan is the joke.

### Visual pillars

1. **Deadpan Grandeur.** Everything is presented with full seriousness. Lava gets a formal label. Gerald gets a nameplate. The absurdity is in the content, never the style.
2. **Organic Corruption.** The look starts clean and gets more corrupted as Madness rises. At Full Flock, everything feathers.
3. **Tactile Physicality.** The board has weight. Pieces have grain. Cards have paper texture. No flat design. Light sources are consistent.
4. **Modifier Visual Identity.** Each category has its own colour, icon style and effect, so players can tell the category at a glance.

## 2. Colour system

### 2.1 Foundation palette

| Name | Hex | Use |
|---|---|---|
| Deep Ink | `#18120a` | Text, UI chrome, board border |
| Board Dark | `#1e1408` | Dark squares, deep backgrounds |
| Board Mid | `#3a2818` | Panels, mid surfaces |
| Board Light | `#c8a870` | Light squares, warm highlights |
| Parchment | `#f2ead8` | UI backgrounds, card base, white pieces |
| Viktor's Gold | `#c8973a` | Main accent, selection, rating badges |
| Chaos Red | `#b83228` | Danger, check, YOU DIED |
| Pigeon Grey | `#8a8298` | Secondary text, inactive states, Gerald |

### 2.2 Category colours

| Category | Hex | Meaning |
|---|---|---|
| A Board Mutations | `#e8a23a` | Amber fire |
| B Cursed | `#c0392b` | Blood red |
| C Active Abilities | `#3a9de8` | Electric blue |
| D Fog of War | `#7c3ae8` | Deep violet |
| E Asymmetric Armies | `#3ae87c` | Flock green |

### 2.3 Madness spectrum

| Madness | Name | Tint |
|---|---|---|
| 0 to 25 | Composed | `#c8973a` |
| 26 to 50 | Unsettled | `#c87838` |
| 51 to 75 | Unravelling | `#a84828` |
| 76 to 99 | Lost | `#782868` |
| 100 | Full Flock | `#480858` |

The board gets the tint as a colour filter (Phaser post-processing later, CSS filter now). UI chrome reads it from the CSS variable `--madness-tint`.

### 2.4 One colour, one meaning

v0.1 used the same colour for different things. New rules:

| Signal | Colour | Was |
|---|---|---|
| Tier S badge | Gold `#f0c040` | Same |
| Tier A badge | Purple `#c878f0` | Same |
| Tier B badge | Blue `#4090f0` | Same |
| Tier C badge (post-launch) | Pigeon Grey `#8a8298` | Green, clashed with Category E and negative cost |
| Card cost that spends points | Parchment text with a "−" budget icon | Gold, clashed with Tier S |
| Card cost that grants points (curses) | Parchment text with a "+" budget icon | Green, clashed with Category E |
| Storm | Slate grey `#5a6070` with pale stripes | Pale blue, clashed with the fog-only rule |
| Winter / frozen | Ice white-grey `#c8d0d8` tint | Blue-grey, close to Category C |

Cost now reads by its sign and icon, not by colour (see section 13).

### 2.5 Colour rules

1. No pure white (`#ffffff`). Use Parchment `#f2ead8` or Cream `#faf7f0`.
2. Cyan and teal are reserved for fog effects only. Seeing cyan means something is hidden.
3. No flat gradient backgrounds on game surfaces. Large areas get a texture overlay.
4. Category colours are exclusive to their category. A board tile never uses ability blue.

## 3. Typography

Three typefaces. Each has one role.

**Display: Playfair Display.** Titles, headings, Viktor's dialogue, modifier names. 900 weight for titles and big labels. 400 italic for dialogue and flavor text. Never below 14px. No all caps in normal UI. **Exception:** the big full-screen event cards ("A PIECE MOVED", "YOU DIED") may use all caps, because they imitate a game-over screen on purpose.

**Body: DM Sans.** All UI text, rules and tutorials. 300 for body, 500 for labels and buttons. Never 700.

**Mono: DM Mono.** IDs, stats, timers, ratings, system labels. Letter spacing at least 0.1em. Always a dim secondary tone. Never in prose.

| Style | Font | Size | Weight | Use |
|---|---|---|---|---|
| Hero | Playfair | 64 to 96px | 900 | Game title, Tower titles |
| H1 | Playfair | 40 to 52px | 900 | Screen titles, boss names |
| H2 | Playfair | 28 to 36px | 700 | Section headers, card names |
| H3 | Playfair | 20 to 24px | 700 | Sub-headers, run map nodes |
| Quote | Playfair italic | 16 to 20px | 400 | Flavor, dialogue |
| Body | DM Sans | 14 to 16px | 300 | Descriptions |
| Label | DM Sans | 12 to 14px | 500 | Buttons, labels |
| Mono | DM Mono | 11 to 13px | 400 | Stats, timers |
| Micro | DM Mono | 9 to 11px | 400 | Card IDs, versions |

On phones, body text is never below 14px and labels never below 12px.

## 4. Board design

### Default board: "The Crumbed Board"

Aged walnut, warm candlelight, slight grain. A high-end Victorian set that has seen better days.

- **Dark squares:** `#1e1408`, faint horizontal grain (2px spacing, 3% opacity), slight top-left warmth, 1px inset shadow.
- **Light squares:** `#c8a870`, lighter grain, slightly brighter centre, same inset shadow.
- **Frame:** 12px deep walnut `#100a04`. Rank and file labels in DM Mono 10px `#8a6840`. Small carved pigeon rosettes in the corners. Warm drop shadow.

### Highlights

| State | Look |
|---|---|
| Selected square | Gold `#c8973a` at 40% |
| Legal move | 12px gold dot at 60% |
| Capture target | Red `#b83228` at 30% over the square |
| King in check | Red square, slow 0.5s pulse |

### Board layers

Base size 640×640 (80px squares), scaled to fit. Phaser depths (planned). The React board uses the same order with CSS stacking.

| Layer | Depth | Contents |
|---|---|---|
| Board base | 0 | Squares, frame, labels |
| Tile effects | 10 | Lava, infection, frost, swamp, storm |
| Fog | 20 | Dark overlay outside visible squares |
| Pieces | 30 | Pieces. A selected piece draws at 50. |
| Piece effects | 40 | Gerald, cooldown rings, ghost shimmer, berserker glow |
| Board events | 60 | Cannonball, vent flash, storm wave, gravity slide, burn flashes |
| UI overlay | 70 | Ability targeting, no-fly lines, surveillance eye, zones |
| Notifications | 80 | Reginald's review, Gerald's nameplate, event screens |

## 5. Piece design

### 5.1 Style

Engraved illustration. Staunton pieces as drawn by a 19th-century engraver for a natural history journal. Strong outlines, internal hatching for depth, no gradients, no 3D. Every piece takes itself completely seriously.

**View:** side profile (the classic chess diagram view). The knight is a side-profile horse head. v0.1 said "top-down", which did not match the knight or the shipped art.

### 5.2 What ships today

- One SVG per piece type in `game/src/assets/pieces/`, 48×48 viewBox.
- Drawn with `currentColor` for outlines and CSS variables for fill and hatching:
  - **White:** parchment body, ink outline, single hatching.
  - **Black:** walnut body `#4a3420`, light outline so it reads on dark squares, cross-hatching.
- High-contrast mode brightens black outlines.
- Status markers (Gerald, frozen, swamp, pacifist, berserker, traitor, chain) are small badges on the piece. These should become authored icons (section 7.3).

### 5.3 The swap rule

All piece drawing goes through **one component**: `game/src/components/Piece` (`PieceArt`). Nothing else draws a piece. This keeps one place to swap static SVGs for sprite sheets, and later for Phaser sprites.

### 5.4 Sprite sheet spec (animated pieces)

For when animated pieces arrive. Art made to this spec drops in without code changes elsewhere.

| Item | Spec |
|---|---|
| Frame size | 128×128 px per frame (renders at 64 to 80px, sharp on 2× screens) |
| Padding | 8px empty margin inside each frame. Piece base sits at the same baseline in every frame. |
| Layout | One PNG per piece type and colour. One row per state, frames left to right. |
| Max sheet | 2048×2048 px |
| Frame rate | 12 fps default. Per-state override allowed. |
| File name | `{type}-{color}.png` plus `{type}-{color}.json` (frame rects and timing) |
| Colours | Separate sheets per colour (no runtime tinting), so engraving detail stays correct |

**States (rows)**

| Row | State | Frames | Loops | When |
|---|---|---|---|---|
| 0 | idle | 4 to 8 | Yes | Default. Subtle (breathing, a twitch). |
| 1 | selected | 2 to 4 | Yes | Piece picked up |
| 2 | move | 4 to 6 | No | Lift and slide, 180ms |
| 3 | capture | 4 to 6 | No | The capturing piece strikes |
| 4 | hit | 4 to 6 | No | Being captured: shake, then dust |
| 5 | blocked | 2 to 4 | Yes | Held by Gerald, frozen, or stuck |

Missing rows fall back to idle, then to the static SVG. A piece type with no sheet uses the SVG. Animations must never hide the piece's type: the silhouette stays readable in every frame.

### 5.5 Piece notes

- **Pawn:** small, stoic, determined. The pacifist pawn carries a tiny white flag.
- **Knight:** side-profile horse head. When Did I Do That? is ready, a faint rook outline sits behind it.
- **Bishop:** mitre with a slight lean. Twin Telepathy bishops share a fine dotted line.
- **Rook:** crenellated tower. A loaded cannon shows a small barrel at the base. A Berserker rook has a faint red aura.
- **Queen:** tallest, elaborate crown. During Quiet Quitting she sits with better posture. Pulses red when marked as a traitor.
- **King:** cross-topped crown, larger base. Heavy Is The Crown makes him droop. Red pulse in check. Gold aura when the decree is ready.

### 5.6 Modifier pieces

- **Pigeon (E001):** a city pigeon in the same engraving style. A dotted arrow shows its next hop.
- **Chancellor (E004):** rook base with a knight head rising from it.
- **Royal Guard (E003):** like a King, smaller, shield instead of a cross, silver tone. Silver confetti when captured.
- **Ghost pieces (D002):** owner sees 60% opacity with shimmer. Opponent sees a normal piece.

### 5.7 Gerald

A city pigeon at about 40% of a square, smaller than a piece, so he reads as a visitor. When he lands, a nameplate "GERALD" (DM Mono 9px) slides in with a small trophy and his interference count. Slightly ruffled. Not impressed.

## 6. Tile effects

Every Board Mutation has a distinct look that could plausibly happen to a wooden board.

| Effect | Look | Key values |
|---|---|---|
| Lava (A002) | Glowing orange-red, heat shimmer, small rising flames. Burn flash when a piece is lost. Next spot as an amber dashed outline (when previews are built). | Base `#8a2020`, glow `#e85020`, shimmer 2s |
| Infected (A001) | Dark green, white mycelium threads, slow pulse. Faint green on tiles about to be infected. | Base `#1a2808`, pulse 4s |
| Frozen (A004) | Light ice tint on the zone. Frozen pieces show a frost ring and a snowflake badge. Keep the zone quiet: tint only, no per-square frames. | Ice `#c8d0d8` at low opacity |
| Swamp (A006) | Dark green-brown, occasional bubbles. Pieces bob 2px. Squelch on entry. | Base `#182010`, bubbles every ~6s |
| Storm (A005) | Taken squares are dark slate with crumbling edges. Next wave is striped one wave ahead. Lost pieces burst into dust. | Slate `#5a6070`, void `#040404` |
| Gravity (A007) | Warning arrows on the board edge the move before. Pieces slide together. Pieces pushed off dissolve at the edge. | Slide 400ms |
| Vent (A003) | Hidden until used. Then a dark shaft with a grate. Flash on trigger. | |
| Fog (D001) | Near-black with a blue undertone. Soft 2-square edge, not a hard cut. Cat Mode moves the edge out 1 square. | Base `#080810` |
| Surveillance (D008) | Golden eye at 50%. Opens fully and pulses when a piece comes near. Slow blink. | Blink every 8s |
| No-fly line (C001) | Gold dashed line across the rank or file, animated, small crown at each end. | 2px, `#c8973a` |

## 7. Modifier cards and icons

### 7.1 Card anatomy

Every card shows five things at a glance: name, category, cost, curse rating, and the core rule. Built cards also show the real rules of the current build.

| Element | Spec |
|---|---|
| Size | 240×340 at 1×, ratio 9:13, scales |
| Background | `#13131a` near-black with a faint blue undertone |
| Category stripe | 3px bar across the top in the category colour |
| Border | 1px `#2a2a3e` |
| Category icon | Top-left, category colour |
| Modifier icon | Large, centre-top, category colour |
| ID | DM Mono 9px, dim |
| Name | Playfair 700, 16px, `#e8e6f0` |
| Type line | DM Mono 10px, category colour, uppercase |
| Rules | DM Sans 300, 12px |
| Flavor | Playfair italic 11px, dim, left border |
| Stats | Cost, curse pips, scope (Shared or Owner) |
| Curse pips | Filled ● red `#c0392b`, empty ○ `#2a2a3e`. Also shown as a number for screen readers. |
| Hover | Border turns category colour, card lifts 4px |
| Selected | 2px category border, 1.02 scale, glow |
| Banned / unavailable | Greyscale, 40% opacity, with a reason line |

### 7.2 Tier badges

| Tier | Badge | Text | Meaning |
|---|---|---|---|
| S | `#f0c040` | `#1a1000` | Match-changing |
| A | `#c878f0` | `#1a001a` | Strong |
| B | `#4090f0` | `#001030` | Light, situational |
| C | `#8a8298` | `#18120a` | Experimental (post-launch) |

The badge always shows the letter, and the detail view says the meaning in words.

### 7.3 Modifier icon set

Shipped: one icon per modifier plus one per category, in `game/src/assets/modifier-icons/` (`MOD-A002.svg`, `category-A.svg`, ...).

Rules for new icons:
- 48×48 viewBox, no fill by default, `stroke="currentColor"`.
- Main stroke 2.5, detail and hatching strokes about 1.4. Round caps and joins.
- Hatching for shading, matching the engraved pieces. No gradients.
- Colour always comes from CSS (the category colour). Never hard-code colour in the SVG.
- Must read at 16px. Test at 16, 24 and 48px.
- One clear silhouette per icon. No text inside icons.
- Next: authored icons for piece status badges (Gerald, frozen, swamp, pacifist, berserker, traitor, chain), replacing the letter markers.

## 8. UI system

### Layout

Two zones: the board, always centred, and the UI around it. The board is the anchor. UI recedes.

| Screen | Layout | Focus |
|---|---|---|
| Main menu | Card hub over a dim board | Logo and modes |
| Draft | Card grid with a detail sheet | Cards |
| Match | Top banners, framed board, bottom dock | The board |
| Run map | Full-screen illustrated map | Node path |
| The Roost | Records and profile today. Shop with runs. | Content |
| Post-match | Result card, optional survey | Result |
| Viktor dialogue | Board dimmed, portrait left, text right | Viktor |

On phones the board fills the screen width and panels stack below it.

### Match panels

- **Player banners:** name, avatar, rating (ranked only), active modifiers (icons), Madness bar, tempo and mercenary tokens.
- **Feed:** moves, modifier events and chat in one list. Collapses during 50 First Moves blackouts.
- **Status:** clock (when timed), captured pieces, draw offer, resign. Reginald's reviews appear in the feed.

### Buttons

| Type | Background | Border | Text | Use |
|---|---|---|---|---|
| Primary | Gold `#c8973a` | none | Ink | Main action |
| Secondary | Transparent | 1px gold | Gold | Back, skip |
| Danger | Transparent | 1px red `#b83228` | Red | Resign, abandon |
| Ability | Category colour at 20% | 1px category colour | Category colour | Abilities |
| Disabled | `#2a2a3e` | none | `#4a4760` | Unavailable |

### Ability bar

When a piece with an ability is selected, its ability button appears under the board. It shows the icon, a short name and the cooldown in moves. It pulses when ready. On cooldown, a ring empties. High-cost abilities ask for a target or confirmation.

## 9. Animation

Animations serve the deadpan. Chaos events get the gravity of important chess moments. Gerald lands with the weight of a checkmate. Nothing winks at the player.

### Board

| Animation | Spec |
|---|---|
| Piece move | Lift, slide on a slight 8px arc, small bounce. 180ms, `cubic-bezier(0.34, 1.56, 0.64, 1)`. Pieces arc over others. |
| Capture | Captured piece shakes (±3px, 100ms), then fades with a dust puff (200ms). Dignified. |
| Gerald lands | Drops from above with a wing flutter (200ms). Ripple on the tile. Nameplate slides in. The held piece dims. |
| Rook cannon | Rook shudders. Cannonball crosses in 400ms. Impact flash `#ffaa00`, 2px screen shake. |
| Lava burn | Square flashes, piece dissolves in embers. |
| Storm wave | Squares crumble inward. Caught pieces burst into dust (300ms). |
| Gravity shift | Warning arrows, then every piece slides together (400ms). Pieces off the edge dissolve. With Phaser: board tilts 15° (600ms), slides, returns (400ms). |
| YOU DIED | Screen fades to near-black (300ms). "A PIECE MOVED" fades in (500ms), holds 1200ms, fades out. 2s total. |
| Traitor | Piece glows red for one move. On defection it flips colour (400ms). An ejection card slides up: "[Piece] was The Traitor." Holds 1.5s. |
| Berserker chain | Each capture at 0.7× speed. Red flash on chain squares. Small victory bob after. |

### UI

| Animation | Spec |
|---|---|
| Card deal | Cards deal from a deck to their slots, 60ms stagger, flip on arrival (150ms). |
| Rating change | Number counts up or down over 1.5s. Gold for gain, red for loss. Tier badge updates after. |
| Reginald's review | Panel slides in (150ms), holds, slides out. Must not block play. |

**Reduced motion:** if the player turns on reduced motion (or the OS asks for it), skip screen shake, board tilt and particle storms. Keep fades short. Still show what happened.

## 10. Viktor and characters

### Viktor Crumb

A disgraced grandmaster in his early 50s. Dressed too formally for wherever he is. A permanently composed face: a man who has decided never to be surprised again, and is surprised all the time.

- **Portrait:** 200×260, waist-up, same engraving style.
- **5 states:** Composed, Unsettled, Unravelling, Lost, Full Flock (eyes wide, pigeon on head).
- **Clothes:** dark formal jacket, white shirt, an old tournament badge. The badge is askew from Madness tier 3 and gone at tier 4.
- **Pigeons:** one on his shoulder at 51+, two at 76+. At Full Flock he is covered in pigeons. His face stays composed.

### Bosses

| Tower | Boss | Look |
|---|---|---|
| 1 | The Prodigy | 8-year-old in oversized formal wear. Serene. Margaret the pigeon sits on the board, concentrating. |
| 2 | The Archivist | Elderly, behind stacks of chess books, reading glasses. Has seen this position before. |
| 3 | The Groundskeeper | Gardening apron over formal wear, plants growing from the board, a watering can. Calm about the mold. |
| 4 | The Diplomat | Impeccably dressed, bows before every move. Face hidden in fog, hands always visible. |
| 5 | The Flock | 12 pigeon thumbnails in a grid. One is Gerald. He looks like he knew. |

### Reginald Beak

A pigeon with a monocle and a "CRITIC" press badge. Review panel 200×60, portrait 40×40 circle. Resting face of deep disappointment. His face never changes, even for an 8/10.

## 11. Madness visual states

| Tier | Board | UI | Viktor |
|---|---|---|---|
| Composed (0 to 25) | Default warm light | Gold accents, clean type | Composed, no pigeons |
| Unsettled (26 to 50) | More grain, rare wrong shadows, ink bleed at tile edges | Gold shifts amber, faint page grain | Slight tension |
| Unravelling (51 to 75) | Brief wrong-colour flicker (150ms), pigeon shadows drift every 30s | Headings flicker italic | One pigeon, badge askew |
| Lost (76 to 99) | Violet undertone, extra shadows, faint feathers | Letter swaps that correct themselves | Two pigeons, badge gone |
| Full Flock (100) | Feather storm, iridescent piece sheen | Feather texture on all chrome, plum accents | Covered in pigeons, still composed |

Madness effects must never make a piece or a legal move hard to read. Flickers never touch pieces, highlights or the ability bar.

## 12. Cosmetics

Cosmetics change looks only, never gameplay.

| Category | Replaces | Rules | Examples |
|---|---|---|---|
| Board themes | Tiles, frame, grain, light | Light and dark squares stay clear at every Madness level | Marble Palace, Moonlit Garden, The Sewers |
| Piece sets | All piece types, or some | King stays tallest. Pieces stay distinct from tiles. Follow the sprite spec (5.4). | Full Pigeon Set, Rubber Ducks, Cursed Statues |
| Card art | Card illustration | Category stripe and stats stay readable | Watercolour Winter, Pixel Lava |
| Pigeon companions | Gerald's look | Bird-like, same size as Gerald, landing and idle animations | Corporate Gerald, Goth Gerald, Margaret |
| Viktor outfits | Portrait clothes | Waist-up, same face, Madness still applies | Hoodie Viktor, Tuxedo Viktor |
| Capture effects | Capture animation | Under 400ms, never hides the board | Feather shower, Golden dust |

### Community submission checklist

1. One complete style: Victorian engraving, or a full alternate style. No mixing.
2. Readable at 50% zoom.
3. Works under the Full Flock plum tint.
4. Card art keeps the category stripe clear.
5. No real trademarked characters. Pop-culture nods are fine.
6. Formats: SVG or PNG for static art, sprite sheets per section 5.4. Max 512×512 per sprite, 2048×2048 per sheet.

### Battle Pass cadence

Each 50-tier pass: 1 board theme, 1 piece set, 2 companions (1 free, 1 premium), 1 Viktor outfit (premium), 3 card art skins, 1 capture effect, 2 titles. The free track must feel rewarding on its own.

## 13. Accessibility

1. **Never colour alone.** Every colour signal also has an icon, shape, pattern or text. Examples: curse pips also show a number; cost shows a +/− sign; storm uses stripes, lava uses flames.
2. **Colour-blind check.** Test category colours, highlights and hazards with deuteranopia, protanopia and tritanopia filters. Red vs green must never be the only difference.
3. **Contrast.** Body text at least 4.5:1 against its background. Pieces must read on both square colours. A high-contrast mode exists and must keep working.
4. **Text size.** On phones: body at least 14px, labels at least 12px. Mono micro text only for non-essential IDs.
5. **Motion.** Respect reduced motion (section 9).
6. **Touch.** Tap targets at least 44×44px. Long-press shows the same tooltips as hover.
7. **Screen readers.** Pieces and squares have labels ("white knight on f3, held by Gerald"). Event banners are announced.

## 14. Audio direction

Sound follows the same rule as visuals: serious presentation, absurd content. A pigeon coo is recorded like an orchestra hit.

### Tone

- **Base:** warm, wooden, quiet. Pieces on a felted wood board. A distant clock.
- **Chaos:** modifier events are short, clear and dramatic. A gong for big events, a cannon for the rook, wet squelch for the swamp, a sharp chime for freezing.
- **Music:** menu and match tracks. Calm and classical by default. Madness can add small wrong notes later.

### Event sounds

| Event | Sound | Status |
|---|---|---|
| Move, capture, castle | Wood on wood, sharper for capture | In game |
| UI click | Soft paper or wood tick | In game |
| Menu and match music | Looping tracks | In game |
| Check | Short warning tone | Made, not wired |
| Lava burn | Hiss and crackle | Made, not wired |
| Gerald lands | Wing flutter and coo | Made, not wired |
| Freeze | Ice chime | Made, not wired |
| Rook cannon | Cannon boom | Made, not wired |
| Berserker chain | Grunt or war cry | Made, not wired |
| Traitor | Ejection sting | Made, not wired |
| Storm wave | Rumble and wind | Made, not wired |
| Vent | Metal clank and whoosh | Made, not wired |
| Ability used | Short magical sting | Made, not wired |
| Big event (YOU DIED, gravity) | Gong | Made, not wired |

"Made, not wired" sounds are in the project files under `sounds/`.

### Mix rules

- Three volume groups: music, effects, UI. Each has its own slider.
- Moves and UI are the quietest. Modifier events sit above them. Big events are loudest but short.
- Effects under 1.5s (music and ambience excepted). Nothing should mask the next move sound.
- Same event, same sound. Small pitch variation (±5%) on repeated sounds like moves.
- Every sound has a visual twin, so the game is fully playable muted.

### Files

- Ship as `.mp3` (or `.ogg`) at 44.1 kHz, normalised to the same loudness. Keep `.wav` masters outside the build.
- Names in kebab-case: `lava-burn.mp3`, `gerald-lands.mp3`.
- Location: `game/public/sounds/`.
