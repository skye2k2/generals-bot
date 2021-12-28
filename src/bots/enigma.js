/**
 * This bot randomly moves its largest army to a random foggy location
 *
 */
const OPENING_FIRST_MOVE_THRESHOLD = 24;  //24 game ticks = 12 armies

const TERRAIN_EMPTY = -1; // empty or city or enemy
// const TERRAIN_MTN = -2;
const TERRAIN_FOG = -3;  //empty or swamp or occupied
// const TERRAIN_FOG_MTN = -4; //city or mnt
const USEFUL_ARMY_THRESHOLD = 2;

let ai = {
  game: undefined, // TODO: If we make the data arrays into sets, we don't have to worry about pushing repeat state, like known city locations
  intel: {
    map: [],
    locations: [],
    attackQueue: [],
    opponents: [],
    myScore: {total: 0, tiles: 0, lostArmies: false, lostTerritory: false},
    myTopArmies: [], // The map locations we own and have a minimum number of armies available.
    emptyTerritories: [], // The map locations we can see that are free to conquer.
    foggedTerritories: [],
    visibleOpponentTerritories: [],
    unexploredTerritories: [], // The set of remaining board indices we have not yet explored while searching for generals.
    log: Array(5), // Set up limited-length history, with turn info, foreign policy, and other important data to track over time.

  },

  init: function (game) {
    this.game = game;
  }, /**
   * Taking all game data into account, plan and execute moves.
   * @param {*} game - The game state that we determine actions from.
   */
  move: function () {
    this.game.intel = this.intel; // Re-initialize intel
    this.determineIntel();
    this.determineMoves();

    // while (this.game.intel.attackQueue.length) {
    if (this.game.intel.attackQueue.length > 0) {
      // AS LONG AS FOREIGN POLICY DOES NOT DRAMATICALLY CHANGE, WORK THROUGH FIFO QUEUE OF MOVES
      let currentMove = this.game.intel.attackQueue.shift();
      let moveInfo = `TURN ${this.game.turn}: ${currentMove.mode}: ${currentMove.attackerIndex} --> ${currentMove.targetIndex} ${(currentMove.sendHalf) ? ' (HALF)' : ''}`;
      console.log(moveInfo);
      this.game.intel.log.unshift({mode: currentMove.mode, attackerIndex: currentMove.attackerIndex, targetIndex: currentMove.targetIndex}); // push to front of log array--returns new length
      this.game.intel.log.length = 5;
      this.game.socket.emit("attack", currentMove.attackerIndex, currentMove.targetIndex, currentMove.sendHalf);
    }
  },

  /**
   * Calculate queue of attack moves to accomplish foreignPolicy goal
   */
  determineMoves: function () {

    // if (this.game.turn <= OPENING_FIRST_MOVE_THRESHOLD) {
    //   // Build armies at first
    //   return;
    // }

    if (this.game.intel.attackQueue.length > 0) {
      let nextAttacker = this.makeLocationObject(this.game.intel.attackQueue[0].attackerIndex)
      if (nextAttacker.armies < 2 || !nextAttacker.isMine) {
        this.game.intel.attackQueue = []
      }
    }

    if (this.game.intel.attackQueue.length < 1) {
      this.queueEasyWins(this.game.intel.myTopArmies)
    }

    // Don't queue up new stuff if there is stuff to do.
    if (this.game.intel.attackQueue.length < 1) {
      // move largest army to random empty Territory
      const random = Math.floor(Math.random() * this.game.intel.foggedTerritories.length);
      let nextMoveLocations = this.findPath(this.game.intel.myArmies[0], this.game.intel.foggedTerritories[random])
      for (let i = nextMoveLocations.length - 1; i > 0; i--) {
        this.game.intel.attackQueue.push({
          mode: "Random", attackerIndex: nextMoveLocations[i].idx, targetIndex: nextMoveLocations[i - 1].idx, sendHalf: false
        });
      }
    }
  },

  queueEasyWins(availableArmies) {
    for(let i = 0; i<availableArmies.length; i++) {
      let neighbors = this.findNeighbors(availableArmies[i])
      for(let n = 0; n<neighbors.length; n++) {
        if(neighbors[n].attackable && availableArmies[i].armies > neighbors[n].armies+1) {
          this.game.intel.attackQueue.push({mode: "EasyWin", attackerIndex: availableArmies[i].idx, targetIndex: neighbors[n].idx, sendHalf: false})
          return //Only queue one for each attacker
        }
      }
    }
  },

  findNeighbors(location) {
    const row = Math.floor(location.idx / this.game.mapWidth);
    const col = location.idx % this.game.mapWidth;
    let neighbors = []
    if (this.intel.map[row - 1] && this.intel.map[row - 1][col]) {
      neighbors.push(this.makeLocationObject((row - 1) * this.game.mapWidth + col))
    }
    if (this.intel.map[row + 1] && this.intel.map[row + 1][col]) {
      neighbors.push(this.makeLocationObject((row + 1) * this.game.mapWidth + col))
    }
    if (this.intel.map[row] && this.intel.map[row][col - 1]) {
      neighbors.push(this.makeLocationObject(row * this.game.mapWidth + (col - 1)))
    }
    if (this.intel.map[row] && this.intel.map[row][col + 1]) {
      neighbors.push(this.makeLocationObject(row * this.game.mapWidth + (col + 1)))
    }
    return neighbors
  },

  findPath: function (location, targetLocation) {
    let distanceMap = this.createDistanceMap(location)
    let pathIndexes = this.findShortestPath(distanceMap, targetLocation)
    console.log("New Path:" + JSON.stringify(pathIndexes))
    return pathIndexes;
  },

  findShortestPath: function (distanceMap, targetLocationOrPath) {
    let path = []
    if (Array.isArray(targetLocationOrPath)) {
      path = targetLocationOrPath
    } else {
      path.push(targetLocationOrPath)
    }
    let lastInPath = path[path.length - 1]
    // Map Path Distance
    let neighborLocation = this.findNeighbors(lastInPath)
    let chosenPath = lastInPath;
    for (let i = 0; i < neighborLocation.length; i++) {
      if (distanceMap[neighborLocation[i].idx] < distanceMap[chosenPath.idx]) {
        chosenPath = neighborLocation[i]
      }
    }
    if (chosenPath !== lastInPath) {
      path.push(chosenPath)
      path = this.findShortestPath(distanceMap, path)
    }
    // create path from target
    return path
  },

  createDistanceMap: function (location) {
    let distanceMap = []
    let queue = [location]
    distanceMap[location.idx] = 0

    while (queue.length > 0) {
      let currentLocation = queue.shift();
      let currentDistance = distanceMap[currentLocation.idx]
      if (currentDistance !== "M") {
        let neighbors = this.findNeighbors(currentLocation)
        for (let i = 0; i < neighbors.length; i++) {
          if (typeof distanceMap[neighbors[i].idx] === 'undefined') {
            queue.push(neighbors[i])
            if (neighbors[i].terrain === TERRAIN_FOG || neighbors[i].terrain >= TERRAIN_EMPTY) {
              distanceMap[neighbors[i].idx] = currentDistance + 1;
            } else {
              distanceMap[neighbors[i].idx] = "M"
            }
          }
        }
      }
    }

    return distanceMap
  },

  /**
   * Calculate intel based on board state.
   */
  determineIntel: function () {
    this.parseMap();
  },

  /**
   * Extract map state into actionable data.
   * Locations with a -1 map to emptyTerritories.
   * Locations matching playerIndex and a count >= USEFUL_ARMY_THRESHOLD map to standingArmies.
   * Locations with a terrain index != playerIndex are enemy locations.
   */
  parseMap: function () {

    if (this.game.turn === 1) {
      this.game.intel.unexploredTerritories = new Set([...Array(this.game.mapSize).keys()]);
    }

    this.game.intel.emptyTerritories = [];
    this.game.intel.foggedTerritories = [];
    this.game.intel.visibleOpponentTerritories = [];
    this.game.intel.myArmies = [];
    this.game.intel.myTopArmies = [];
    this.game.intel.totalAvailableArmyPower = 0;

    // Loop through map array once, and sort all data appropriately.

    //const row = Math.floor(idx / this.game.mapWidth);
    //const col = idx % this.game.mapWidth;
    //const index = row * this.game.mapWidth + col
    for (let row = 0; row < Math.floor(this.game.terrain.length / this.game.mapWidth); row++) {
      this.intel.map[row] = []
      for (let column = 0; column <= (this.game.terrain.length - 1) % this.game.mapWidth; column++) {
        let idx = row * this.game.mapWidth + column
        this.intel.map[row][column] = this.makeLocationObject(idx)
      }
    }
    for (let idx = 0; idx < this.game.terrain.length; idx++) {
      this.game.intel.locations[idx] = this.makeLocationObject(idx)
      if (this.game.terrain[idx] === this.game.playerIndex) {
        this.game.intel.unexploredTerritories.delete(idx);
        if (this.game.armies[idx] > 1) {
          this.game.intel.totalAvailableArmyPower += this.game.armies[idx] - 1;
        }
      }
    }

    this.game.intel.emptyTerritories = this.game.intel.locations.filter((location) => location.terrain === TERRAIN_EMPTY);
    this.game.intel.foggedTerritories = this.game.intel.locations.filter((location) => location.terrain === TERRAIN_FOG);
    this.game.intel.myArmies = this.game.intel.locations.filter((location) => location.isMine);
    this.game.intel.myTopArmies = this.game.intel.locations.filter((location) => location.isMine && location.armies >= USEFUL_ARMY_THRESHOLD);
    this.game.intel.visibleOpponentTerritories = this.game.intel.locations.filter((location) => location.terrain > TERRAIN_EMPTY && location.terrain !== this.game.playerIndex);

    // sort() so that our largest army will be at the front of the array.
    this.game.intel.myArmies.sort((a, b) => b.armies - a.armies);
  },

  makeLocationObject(locationIdx){
    let terrain = this.game.terrain[locationIdx]
    return {
      idx: locationIdx,
      armies: this.game.armies[locationIdx],
      terrain: terrain,
      isMine: terrain === this.game.playerIndex,
      attackable: terrain === TERRAIN_EMPTY || (terrain > TERRAIN_EMPTY && terrain !== this.game.playerIndex)
    }
  }

}

export default ai;
