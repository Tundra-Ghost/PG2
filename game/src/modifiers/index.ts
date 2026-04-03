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

modifierRegistry.register(floorIsLavaDef);
modifierRegistry.register(geraldDef);
modifierRegistry.register(winterIsComingDef);
modifierRegistry.register(conscientiousObjectorDef);
modifierRegistry.register(berserkerDef);
