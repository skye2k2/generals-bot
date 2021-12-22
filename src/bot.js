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

	/**
	 * Taking all game data into account, plan and execute moves.
	 * @param {*} game - The game state that we determine actions from.
	 */
	move: function (game) {
		game.intel = this.intel;
		this.determineIntel(game);
		this.determineForeignPolicy(game);
		this.determineMoves(game);

		// while (game.intel.attackQueue.length) {
		if (game.intel.attackQueue.length) {
			// AS LONG AS FOREIGN POLICY DOES NOT DRAMATICALLY CHANGE, WORK THROUGH FIFO QUEUE OF MOVES
			let currentMove = game.intel.attackQueue.shift();
			let moveInfo = `TURN ${game.turn}: ${currentMove.mode}: ${currentMove.attackerIndex} --> ${currentMove.targetIndex} ${(currentMove.sendHalf) ? ' (HALF)' : ''}`;
			console.log(moveInfo);
			game.intel.log.unshift({mode: currentMove.mode, attackerIndex: currentMove.attackerIndex, targetIndex: currentMove.targetIndex}); // push to front of log array--returns new length
			game.intel.log.length = 5;
			game.socket.emit("attack", currentMove.attackerIndex, currentMove.targetIndex, currentMove.sendHalf);
		}
	},

	/**
	 * Calculate queue of attack moves to accomplish foreignPolicy goal
	 */
	determineMoves: function (game) {
		let armyInfo;
		let armyIndex;
		let armyPower;
		let targetInfo;
		let targetIndex;
		let targetPower;

		// If we have enough armies to take a city, do it
		// console.log(`TOTAL AVAILABLE ARMIES: ${game.intel.totalAvailableArmyPower}`);
		// Consolidate necessary armies down to general, split, if we have enough, and send to attack

		// Prioritize easy expansion into empty territories and enemy tiles we can conquer. This forms the backbone of the bot's power.
		if (game.turn > OPENING_GAME_TURN_THRESHOLD) {// && (game.intel.foreignPolicy === "EXPLORE" || game.intel.foreignPolicy === "EXPAND")) { // TODO: Modify this once we take more factors into account for panicking on discovery.
			if (!game.intel.attackQueue.length) {
				this.generateAllSimpleAttacks(game.intel.visibleOpponentTerritories.concat(game.intel.emptyTerritories), game.intel.myTopArmies, game);
			}

			if (game.intel.attackQueue.length) {
				return;
			}
		} else {
			// If something important happens, empty the attack queue, so that we can respond appropriately, in time.
			game.intel.attackQueue.length = 0;
		}

		// return this.BETA_flood("east", "south", game.intel.myStandingArmies, game);

		if (game.intel.log[0]) {
			// Keep using the same army for as long as possible
			if(game.armies[game.intel.log[0].targetIndex] > 1) {
				if (game.turn < OPENING_GAME_TURN_THRESHOLD + EARLY_GAME_TURN_THRESHOLD || game.intel.log[0].targetIndex !== game.myGeneralLocationIndex) {
					armyInfo = this.calculateTileLocationInfo(game.intel.log[0].targetIndex, game);
				}
			} else {
				armyInfo = this.pickArmy(game);
			}
		} else {
			armyInfo = this.pickArmy(game);
		}

		if (armyInfo) {
			armyIndex = armyInfo.locationIndex;
			armyPower = armyInfo.locationPower;

			targetIndex = this.findAttackableSpace(armyInfo, game);

			if (targetIndex) {
				targetPower = game.armies[targetIndex];

				// Always send the whole army if passing through own territory or attacking empty spaces, unless we are trying to protect our general.
				let shouldSendWholeStrength = true; //(game.terrain[targetIndex] === game.playerIndex || (targetPower !== 0 && armyPower / 2 > targetPower + 1))
				// SEND HALF LOGIC SEEMS A LITTLE BROKEN

				// Add to FIFO attack queue
				game.intel.attackQueue.push({mode: game.intel.foreignPolicy, attackerIndex: armyIndex, targetIndex, sendHalf: (shouldSendWholeStrength) ? false : true});

			} else {
				console.warn(`TURN ${game.turn}: SKIPPED: (no attack target selected)`);
			}

		} else {
			this.generateAllSimpleAttacks(game.intel.visibleOpponentTerritories.concat(game.intel.emptyTerritories), game.intel.myStandingArmies, game);

			if (game.intel.attackQueue.length === 0) {
				console.warn(`TURN ${game.turn}: SKIPPED: (no available army found)`);
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
	generateAllSimpleAttacks: function (spacesToAttack, availableArmies, game) {
		if (spacesToAttack.length === 0) {
			return;
		}

		// Limit recursion: Remove current target from spacesToAttack
		let targetIndex = spacesToAttack.shift();
		let attackerIndex = -1;
		let indexInArray;

		// See if any free armies of sufficient strength neighbor the target space
		for (let idx = 0; idx < availableArmies.length; idx++) {
			let spaceInfo = this.calculateTileLocationInfo(availableArmies[idx].locationIndex, game);

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
			game.intel.attackQueue.push({mode: "CREEP", attackerIndex: attackerIndex, targetIndex: targetIndex});
		}

		this.generateAllSimpleAttacks(spacesToAttack, availableArmies, game);
	},

	// Remember and check against previous moves to avoid backtracking.
	// BUG: This is a problem when the last move is along a restricted path or into a corner, where it will be abandoned until 5 other moves are made...
	spaceIsInRecentHistory: function (targetIndex, game) {
		for (let idx = 0; idx < game.intel.log.length; idx++) {
			const logEntry = game.intel.log[idx];
			if (logEntry && logEntry.attackerIndex === targetIndex) {
				return true;
			}
		}
		return false;
	},

	findAttackableSpace: function (spaceInfo, game) {
		if (typeof spaceInfo === "number") {
			spaceInfo = this.calculateTileLocationInfo(spaceInfo, game);
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
		// game.intel.unexploredTerritories

		switch (game.intel.foreignPolicy) {
			case 'EXPLORE':
			case 'EXPAND':
				// Check surrounding tiles for easy conquests (TODO: FIX RECURSION)
				// if (spaceInfo.north && this.findAttackableSpace(spaceInfo.north.locationIndex, game)) {
				// 	targetIndex = spaceInfo.north.locationIndex;
				// } else if (spaceInfo.east && this.findAttackableSpace(spaceInfo.east.locationIndex, game)) {
				// 	targetIndex = spaceInfo.east.locationIndex;
				// } else if (spaceInfo.south && this.findAttackableSpace(spaceInfo.south.locationIndex, game)) {
				// 	targetIndex = spaceInfo.south.locationIndex;
				// } else if (spaceInfo.west && this.findAttackableSpace(spaceInfo.west.locationIndex, game)) {
				// 	targetIndex = spaceInfo.west.locationIndex;
				// }
				break;
			case 'ATTACK':
			case 'MURDER': // We know a general location or have a neighboring enemy.
				// Prioritize opponent-owned attackable neighboring spaces.
				if (spaceInfo.north && spaceInfo.north.locationTerrain !== game.playerIndex && spaceInfo.locationPower > spaceInfo.north.locationPower && !this.spaceIsInRecentHistory(spaceInfo.north.locationIndex, game)) {
					targetIndex = spaceInfo.north.locationIndex;
				} else if (spaceInfo.east && spaceInfo.east.locationTerrain !== game.playerIndex && spaceInfo.locationPower > spaceInfo.east.locationPower && !this.spaceIsInRecentHistory(spaceInfo.east.locationIndex, game)) {
					targetIndex = spaceInfo.east.locationIndex;
				} else if (spaceInfo.south && spaceInfo.south.locationTerrain !== game.playerIndex && spaceInfo.locationPower > spaceInfo.south.locationPower && !this.spaceIsInRecentHistory(spaceInfo.south.locationIndex, game)) {
					targetIndex = spaceInfo.south.locationIndex;
				} else if (spaceInfo.west && spaceInfo.west.locationTerrain !== game.playerIndex && spaceInfo.locationPower > spaceInfo.west.locationPower && !this.spaceIsInRecentHistory(spaceInfo.west.locationIndex, game)) {
					targetIndex = spaceInfo.west.locationIndex;
				}
				break;
			default:
				console.warn(`UNRECOGNIZED foreignPolicy: ${game.intel.foreignPolicy}`);
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
			// if (spaceInfo[chosenDirection].locationPower !== 1) { // game.terrain[spaceInfo[chosenDirection].locationIndex] !== game.playerIndex &&
			if (loopCount < 4) {
				if (spaceInfo[chosenDirection] && !this.spaceIsInRecentHistory(spaceInfo[chosenDirection].locationIndex, game)) {
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
	 determineForeignPolicy: function (game) {
		let foreignPolicy = 'EXPLORE';

		// Force early-game exploration.
		if (game.turn < EARLY_GAME_TURN_THRESHOLD) {
			foreignPolicy = 'EXPLORE';
		} else {
			// Expand territory (cities) while undiscovered.
			if (game.intel.undiscovered) {
				foreignPolicy = 'EXPAND';
			} else { // AS LONG AS NO LIFE-THREATENING UPDATES EXIST AND WE HAVE ENOUGH TROOPS
				// if (game.intel.myScore.total - game.intel.myScore.tiles > EVERYONE_ELSE) {
				// 	foreignPolicy = 'MURDER';
				// }
			}
		}

		game.intel.foreignPolicy = foreignPolicy;
	},

	/**
	 * Calculate intel based on board state.
	 */
	determineIntel: function (game) {
		game.intel.USEFUL_ARMY_THRESHOLD = Math.floor(game.turn / MID_GAME_TURN_THRESHOLD) + 2;
		this.parseMap(game);
		// this.analyzeOpportunities(game);
	},

	// TODO: Pass in which army list to use
	pickArmy: function (game) {
		let locationInfo = false;

		for (let idx = 0; idx < game.intel.myTopArmies.length; idx++) {
			let armyInfo = game.intel.myTopArmies[idx];

			switch (game.intel.foreignPolicy) {
				case 'ATTACK':
				case 'EXPAND':
				case 'EXPLORE':
					// Don't be afraid of using armies from general for opening conquests.
					if (game.turn < EARLY_GAME_TURN_THRESHOLD && !game.intel.discovered) {
						locationInfo = this.calculateTileLocationInfo(armyInfo.locationIndex, game);
					}  else if (armyInfo.locationIndex !== game.myGeneralLocationIndex) {
						locationInfo = this.calculateTileLocationInfo(armyInfo.locationIndex, game);
					}
					break;
					case 'MURDER':
						// If we know our opponent's general's location, attack
						let foundAGeneralToAttack = false;
						for (let idx = 0; idx < game.generals.length; idx++) {
							if (game.generals[idx] !== -1) {
								if (game.scores) { // TODO: check scores to see if it is worth attacking
									// console.log(`\nFOUND A GENERAL TO MURDER!!!\n`);
									// foundAGeneralToAttack = true;
									// let listOfAttacksToMake = this.BETA_gatherArmiesToLocation(game.generals[idx], game, game.intel.myTopArmies);

									// console.log(`\nEXITED GENERAL RECURSION:\n`);
									// console.dir(listOfAttacksToMake);
									return;
								}
							}
						}

						if (!foundAGeneralToAttack) {
							// Pick an enemy next to us, and send all of our troops there
							locationInfo = this.findClosestOwnedLocation(game.intel.visibleOpponentTerritories[Math.floor(Math.random() * game.intel.visibleOpponentTerritories.length)], game);

							// locationInfo = true; // Just force us to break out of the loop

							// let listOfAttacksToMake = this.BETA_gatherArmiesToLocation(jumpOffPoint, game, game.intel.myTopArmies);

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

	findClosestOwnedLocation: function (indexToCheck, game) {
		for (let idx = 0; idx < game.terrain.length; idx++) {
			if (game.terrain[idx] === game.playerIndex && (
				Math.abs(indexToCheck - idx) < 1 ||
				idx === indexToCheck - game.mapWidth ||
				idx === indexToCheck + game.mapWidth ||
				Math.abs(indexToCheck - game.mapWidth - idx) < 1 ||
				Math.abs(indexToCheck + game.mapWidth - idx) < 1
			)) {
				// console.log(`CLOSEST OWNED TILE to ${indexToCheck}: ${idx}`);
				return this.calculateTileLocationInfo(idx, game);
			}
		}
		// console.log(`DIDN'T FIND CLOSEST OWNED TILE, USING GENERAL: ${game.myGeneralLocationIndex}`)
		// return this.calculateTileLocationInfo(game.myGeneralLocationIndex, game); // We didn't find an easy jump-off point to attack from, so send the armies to the general space.
	},

	calculateTileLocationInfo: function (indexToCheck, game) {
		if (!indexToCheck) {
			return false;
		} else if (indexToCheck.locationIndex) {
			indexToCheck = indexToCheck.locationIndex
		}

		// Determine zero-indexed row and column for extended calculations
		const row = Math.floor(indexToCheck / game.mapWidth);
		const col = indexToCheck % game.mapWidth;

		// QUADRANT // Used to determine preferred exploration direction (towards nearest wall)

		const north = (row > 0) ? {
			locationIndex: indexToCheck - game.mapWidth,
			locationPower: game.armies[indexToCheck - game.mapWidth],
			locationTerrain: game.terrain[indexToCheck],
		} : null;
		const east = (col < game.mapWidth - 1) ? {
			locationIndex: indexToCheck + 1,
			locationPower: game.armies[indexToCheck + 1],
			locationTerrain: game.terrain[indexToCheck],
		} : null;
		const south = (row < game.mapHeight - 1) ? {
			locationIndex: indexToCheck + game.mapWidth,
			locationPower: game.armies[indexToCheck + game.mapWidth],
			locationTerrain: game.terrain[indexToCheck],
		} : null;
		const west = (col > 0) ? {
			locationIndex: indexToCheck - 1,
			locationPower: game.armies[indexToCheck - 1],
			locationTerrain: game.terrain[indexToCheck],
		} : null;

		return {
			locationIndex: indexToCheck,
			locationPower: game.armies[indexToCheck],
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
	 parseMap: function (game) {
		if (game.turn === 1) {
			game.intel.unexploredTerritories = new Set([...Array(game.mapSize).keys()]);
		}

		game.intel.emptyTerritories = [];
		game.intel.visibleOpponentTerritories = [];
		game.intel.myStandingArmies = [];
		game.intel.myTopArmies = [];
		game.intel.totalAvailableArmyPower = 0;

		// Loop through map array once, and sort all data appropriately.
		for (let idx = 0; idx < game.terrain.length; idx++) {
			// TODO: As soon as we can prioritize attacking them, filter out cities, since they are listed as empty terrain
			if (game.terrain[idx] === TERRAIN_EMPTY) {
				game.intel.emptyTerritories.push(idx);
			} else if (game.terrain[idx] === game.playerIndex) {
				game.intel.unexploredTerritories.delete(idx);
				if (game.armies[idx] > 1) {
					game.intel.myStandingArmies.push({locationIndex: idx, locationPower: game.armies[idx] - 1});
					if (game.armies[idx] >= game.intel.USEFUL_ARMY_THRESHOLD) {
						// Don't include general in available armies list past a certain point
						if (game.turn < EARLY_GAME_TURN_THRESHOLD || idx !== game.myGeneralLocationIndex) {
							game.intel.myTopArmies.push({locationIndex: idx, locationPower: game.armies[idx] - 1}); // Subtract one from the power here, because any attack always leaves one army behind
						}
					}
					game.intel.totalAvailableArmyPower += game.armies[idx];
				}
			} else if (game.terrain[idx] > TERRAIN_EMPTY && game.terrain[idx] !== game.playerIndex) {
				game.intel.undiscovered = false;
				game.intel.visibleOpponentTerritories.push(idx);
			}
		}

		// sort() so that our largest army will be at the front of the array.
		game.intel.myStandingArmies.sort((a, b) => b.locationPower - a.locationPower);
		game.intel.myTopArmies.sort((a, b) => b.locationPower - a.locationPower);
	},

	/* IN-PROGRESS CORNER (UNUSED BETA FUNCTIONS) */

	// Recursive
	// You can pass in a locationIndex or a locationInfo, in addition to the list of armies of significance. The initial sourceArmies should be game.intel.myTopArmies, and tempQueue is an accumulator.
	// Limitations: Will only gather from connected owned spaces.
	BETA_gatherArmiesToLocation: function (locationInfo, game, sourceArmies = [], processedSpaces = [], tempQueue = []) {
		locationInfo = this.calculateTileLocationInfo(locationInfo, game);

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

			if (tileInfo && tileInfo.locationTerrain === game.playerIndex) {
				tempQueue.push(this.BETA_gatherArmiesToLocation(tileInfo.locationIndex, game, sourceArmies, processedSpaces, tempQueue));

				tempQueue.push({mode: "GATHER", attackerIndex: tileInfo.locationIndex, targetIndex: locationInfo.locationIndex});
			}
		}
		return tempQueue
	},

	/**
	 * Queue up moves to send all available armies as far in both directions as their territory extends.
	 * The initial availableArmies should be game.intel.myStandingArmies, passed in reversed if flooding west or north.
	 */
	BETA_flood: function (primaryDirectionToFlood, secondaryDirectionToFlood, availableArmies, game) {
		console.warn(`BEGINNING FLOOD!!! ${game.turn}`);
		let collectedArmies = [];
		let reversedOrder = false;

		if (secondaryDirectionToFlood === 'north' || secondaryDirectionToFlood === 'west') {
			reversedOrder = true;
			availableArmies = availableArmies.reverse();
		}

		availableArmies.forEach((army) => {
			// CLEAN UP LOGIC, SO WE DON'T ATTEMPT TO MOVE SIZE 1 ARMIES
			// if (game.armies[army.locationIndex] > 1) {

			// }

			const armyInfo = this.calculateTileLocationInfo(army, game);

			// If we own the space in the corresponding direction queue up a move in that direction
			if (armyInfo[secondaryDirectionToFlood] && armyInfo.locationIndex !== game.myGeneralLocationIndex) {
				const targetIndex = armyInfo[secondaryDirectionToFlood].locationIndex;

				if (game.terrain[targetIndex] === game.playerIndex) {
					game.intel.attackQueue.push({mode: `FLOOD (${secondaryDirectionToFlood})`, attackerIndex: armyInfo.locationIndex, targetIndex: targetIndex});

					collectedArmies.push(targetIndex);
				}
			}
		});

		if (primaryDirectionToFlood === 'north' || primaryDirectionToFlood === 'west') {
			collectedArmies = collectedArmies.reverse();
		}

		collectedArmies.forEach((army) => {
			const armyInfo = this.calculateTileLocationInfo(army, game);

			// If we own the space in the corresponding direction queue up a move in that direction
			if (armyInfo[primaryDirectionToFlood] && armyInfo.locationIndex !== game.myGeneralLocationIndex) {
				const targetIndex = armyInfo[primaryDirectionToFlood].locationIndex;

				if (game.terrain[targetIndex] === game.playerIndex) {
					game.intel.attackQueue.push({mode: `FLOOD (${primaryDirectionToFlood})`, attackerIndex: armyInfo.locationIndex, targetIndex: targetIndex});
				}
			}
		});

	},

	BETA_determinePathToTarget: function (sourceInfo, destinationInfo, game, moveQueue = []) {
		sourceInfo = this.calculateTileLocationInfo(sourceInfo, game);
		destinationInfo = this.calculateTileLocationInfo(destinationInfo, game);

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
