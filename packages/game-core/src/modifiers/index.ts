/**
 * Modifier registration — import this file once as a side-effect to register
 * all active modifier definitions into the global registry.
 */
import { modifierRegistry } from './registry';
import { floorIsLavaDef } from './definitions/floor-is-lava';
import { geraldDef } from './definitions/gerald';
import { winterIsComingDef } from './definitions/winter-is-coming';
import { conscientiousObjectorDef } from './definitions/conscientious-objector';
import { berserkerDef } from './definitions/berserker';
import { thisIsMySwampDef } from './definitions/this-is-my-swamp';
import { reginaldBeakDef } from './definitions/reginald-beak';
import { smallCouncilDef } from './definitions/small-council';
import { traitorDef } from './definitions/traitor';
import { rejectQueenDef } from './definitions/reject-queen';
import { chancellorDef } from './definitions/chancellor';
import { twinTelepathyDef } from './definitions/twin-telepathy';
import { ventTilesDef } from './definitions/vent-tiles';
import { didIDoThatDef } from './definitions/oops-knight';
import { retaliatorySwipeDef } from './definitions/retaliatory-swipe';
import { forTheEmperorDef } from './definitions/for-the-emperor';

modifierRegistry.register(floorIsLavaDef);
modifierRegistry.register(geraldDef);
modifierRegistry.register(winterIsComingDef);
modifierRegistry.register(conscientiousObjectorDef);
modifierRegistry.register(berserkerDef);
modifierRegistry.register(thisIsMySwampDef);
modifierRegistry.register(reginaldBeakDef);
modifierRegistry.register(smallCouncilDef);
modifierRegistry.register(traitorDef);
modifierRegistry.register(rejectQueenDef);
modifierRegistry.register(chancellorDef);
modifierRegistry.register(twinTelepathyDef);
modifierRegistry.register(ventTilesDef);
modifierRegistry.register(didIDoThatDef);
modifierRegistry.register(retaliatorySwipeDef);
modifierRegistry.register(forTheEmperorDef);
