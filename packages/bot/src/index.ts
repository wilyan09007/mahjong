/**
 * `@mahjong/bot` public API.
 *
 * A bot is just a seat whose actions come from code. It consumes the same
 * `PlayerView` a human client receives — never `GameState` — so it cannot see
 * the wall or anyone else's tiles, which is what makes it honest cover for a
 * disconnected player.
 */

export { chooseBotAction } from './bot.js';
export { shanten16 } from './shanten.js';
