/**
 * Triggers:
 * - If the game turn is still under 50, you can uncover your general
 * - If there are large armies near my general (or if my general armies ever decrease without the cause being my active cursor)
 * - If one of my neighbors gets conquered
 * - If my general is discovered (someone explores or penetrates to a space next to my general--if there is *ever* a color not part of my team next to my general)
 * - If there is a visible city with < 10 troops
 * - If there is a close available city, I have enough troops to capture, and no neighboring colors are actively attacking me or I have enough armies that losing the difference won't matter (especially when someone else captures, or captures and moves away)
 * - If one of my neighbors suddenly starts losing significant armies
 * - If I am the least/most-powerful remaining player
 * - If my general is located in a highly defensible position (board corner, funneling mountains)
 * - If I have made no move in three+ turns
 */

// Consider % of total strength when determining whether to gather from additional locations
// Consider sprawl when calculating threats--generally much harder for opponents with a larger domain to muster an equivalent force
// Make use of the 1 army assumption to lead attackers away from my undiscovered general
// Make use of 50% movement action, to keep from uncovering general
// Path of least resistance vs path of maximum damage depends on foreignPolicy
// Attempt to bait out camping general armies by staying just out of reach and then looping around

/* TO DO:
 * Stop attacking cities before we can take them
 * If any teensy army has a free capture, use it
 * Expand aggressively as long as we are undiscovered
 * After discovery, if using general as source, only send half
 * If we cannot determine an attack, consolidate to general
 */


const DIRECTIONS_MAP = [
	'north',
	'east',
	'south',
	'west',
];

const OPENING_GAME_TURN_THRESHOLD = 50;
const EARLY_GAME_TURN_THRESHOLD = 100;
const MID_GAME_TURN_THRESHOLD = 200;

const TERRAIN_EMPTY = -1;
// const TERRAIN_MTN = -2;
// const TERRAIN_FOG = -3;
// const TERRAIN_FOG_MTN = -4;


let ai = {
	game: undefined,
	// TODO: If we make the data arrays into sets, we don't have to worry about pushing repeat state, like known city locations
	intel: {
		attackQueue: [],
		emergencyOrdersStandUntilTurnNumber: null,
		foreignPolicy: 'EXPLORE',
		log: Array(5), // Set up limited-length history, with turn info, foreign policy, and other important data to track over time.
		opponents: [],
		myScore: {total: 0, tiles: 0, lostArmies: false, lostTerritory: false},
		myTopArmies: [], // The map locations we own and have a minimum number of armies available.
		emptyTerritories: [], // The map locations we can see that are free to conquer.
		visibleOpponentTerritories: [],
		unexploredTerritories: [], // The set of remaining board indices we have not yet explored while searching for generals.
		undiscovered: true, // Whether we have not been seen, yet.
		USEFUL_ARMY_THRESHOLD: 2,
	},

	init: function (game) {
		this.game = game;
	},
	/**
	 * Taking all game data into account, plan and execute moves.
	 * @param {*} game - The game state that we determine actions from.
	 */
	move: function () {
		this.game.intel = this.intel; // Re-initialize intel
		this.determineIntel();
		this.determineForeignPolicy();
		this.determineMoves();

		// while (this.game.intel.attackQueue.length) {
		if (this.game.intel.attackQueue.length) {
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
		let armyInfo;
		let armyIndex;
		let armyPower;
		let targetInfo;
		let targetIndex;
		let targetPower;

		// If we have enough armies to take a city, do it
		// console.log(`TOTAL AVAILABLE ARMIES: ${this.game.intel.totalAvailableArmyPower}`);
		// Consolidate necessary armies down to general, split, if we have enough, and send to attack

		// Prioritize easy expansion into empty territories and enemy tiles we can conquer. This forms the backbone of the bot's power.
		if (this.game.turn > OPENING_GAME_TURN_THRESHOLD) {// && (this.game.intel.foreignPolicy === "EXPLORE" || this.game.intel.foreignPolicy === "EXPAND")) { // TODO: Modify this once we take more factors into account for panicking on discovery.
			if (!this.game.intel.attackQueue.length) {
				this.generateAllSimpleAttacks(this.game.intel.visibleOpponentTerritories.concat(this.game.intel.emptyTerritories), this.game.intel.myTopArmies);
			}

			if (this.game.intel.attackQueue.length) {
				return;
			}
		} else {
			// If something important happens, empty the attack queue, so that we can respond appropriately, in time.
			this.game.intel.attackQueue.length = 0;
		}

		// return this.BETA_flood("east", "south", this.game.intel.myStandingArmies);

		if (this.game.intel.log[0]) {
			// Keep using the same army for as long as possible
			if(this.game.armies[this.game.intel.log[0].targetIndex] > 1) {
				if (this.game.turn < OPENING_GAME_TURN_THRESHOLD + EARLY_GAME_TURN_THRESHOLD || this.game.intel.log[0].targetIndex !== this.game.myGeneralLocationIndex) {
					armyInfo = this.calculateTileLocationInfo(this.game.intel.log[0].targetIndex);
				}
			} else {
				armyInfo = this.pickArmy();
			}
		} else {
			armyInfo = this.pickArmy();
		}

		if (armyInfo) {
			armyIndex = armyInfo.locationIndex;
			armyPower = armyInfo.locationPower;

			targetIndex = this.findAttackableSpace(armyInfo);

			if (targetIndex) {
				targetPower = this.game.armies[targetIndex];

				// Always send the whole army if passing through own territory or attacking empty spaces, unless we are trying to protect our general.
				let shouldSendWholeStrength = true; //(this.game.terrain[targetIndex] === this.game.playerIndex || (targetPower !== 0 && armyPower / 2 > targetPower + 1))
				// SEND HALF LOGIC SEEMS A LITTLE BROKEN

				// Add to FIFO attack queue
				this.game.intel.attackQueue.push({mode: this.game.intel.foreignPolicy, attackerIndex: armyIndex, targetIndex, sendHalf: (shouldSendWholeStrength) ? false : true});

			} else {
				console.warn(`TURN ${this.game.turn}: SKIPPED: (no attack target selected)`);
			}

		} else {
			this.generateAllSimpleAttacks(this.game.intel.visibleOpponentTerritories.concat(this.game.intel.emptyTerritories), this.game.intel.myStandingArmies);

			if (this.game.intel.attackQueue.length === 0) {
				console.warn(`TURN ${this.game.turn}: SKIPPED: (no available army found)`);
			}
		}
	},

	/**
	 * !Recursive!
	 * For each space, if there is an immediately-available army, add an attack to the queue.
	 * @param {array} spacesToAttack - Array of spaces we want to attack. Initial passed-in value is generally the list of empty spaces combined with the list of visible enemy spaces.
	 * @param {array} availableArmies - Array of armies to check that we can attack from.
	 * @param {object} game - Reference including game intelligence.
	 * @returns null - Pushes any discovered moves to the attack queue directly.
	 */
	generateAllSimpleAttacks: function (spacesToAttack, availableArmies) {
		if (spacesToAttack.length === 0) {
			return;
		}

		// Limit recursion: Remove current target from spacesToAttack
		let targetIndex = spacesToAttack.shift();
		let attackerIndex = -1;
		let indexInArray;

		// See if any free armies of sufficient strength neighbor the target space
		for (let idx = 0; idx < availableArmies.length; idx++) {
			let spaceInfo = this.calculateTileLocationInfo(availableArmies[idx].locationIndex);

			// To make the bot hyper aggressive on cleaning up incursions, allow a remove the -1 to allow a zero result so that on the next time through, a neighbor could clean up the remainder.
			if (spaceInfo.north && spaceInfo.north.locationIndex === targetIndex && spaceInfo.locationPower - 1 > spaceInfo.north.locationPower) {
				attackerIndex = spaceInfo.locationIndex;
				indexInArray = idx;
				break;
			} else if (spaceInfo.east && spaceInfo.east.locationIndex === targetIndex && spaceInfo.locationPower - 1 > spaceInfo.east.locationPower) {
				attackerIndex = spaceInfo.locationIndex;
				indexInArray = idx;
				break;
			} else if (spaceInfo.south && spaceInfo.south.locationIndex === targetIndex && spaceInfo.locationPower - 1 > spaceInfo.south.locationPower) {
				attackerIndex = spaceInfo.locationIndex;
				indexInArray = idx;
				break;
			} else if (spaceInfo.west && spaceInfo.west.locationIndex === targetIndex && spaceInfo.locationPower - 1 > spaceInfo.west.locationPower) {
				attackerIndex = spaceInfo.locationIndex;
				indexInArray = idx;
				break;
			}
		}

		if (attackerIndex !== -1) {
			// Limit recursion: Remove used army from availableArmies
			availableArmies.splice(indexInArray, 1);
			this.game.intel.attackQueue.push({mode: "CREEP", attackerIndex: attackerIndex, targetIndex: targetIndex});
		}

		this.generateAllSimpleAttacks(spacesToAttack, availableArmies);
	},

	// Remember and check against previous moves to avoid backtracking.
	// BUG: This is a problem when the last move is along a restricted path or into a corner, where it will be abandoned until 5 other moves are made...
	spaceIsInRecentHistory: function (targetIndex) {
		for (let idx = 0; idx < this.game.intel.log.length; idx++) {
			const logEntry = this.game.intel.log[idx];
			if (logEntry && logEntry.attackerIndex === targetIndex) {
				return true;
			}
		}
		return false;
	},

	findAttackableSpace: function (spaceInfo) {
		if (typeof spaceInfo === "number") {
			spaceInfo = this.calculateTileLocationInfo(spaceInfo);
		}
		let targetIndex;

		// Prioritize capture of free neighboring empty spaces.
		if (spaceInfo.north && spaceInfo.north.locationTerrain === TERRAIN_EMPTY) {
			targetIndex = spaceInfo.north.locationIndex;
		} else if (spaceInfo.east && spaceInfo.east.locationTerrain === TERRAIN_EMPTY) {
			targetIndex = spaceInfo.east.locationIndex;
		} else if (spaceInfo.south && spaceInfo.south.locationTerrain === TERRAIN_EMPTY) {
			targetIndex = spaceInfo.south.locationIndex;
		} else if (spaceInfo.west && spaceInfo.west.locationTerrain === TERRAIN_EMPTY) {
			targetIndex = spaceInfo.west.locationIndex;
		} // No free neighboring empty spaces.

		// TODO: Prioritize attacking tiles we have not yet explored
		// this.game.intel.unexploredTerritories

		switch (this.game.intel.foreignPolicy) {
			case 'EXPLORE':
			case 'EXPAND':
				// Check surrounding tiles for easy conquests (TODO: FIX RECURSION)
				// if (spaceInfo.north && this.findAttackableSpace(spaceInfo.north.locationIndex)) {
				// 	targetIndex = spaceInfo.north.locationIndex;
				// } else if (spaceInfo.east && this.findAttackableSpace(spaceInfo.east.locationIndex)) {
				// 	targetIndex = spaceInfo.east.locationIndex;
				// } else if (spaceInfo.south && this.findAttackableSpace(spaceInfo.south.locationIndex)) {
				// 	targetIndex = spaceInfo.south.locationIndex;
				// } else if (spaceInfo.west && this.findAttackableSpace(spaceInfo.west.locationIndex)) {
				// 	targetIndex = spaceInfo.west.locationIndex;
				// }
				break;
			case 'ATTACK':
			case 'MURDER': // We know a general location or have a neighboring enemy.
				// Prioritize opponent-owned attackable neighboring spaces.
				if (spaceInfo.north && spaceInfo.north.locationTerrain !== this.game.playerIndex && spaceInfo.locationPower > spaceInfo.north.locationPower && !this.spaceIsInRecentHistory(spaceInfo.north.locationIndex)) {
					targetIndex = spaceInfo.north.locationIndex;
				} else if (spaceInfo.east && spaceInfo.east.locationTerrain !== this.game.playerIndex && spaceInfo.locationPower > spaceInfo.east.locationPower && !this.spaceIsInRecentHistory(spaceInfo.east.locationIndex)) {
					targetIndex = spaceInfo.east.locationIndex;
				} else if (spaceInfo.south && spaceInfo.south.locationTerrain !== this.game.playerIndex && spaceInfo.locationPower > spaceInfo.south.locationPower && !this.spaceIsInRecentHistory(spaceInfo.south.locationIndex)) {
					targetIndex = spaceInfo.south.locationIndex;
				} else if (spaceInfo.west && spaceInfo.west.locationTerrain !== this.game.playerIndex && spaceInfo.locationPower > spaceInfo.west.locationPower && !this.spaceIsInRecentHistory(spaceInfo.west.locationIndex)) {
					targetIndex = spaceInfo.west.locationIndex;
				}
				break;
			default:
				console.warn(`UNRECOGNIZED foreignPolicy: ${this.game.intel.foreignPolicy}`);
				break;
		}

		// Randomly choose a direction, since the bot will always travel the same path, otherwise.
		// Use history to avoid immediate backtracking.
		// Keep track of looping, to avoid paralysis.
		let loopCount = 0;
		while(!targetIndex) {

			// TODO: Do not allow stealing from general, if we have been discovered.

			let chosenDirection = DIRECTIONS_MAP[Math.floor(Math.random() * 4)]; // Randomly pick a number between 0 and 3
			// Prioritize capture of non-self-owned spaces.
			// if (spaceInfo[chosenDirection].locationPower !== 1) { // this.game.terrain[spaceInfo[chosenDirection].locationIndex] !== this.game.playerIndex &&
			if (loopCount < 4) {
				if (spaceInfo[chosenDirection] && !this.spaceIsInRecentHistory(spaceInfo[chosenDirection].locationIndex)) {
					targetIndex = spaceInfo[chosenDirection].locationIndex;
				}
			} else if (loopCount < 8) {
				if (spaceInfo[chosenDirection]) {
					targetIndex = spaceInfo[chosenDirection].locationIndex;
				}
			} else if (spaceInfo[chosenDirection]) {
				targetIndex = spaceInfo[chosenDirection].locationIndex;
			}
			loopCount++;
			// }
		};

		return targetIndex;
	},

	/**
	 * Calculate posture based on game state
	 */
	 determineForeignPolicy: function () {
		let foreignPolicy = 'EXPLORE';

		// Force early-game exploration.
		if (this.game.turn < EARLY_GAME_TURN_THRESHOLD) {
			foreignPolicy = 'EXPLORE';
		} else {
			// Expand territory (cities) while undiscovered.
			if (this.game.intel.undiscovered) {
				foreignPolicy = 'EXPAND';
			} else { // AS LONG AS NO LIFE-THREATENING UPDATES EXIST AND WE HAVE ENOUGH TROOPS
				// if (this.game.intel.myScore.total - this.game.intel.myScore.tiles > EVERYONE_ELSE) {
				// 	foreignPolicy = 'MURDER';
				// }
			}
		}

		this.game.intel.foreignPolicy = foreignPolicy;
	},

	/**
	 * Calculate intel based on board state.
	 */
	determineIntel: function () {
		this.game.intel.USEFUL_ARMY_THRESHOLD = Math.floor(this.game.turn / MID_GAME_TURN_THRESHOLD) + 2;
		this.parseMap();
		// this.analyzeOpportunities();
	},

	// TODO: Pass in which army list to use
	pickArmy: function () {
		let locationInfo = false;

		for (let idx = 0; idx < this.game.intel.myTopArmies.length; idx++) {
			let armyInfo = this.game.intel.myTopArmies[idx];

			switch (this.game.intel.foreignPolicy) {
				case 'ATTACK':
				case 'EXPAND':
				case 'EXPLORE':
					// Don't be afraid of using armies from general for opening conquests.
					if (this.game.turn < EARLY_GAME_TURN_THRESHOLD && !this.game.intel.discovered) {
						locationInfo = this.calculateTileLocationInfo(armyInfo.locationIndex);
					}  else if (armyInfo.locationIndex !== this.game.myGeneralLocationIndex) {
						locationInfo = this.calculateTileLocationInfo(armyInfo.locationIndex);
					}
					break;
					case 'MURDER':
						// If we know our opponent's general's location, attack
						let foundAGeneralToAttack = false;
						for (let idx = 0; idx < this.game.generals.length; idx++) {
							if (this.game.generals[idx] !== -1) {
								if (this.game.scores) { // TODO: check scores to see if it is worth attacking
									// console.log(`\nFOUND A GENERAL TO MURDER!!!\n`);
									// foundAGeneralToAttack = true;
									// let listOfAttacksToMake = this.BETA_gatherArmiesToLocation(this.game.generals[idx], this.game.intel.myTopArmies);

									// console.log(`\nEXITED GENERAL RECURSION:\n`);
									// console.dir(listOfAttacksToMake);
									return;
								}
							}
						}

						if (!foundAGeneralToAttack) {
							// Pick an enemy next to us, and send all of our troops there
							locationInfo = this.findClosestOwnedLocation(this.game.intel.visibleOpponentTerritories[Math.floor(Math.random() * this.game.intel.visibleOpponentTerritories.length)]);

							// locationInfo = true; // Just force us to break out of the loop

							// let listOfAttacksToMake = this.BETA_gatherArmiesToLocation(jumpOffPoint, this.game.intel.myTopArmies);

							// console.log(`\nEXITED NON-GENERAL RECURSION!!!\n`);
							// console.dir(listOfAttacksToMake);
						}
					break;
				default:

			}

			if (locationInfo) {
				break; // Return the first army that meets our criteria.
			}
		}

		// IF STILL NO LOCATIONINFO AND NO MOVE QUEUE, LOOSEN UP RESTRICTIONS

		return locationInfo;
	},

	findClosestOwnedLocation: function (indexToCheck) {
		for (let idx = 0; idx < this.game.terrain.length; idx++) {
			if (this.game.terrain[idx] === this.game.playerIndex && (
				Math.abs(indexToCheck - idx) < 1 ||
				idx === indexToCheck - this.game.mapWidth ||
				idx === indexToCheck + this.game.mapWidth ||
				Math.abs(indexToCheck - this.game.mapWidth - idx) < 1 ||
				Math.abs(indexToCheck + this.game.mapWidth - idx) < 1
			)) {
				// console.log(`CLOSEST OWNED TILE to ${indexToCheck}: ${idx}`);
				return this.calculateTileLocationInfo(idx);
			}
		}
		// console.log(`DIDN'T FIND CLOSEST OWNED TILE, USING GENERAL: ${this.game.myGeneralLocationIndex}`)
		// return this.calculateTileLocationInfo(this.game.myGeneralLocationIndex); // We didn't find an easy jump-off point to attack from, so send the armies to the general space.
	},

	calculateTileLocationInfo: function (indexToCheck) {
		if (!indexToCheck) {
			return false;
		} else if (indexToCheck.locationIndex) {
			indexToCheck = indexToCheck.locationIndex
		}

		// Determine zero-indexed row and column for extended calculations
		const row = Math.floor(indexToCheck / this.game.mapWidth);
		const col = indexToCheck % this.game.mapWidth;

		// QUADRANT // Used to determine preferred exploration direction (towards nearest wall)

		const north = (row > 0) ? {
			locationIndex: indexToCheck - this.game.mapWidth,
			locationPower: this.game.armies[indexToCheck - this.game.mapWidth],
			locationTerrain: this.game.terrain[indexToCheck],
		} : null;
		const east = (col < this.game.mapWidth - 1) ? {
			locationIndex: indexToCheck + 1,
			locationPower: this.game.armies[indexToCheck + 1],
			locationTerrain: this.game.terrain[indexToCheck],
		} : null;
		const south = (row < this.game.mapHeight - 1) ? {
			locationIndex: indexToCheck + this.game.mapWidth,
			locationPower: this.game.armies[indexToCheck + this.game.mapWidth],
			locationTerrain: this.game.terrain[indexToCheck],
		} : null;
		const west = (col > 0) ? {
			locationIndex: indexToCheck - 1,
			locationPower: this.game.armies[indexToCheck - 1],
			locationTerrain: this.game.terrain[indexToCheck],
		} : null;

		return {
			locationIndex: indexToCheck,
			locationPower: this.game.armies[indexToCheck],
			row,
			col,
			north,
			east,
			south,
			west,
		}
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
		this.game.intel.visibleOpponentTerritories = [];
		this.game.intel.myStandingArmies = [];
		this.game.intel.myTopArmies = [];
		this.game.intel.totalAvailableArmyPower = 0;

		// Loop through map array once, and sort all data appropriately.
		for (let idx = 0; idx < this.game.terrain.length; idx++) {
			// TODO: As soon as we can prioritize attacking them, filter out cities, since they are listed as empty terrain
			if (this.game.terrain[idx] === TERRAIN_EMPTY) {
				this.game.intel.emptyTerritories.push(idx);
			} else if (this.game.terrain[idx] === this.game.playerIndex) {
				this.game.intel.unexploredTerritories.delete(idx);
				if (this.game.armies[idx] > 1) {
					this.game.intel.myStandingArmies.push({locationIndex: idx, locationPower: this.game.armies[idx] - 1});
					if (this.game.armies[idx] >= this.game.intel.USEFUL_ARMY_THRESHOLD) {
						// Don't include general in available armies list past a certain point
						if (this.game.turn < EARLY_GAME_TURN_THRESHOLD || idx !== this.game.myGeneralLocationIndex) {
							this.game.intel.myTopArmies.push({locationIndex: idx, locationPower: this.game.armies[idx] - 1}); // Subtract one from the power here, because any attack always leaves one army behind
						}
					}
					this.game.intel.totalAvailableArmyPower += this.game.armies[idx];
				}
			} else if (this.game.terrain[idx] > TERRAIN_EMPTY && this.game.terrain[idx] !== this.game.playerIndex) {
				this.game.intel.undiscovered = false;
				this.game.intel.visibleOpponentTerritories.push(idx);
			}
		}

		// sort() so that our largest army will be at the front of the array.
		this.game.intel.myStandingArmies.sort((a, b) => b.locationPower - a.locationPower);
		this.game.intel.myTopArmies.sort((a, b) => b.locationPower - a.locationPower);
	},

	/* IN-PROGRESS CORNER (UNUSED BETA FUNCTIONS) */

	// Recursive
	// You can pass in a locationIndex or a locationInfo, in addition to the list of armies of significance. The initial sourceArmies should be this.game.intel.myTopArmies, and tempQueue is an accumulator.
	// Limitations: Will only gather from connected owned spaces.
	BETA_gatherArmiesToLocation: function (locationInfo, sourceArmies = [], processedSpaces = [], tempQueue = []) {
		locationInfo = this.calculateTileLocationInfo(locationInfo);

		if (!locationInfo) {
			return tempQueue;
		}

		// Remove the current space from sourceArmies, if it exists, when checking against it
		if (sourceArmies.includes(locationInfo.locationIndex)) {
			sourceArmies.splice(sourceArmies.indexOf(locationInfo.locationIndex), 1);
		}

		// End recursion if we have processed all standing armies or if we have processed this space already
		if (!sourceArmies.length || processedSpaces.includes(locationInfo.locationIndex)) {
			return tempQueue;
		} else {
			processedSpaces.push(locationInfo.locationIndex)
		}

		for (let idx = 0; idx < DIRECTIONS_MAP.length; idx++) {
			const tileInfo = DIRECTIONS_MAP[idx]

			if (tileInfo && tileInfo.locationTerrain === this.game.playerIndex) {
				tempQueue.push(this.BETA_gatherArmiesToLocation(tileInfo.locationIndex, sourceArmies, processedSpaces, tempQueue));

				tempQueue.push({mode: "GATHER", attackerIndex: tileInfo.locationIndex, targetIndex: locationInfo.locationIndex});
			}
		}
		return tempQueue
	},

	/**
	 * Queue up moves to send all available armies as far in both directions as their territory extends.
	 * The initial availableArmies should be this.game.intel.myStandingArmies, passed in reversed if flooding west or north.
	 */
	BETA_flood: function (primaryDirectionToFlood, secondaryDirectionToFlood, availableArmies) {
		console.warn(`BEGINNING FLOOD!!! ${this.game.turn}`);
		let collectedArmies = [];
		let reversedOrder = false;

		if (secondaryDirectionToFlood === 'north' || secondaryDirectionToFlood === 'west') {
			reversedOrder = true;
			availableArmies = availableArmies.reverse();
		}

		availableArmies.forEach((army) => {
			// CLEAN UP LOGIC, SO WE DON'T ATTEMPT TO MOVE SIZE 1 ARMIES
			// if (this.game.armies[army.locationIndex] > 1) {

			// }

			const armyInfo = this.calculateTileLocationInfo(army);

			// If we own the space in the corresponding direction queue up a move in that direction
			if (armyInfo[secondaryDirectionToFlood] && armyInfo.locationIndex !== this.game.myGeneralLocationIndex) {
				const targetIndex = armyInfo[secondaryDirectionToFlood].locationIndex;

				if (this.game.terrain[targetIndex] === this.game.playerIndex) {
					this.game.intel.attackQueue.push({mode: `FLOOD (${secondaryDirectionToFlood})`, attackerIndex: armyInfo.locationIndex, targetIndex: targetIndex});

					collectedArmies.push(targetIndex);
				}
			}
		});

		if (primaryDirectionToFlood === 'north' || primaryDirectionToFlood === 'west') {
			collectedArmies = collectedArmies.reverse();
		}

		collectedArmies.forEach((army) => {
			const armyInfo = this.calculateTileLocationInfo(army);

			// If we own the space in the corresponding direction queue up a move in that direction
			if (armyInfo[primaryDirectionToFlood] && armyInfo.locationIndex !== this.game.myGeneralLocationIndex) {
				const targetIndex = armyInfo[primaryDirectionToFlood].locationIndex;

				if (this.game.terrain[targetIndex] === this.game.playerIndex) {
					this.game.intel.attackQueue.push({mode: `FLOOD (${primaryDirectionToFlood})`, attackerIndex: armyInfo.locationIndex, targetIndex: targetIndex});
				}
			}
		});

	},

	BETA_determinePathToTarget: function (sourceInfo, destinationInfo, moveQueue = []) {
		sourceInfo = this.calculateTileLocationInfo(sourceInfo);
		destinationInfo = this.calculateTileLocationInfo(destinationInfo);

		// End recursion
		if (sourceInfo.north.locationIndex === destinationInfo.locationIndex ||
		sourceInfo.east.locationIndex === destinationInfo.locationIndex ||
		sourceInfo.south.locationIndex === destinationInfo.locationIndex ||
		sourceInfo.west.locationIndex === destinationInfo.locationIndex) {
			moveQueue.push({mode: "GATHER", attackerIndex: sourceInfo.locationIndex, targetIndex: destinationInfo.locationIndex});
			return moveQueue;
		}
	},
}

export default ai;
