/**
 * File: testHelper.js
 * Purpose: To provide a configurable known game state for use in automated testing.
 */

export const gameDefaults = {
  map: [],
  generals: [], // The indices of generals we know of.
  cities: [], // The indices of cities we have vision of.
  knownCities: [], // city indices that may or may not be currently visible.
  armies: [], // The number of armies on each location visible to player.
  terrain: [], // The type of terrain visible to player.
  mapWidth: 5,
  mapHeight: 5,
  mapSize: 25,
  myGeneralLocationIndex: 6,
  playerIndex: 1,
  opponents: [{color: "RED", dead: false, tiles: 1, total: 10, availableArmies: 9}],
  // TODO: opponents is still not coming through to be used as expected
  turn: 25,
  gameOver: false,
};

// const TILE_EMPTY = -1;
// const TILE_MOUNTAIN = -2;
// const TILE_FOG = -3;
// const TILE_FOG_OBSTACLE = -4;
// const WHAT_ABOUT_SWAMP = ??

// The map state is represented by a multi-stage one-dimensional array, where the first two entries dictate the width and height of the board, the next width * height entries represent visible armies, and the next width * height entries represent the corresponding terrain.

// prettier-ignore

const armyOptions = {
  allArmiesOnGeneral: [ // Default testing setup
    -1, -1, -1, -1, -1,
    -1, 25, -1, -1, -1,
     1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1,
  ],
  twoLargeArmies: [ // For testing pick up along the way functionality
    -1, -1, -1, -1, -1,
    -1, 15, -1, -1, -1,
    10, -1, -1, -1, -1,
    -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1,
  ],
  cornerArmies: [ // For testing gather function
     5,  5, -1, -1, -1,
     5,  5,  5, -1, -1,
    -1,  5, -1, -1, -1,
    -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1,
  ],
}

const terrainOptions = {
  empty: [
    -1, -1, -1, -1, -1,
    -1,  1, -1, -1, -1,
     1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1,
    -1, -1, -1, -1,  0,
  ],
  mountainous: [
    -1, -1, -1, -1, -1,
    -1,  1, -1, -2, -1,
     1, -1, -2, -1, -1,
    -1, -1, -1, -1, -2,
    -1, -1, -2, -1,  0,
  ],
  foggy: [
    -1, -1, -1, -1, -1,
    -1,  1, -1, -1, -1,
     1, -1, -1, -1, -1,
    -1, -1, -1, -3, -3,
    -1, -1, -1, -3, -3,
  ],
  occupiedCorner: [
     1,  1, -1, -1, -1,
     1,  1,  1, -1, -1,
    -1,  1, -1, -1, -1,
    -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1,
  ],
};

/**
 * Initialize one of multiple known game states, for automated testing of bot logic.
 * @param {('empty'|'mountainous'|'foggy'|'occupiedCorner')} terrainMode - The terrain map to use.
 * @param {('allArmiesOnGeneral'|'twoLargeArmies'|'cornerArmies')} armyMode - The army map to use.
 * @returns {object} - A game object initialized into the requested state.
 */
export function initializeGameState (terrainMode, armyMode) {
  const game = gameDefaults;

  game.terrain = terrainOptions[terrainMode];
  game.armies = armyOptions[armyMode];

  if (game.terrain && game.armies) {
    // console.dir(game);
    return game;
  } else {
    console.warn(`Unrecognized game option(s) received: ${terrainMode}, ${armyMode}`);
    return null;
  }

};

export function simulateMove (game) { // maybe need to pass the entire bot
  // IF THERE IS A MOVE QUEUED, UPDATE GAME STATE ACCORDINGLY (turn, armies, terrain, visible general, win)
}
