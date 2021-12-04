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

const DIRECTIONS_MAP = [
	'north',
	'east',
	'south',
	'west',
];

const OPENING_GAME_TURN_THRESHOLD = 20;
const EARLY_GAME_TURN_THRESHOLD = 50;
const MID_GAME_TURN_THRESHOLD = 100;

const TERRAIN_EMPTY = -1;
// const TERRAIN_MTN = -2;
// const TERRAIN_FOG = -3;
// const TERRAIN_FOG_MTN = -4;


let ai = {
	intel: {
		attackQueue: [],
		discoveredArmies: [],
		emergencyOrdersStandUntilTurnNumber: null,
		foreignPolicy: 'EXPLORE',
		log: Array(5), // Set up limited-length history, with turn info, foreign policy, and other important data to track over time.
		myStandingArmies: [], // The map locations we own.
		emptyTerritories: [], // The map locations we can see that are free to conquer.
		undiscovered: true, // Whether we have not been seen, yet.
		USEFUL_ARMY_THRESHOLD: 2,
	},

	/**
	 * Taking all game data into account, plan and execute moves.
	 * @param {*} game
	 */
	move: function (game) {
		game.intel = this.intel;
		this.determineIntel(game);
		this.determineForeignPolicy(game);
		this.determineMoves(game);

		while (game.intel.attackQueue.length) {
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

		if (game.intel.log[0]) {
			// Keep using the same army for as long as possible
			if(game.armies[game.intel.log[0].targetIndex] > 1) {

				armyInfo = this.calculateTileLocationInfo(game.intel.log[0].targetIndex, game);
			} else {
				armyInfo = this.pickStandingArmy(game);
			}
		} else {
			// TODO: Consider using the teensiest armies for the opening set of turns
			armyInfo = this.pickStandingArmy(game);
		}

		// console.dir(armyInfo);

		if (armyInfo) {
			armyIndex = armyInfo.locationIndex;
			armyPower = armyInfo.locationPower;

			targetIndex = this.findAttackableSpace(armyInfo, game);

			if (targetIndex) {
				targetPower = game.armies[targetIndex];

				// Always send the whole army if passing through own territory or attacking empty spaces.
				let shouldSendWholeStrength = true; //(game.terrain[targetIndex] === game.playerIndex || (targetPower !== 0 && armyPower / 2 > targetPower + 1))
				// SEND HALF LOGIC SEEMS A LITTLE BROKEN

				// Add to FIFO attack queue
				game.intel.attackQueue.push({mode: game.intel.foreignPolicy, attackerIndex: armyIndex, targetIndex, sendHalf: (shouldSendWholeStrength) ? false : true});

				// If our attacking army will still have more than 2 power and lands near empty spaces, keep going
				// targetInfo = this.calculateTileLocationInfo(targetIndex, game);
				// let newTargetIndex = this.findAttackableSpace(targetInfo, game);
				// if (armyPower - 1 - targetPower > 1) { // && has empty spaces to attack
				// 	game.intel.attackQueue.push({mode: game.intel.foreignPolicy, attackerIndex: targetIndex, targetIndex: newTargetIndex});
				// }

			} else {
				console.warn(`TURN ${game.turn}: SKIPPED: (no attack target selected)`);
			}

		} else {
			console.warn(`TURN ${game.turn}: SKIPPED: (no available army found)`);
		}
	},

	// Remember and check against previous moves to avoid backtracking.
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
		if (spaceInfo.north && spaceInfo?.north?.locationTerrain === TERRAIN_EMPTY) {
			targetIndex = spaceInfo.north.locationIndex;
		} else if (spaceInfo.east && spaceInfo?.east?.locationTerrain === TERRAIN_EMPTY) {
			targetIndex = spaceInfo.east.locationIndex;
		} else if (spaceInfo.south && spaceInfo?.south?.locationTerrain === TERRAIN_EMPTY) {
			targetIndex = spaceInfo.south.locationIndex;
		} else if (spaceInfo.west && spaceInfo?.west?.locationTerrain === TERRAIN_EMPTY) {
			targetIndex = spaceInfo.west.locationIndex;
		} // No free neighboring empty spaces.

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
			case 'MURDER': // We know a general location
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

	// Recursive
	// You can pass in a location index or a locationInfo, in addition to the list of armies of significance. The initial sourceArmies should be game.intel.myStandingArmies, and tempQueue is an accumulator.
	// Limitations: Will only gather from connected owned spaces.
	gatherArmiesToLocation: function (locationInfo, game, sourceArmies = [], processedSpaces = [], tempQueue = []) {
		if (!locationInfo) {
			return tempQueue;
		}

		if (typeof locationInfo === "number") {
			locationInfo = this.calculateTileLocationInfo(locationInfo, game);
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
				tempQueue.push(this.gatherArmiesToLocation(tileInfo.locationIndex, game, sourceArmies, processedSpaces, tempQueue));

				tempQueue.push({mode: "GATHER", attackerIndex: tileInfo.locationIndex, targetIndex: locationInfo.locationIndex});
			}
		}
		return tempQueue
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
			// Expand territory while undiscovered.
			if (game.intel.undiscovered) {
				foreignPolicy = 'EXPAND';
			} else { // AS LONG AS NO LIFE-THREATENING UPDATES EXIST AND WE HAVE ENOUGH TROOPS
				foreignPolicy = 'MURDER';
			}
		}

		// TODO: Check the scoreboard

		game.intel.foreignPolicy = foreignPolicy;
	},

	/**
	 * Calculate intel based on board state.
	 */
	determineIntel: function (game) {
		game.intel.USEFUL_ARMY_THRESHOLD = Math.floor(game.turn / 100) + 2;
		this.parseMap(game);
		// this.analyzeOpportunities(game);
	},

	pickStandingArmy: function (game) {
		let locationInfo = false;

		for (let idx = 0; idx < game.intel.myStandingArmies.length; idx++) {
			let armyInfo = game.intel.myStandingArmies[idx];
			if (armyInfo.locationPower >= game.intel.USEFUL_ARMY_THRESHOLD) {
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
									// [{total: 182, tiles: 52, i: 0, color: 0, dead: false}, {total: 137, tiles: 23, i: 1, color: 1, dead: false}]
									if (game.scores) { // TODO: check scores to see if it is worth attacking
										// console.log(`\nFOUND A GENERAL TO MURDER!!!\n`);
										// foundAGeneralToAttack = true;
										// let listOfAttacksToMake = this.gatherArmiesToLocation(game.generals[idx], game, game.intel.myStandingArmies);

										// console.log(`\nEXITED GENERAL RECURSION:\n`);
										// console.dir(listOfAttacksToMake);
										return;
									}
								}
							}

							if (!foundAGeneralToAttack) {
								// Pick an enemy next to us, and send all of our troops there
								locationInfo = this.findClosestOwnedLocation(game.intel.discoveredArmies[Math.floor(Math.random() * game.intel.discoveredArmies.length)], game);

								// locationInfo = true; // Just force us to break out of the loop

								// let listOfAttacksToMake = this.gatherArmiesToLocation(jumpOffPoint, game, game.intel.myStandingArmies);

								// console.log(`\nEXITED NON-GENERAL RECURSION!!!\n`);
								// console.dir(listOfAttacksToMake);
							}
						break;
					default:

				}

				if (locationInfo) {
					break; // ARTIFICIALLY RETURN THE STRONGEST ARMY
				}
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
		}

		// Keep track of cities

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
		game.intel.emptyTerritories = [];
		game.intel.discoveredArmies = [];
		game.intel.myStandingArmies = [];

		// Loop through map array once, and sort all data appropriately.
		for (let idx = 0; idx < game.terrain.length; idx++) {
			if (game.terrain[idx] === TERRAIN_EMPTY) {
				game.intel.emptyTerritories.push(idx);
			} else if (game.terrain[idx] === game.playerIndex && game.armies[idx] >= game.intel.USEFUL_ARMY_THRESHOLD) {
				game.intel.myStandingArmies.push({locationIndex: idx, locationPower: game.armies[idx]});
			} else if (game.terrain[idx] > TERRAIN_EMPTY && game.terrain[idx] !== game.playerIndex) {
				game.intel.undiscovered = false;
				game.intel.discoveredArmies.push(idx);
			}
		}

		game.intel.myStandingArmies.sort((a, b) => b.locationPower - a.locationPower); // sort() so that our largest army will be at the front of the array.
	},
}

let dataToTrack = {
  foreignPolicy /* mode */: 'TURTLE|EXPLORE|EXPAND|DEFEND|CONSOLIDATE|GATHER|MURDER|DECOY|ATTACK|GAMBIT',
	undiscovered: true,
	largeAvailableArmies: [
		{
			location: undefined,
			totalArmies: undefined,
		}
	],
	itemsOfInterest: {
		availableCities: [
			{
				color: 'NEUTRAL',
				location: undefined,
				totalArmies: undefined,
			}
		],
		easiestTarget: {},
		biggestThreat: {},
		enemies: [
			{
				color: undefined,
				disposition: 'NEUTRAL|AGGRESSIVE|INVADING|SUICIDAL',
				generalLocation: undefined,
				generalStrength: undefined,
				knowsMyGeneralLocation: false,
				totalFriendlyArmiesKilled: undefined,
				totalArmies: undefined,
				totalLand: undefined,
			}
		],
		pointsOfAttack: [

		]
	}
}

export default ai;
