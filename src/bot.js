/**
 * Triggers:
 * - If the game turn is still under 50, you can uncover your general
 * - If there are large armies near my general (or if my general armies ever decrease without the cause being my active cursor)
 * - If one of my neighbors gets conquered
 * - If my general is discovered (someone explores or penetrates to a space next to my general--if there is *ever* a color not part of my team next to my general)
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

const OPENING_GAME_TURN_THRESHOLD = 10;
const EARLY_GAME_TURN_THRESHOLD = 50;
const MID_GAME_TURN_THRESHOLD = 100;


const TERRAIN_EMPTY = -1;
// const TERRAIN_MTN = -2;
// const TERRAIN_FOG = -3;
// const TERRAIN_FOG_MTN = -4;


let ai = {
	intel: {
		attackQueue: [],
		emergencyOrdersStandUntilTurnNumber: null,
		log: Array(5), // Set up limited-length history, with turn info, foreign policy, and other important data to track over time.
		myStandingArmies: [], // The map locations we own.
		emptyTerritories: [], // The map locations we can see that are free to conquer.
		undiscovered: true // Whether we have not been seen, yet.
	},

	/**
	 * Taking all game data into account, plan and execute moves.
	 * @param {*} game
	 */
	move: function (game) {
		game.intel = this.intel;
		this.determineIntel(game);
		this.determineForeignPolicy(game);
		this.determineAttackMoves(game);

		while (game.intel.attackQueue.length) {
			// AS LONG AS FOREIGN POLICY DOES NOT DRAMATICALLY CHANGE, WORK THROUGH FIFO QUEUE OF MOVES
			let currentMove = game.intel.attackQueue.shift();
			console.log(`TURN ${game.turn}: ${currentMove.mode}: ${currentMove.attackerIndex} --> ${currentMove.targetIndex} ${(currentMove.sendHalf) ? ' (HALF)' : ''}`);
			game.socket.emit("attack", currentMove.attackerIndex, currentMove.targetIndex, currentMove.sendHalf);
		}
	},

	/**
	 * Calculate queue of attack moves to accomplish foreignPolicy goal
	 */
	 determineAttackMoves: function (game) {
		let armyInfo;
		let armyIndex;
		let armyPower;
		let targetInfo;
		let targetIndex;
		let targetPower;

		armyInfo = this.pickStandingArmy(game);

		// console.dir(armyInfo);

		if (armyInfo) {
			armyIndex = armyInfo.locationIndex;
			armyPower = armyInfo.locationPower;

			// Prioritize capture of free neighboring empty spaces
			if (armyInfo?.north?.locationTerrain === TERRAIN_EMPTY) {
				targetIndex = armyInfo.north.locationIndex;
			} else if (armyInfo?.east?.locationTerrain === TERRAIN_EMPTY) {
				targetIndex = armyInfo.east.locationIndex;
			} else if (armyInfo?.south?.locationTerrain === TERRAIN_EMPTY) {
				targetIndex = armyInfo.south.locationIndex;
			} else if (armyInfo?.west?.locationTerrain === TERRAIN_EMPTY) {
				targetIndex = armyInfo.west.locationIndex;
			} else {
				// No free neighboring empty spaces--pick a direction and go exploring.

				// Randomly choose a direction, since the bot will always travel the same path, otherwise.
				while(!targetIndex) {
					let chosenDirection = DIRECTIONS_MAP[Math.floor(Math.random() * 4)]; // Randomly pick a number between 0 and 3
				// console.log("PICKING RANDOM DIRECTION:", chosenDirection);
					targetIndex = armyInfo[chosenDirection]?.locationIndex;
				};
			}

			targetIndex = this.chooseNeighboringAttackableSpace(armyInfo, game);

			if (targetIndex) {
				targetPower = game.armies[targetIndex];

				// Always send the whole army if passing through own territory or attacking empty spaces.
				let shouldSendWholeStrength = (game.terrain[targetIndex] === game.playerIndex || (targetPower !== 0 && armyPower / 2 > targetPower + 1))

				// Add to FIFO attack queue
				game.intel.attackQueue.push({mode: game.intel.foreignPolicy, attackerIndex: armyIndex, targetIndex, sendHalf: (shouldSendWholeStrength) ? false : true}); // SEND HALF LOGIC SEEMS A LITTLE BROKEN

				// If our attacking army will still have more than 2 power and lands near empty spaces, keep going
				targetInfo = this.calculateTileLocationInfo(targetIndex, game);
				let newTargetIndex = this.chooseNeighboringAttackableSpace(targetInfo, game);
				if (armyPower - 1 - targetPower > 1) { // && has empty spaces to attack
					game.intel.attackQueue.push({mode: game.intel.foreignPolicy, attackerIndex: targetIndex, targetIndex: newTargetIndex});
				}

			} else {
				console.warn(`TURN ${game.turn}: SKIPPED: (no attack target selected)`);
			}

		} else {
			console.warn(`TURN ${game.turn}: SKIPPED: (no available army found)`);
		}

		// switch (game.intel.foreignPolicy) {
		// 	case 'EXPLORE':
		// }
	},

	chooseNeighboringAttackableSpace: function (spaceInfo, game) {
		let targetIndex;
		// Prioritize capture of free neighboring empty spaces.
		if (game.intel.foreignPolicy === 'EXPLORE')
		switch (game.intel.foreignPolicy) {
			case 'EXPLORE':
			case 'EXPAND':
				if (spaceInfo?.north?.locationTerrain === TERRAIN_EMPTY) {
					targetIndex = spaceInfo.north.locationIndex;
				} else if (spaceInfo?.east?.locationTerrain === TERRAIN_EMPTY) {
					targetIndex = spaceInfo.east.locationIndex;
				} else if (spaceInfo?.south?.locationTerrain === TERRAIN_EMPTY) {
					targetIndex = spaceInfo.south.locationIndex;
				} else if (spaceInfo?.west?.locationTerrain === TERRAIN_EMPTY) {
					targetIndex = spaceInfo.west.locationIndex;
				} // No free neighboring empty spaces.
				break;
				case 'ATTACK':
					if (spaceInfo?.north?.locationTerrain === TERRAIN_EMPTY) {
						targetIndex = spaceInfo.north.locationIndex;
					} else if (spaceInfo?.east?.locationTerrain === TERRAIN_EMPTY) {
						targetIndex = spaceInfo.east.locationIndex;
					} else if (spaceInfo?.south?.locationTerrain === TERRAIN_EMPTY) {
						targetIndex = spaceInfo.south.locationIndex;
					} else if (spaceInfo?.west?.locationTerrain === TERRAIN_EMPTY) {
						targetIndex = spaceInfo.west.locationIndex;
					} // No free neighboring empty spaces.
					else if (spaceInfo?.north?.locationTerrain !== game.playerIndex && spaceInfo.locationPower > spaceInfo.north.locationPower) {
						targetIndex = spaceInfo.north.locationIndex;
					} else if (spaceInfo?.east?.locationTerrain !== game.playerIndex && spaceInfo.locationPower > spaceInfo.east.locationPower) {
						targetIndex = spaceInfo.east.locationIndex;
					} else if (spaceInfo?.south?.locationTerrain !== game.playerIndex && spaceInfo.locationPower > spaceInfo.south.locationPower) {
						targetIndex = spaceInfo.south.locationIndex;
					} else if (spaceInfo?.west?.locationTerrain !== game.playerIndex && spaceInfo.locationPower > spaceInfo.west.locationPower) {
						targetIndex = spaceInfo.west.locationIndex;
					}	// No opponent-owned attackable neighboring spaces.
				break;
			default:
				break;
		}

		// Randomly choose a direction, since the bot will always travel the same path, otherwise.
		while(!targetIndex) {
			let chosenDirection = DIRECTIONS_MAP[Math.floor(Math.random() * 4)]; // Randomly pick a number between 0 and 3
			// console.log("PICKING RANDOM DIRECTION:", chosenDirection);
			// Prioritize capture of non-self-owned spaces.
			// if (spaceInfo[chosenDirection].locationPower !== 1) { // game.terrain[spaceInfo[chosenDirection].locationIndex] !== game.playerIndex &&
				targetIndex = spaceInfo[chosenDirection]?.locationIndex;
			// }
		};

		return targetIndex;
	},

	/**
	 * Calculate posture based on game state
	 */
	 determineForeignPolicy: function (game) {
		let foreignPolicy = 'EXPLORE';

		// Force early-game expansion.
		if (game.intel.undiscovered) {
			foreignPolicy = 'EXPAND';
		// Force early-game exploration.
		} else if (game.turn < EARLY_GAME_TURN_THRESHOLD) {
			foreignPolicy = 'EXPLORE';
		} else { // AS LONG AS NO LIFE-THREATENING UPDATES EXIST
			foreignPolicy = 'ATTACK';
		}

		// TODO: Check the scoreboard

		game.intel.foreignPolicy = foreignPolicy;
	},

	/**
	 * Calculate intel based on board state.
	 */
	determineIntel: function (game) {
		this.parseMap(game);
		// this.analyzeOpponents();
	},

	pickStandingArmy: function (game) {
		let locationInfo = false;

		// if (game.turn < EARLY_GAME_TURN_THRESHOLD) { // Don't be afraid of using armies from general for opening conquests.
		// 	return this.calculateTileLocationInfo(game.myGeneralLocationIndex, game);
		// }

		for (let idx = 0; idx < game.intel.myStandingArmies.length; idx++) {
			// console.dir(game.intel.myStandingArmies);
			let armyInfo = game.intel.myStandingArmies[idx];
			if (armyInfo.locationPower > 1) {
				locationInfo = this.calculateTileLocationInfo(armyInfo.locationIndex, game);

				break; // ARTIFICIALLY RETURN THE STRONGEST ARMY
			}
		}

		return locationInfo;
	},

	calculateTileLocationInfo: function (indexToCheck, game) {
		if (!indexToCheck) {
			return false;
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
			MAP_HEIGHT: game.mapHeight,
			MAP_WIDTH: game.mapWidth,
		}
	},

	/**
	 * Extract map state into actionable data.
	 * Locations with a -1 map to emptyTerritories
	 * Locations matching playerIndex and a count > 1 map to standingArmies
	 */
	 parseMap: function (game) {
		game.intel.myStandingArmies = [];
		game.intel.emptyTerritories = [];

		// Loop through map array once, and sort data appropriately.
		for (let idx = 0; idx < game.terrain.length; idx++) {
			if (game.terrain[idx] === TERRAIN_EMPTY) {
				game.intel.emptyTerritories.push(idx);
			} else if (game.terrain[idx] === game.playerIndex && game.armies[idx] > 1) {
				game.intel.myStandingArmies.push({locationIndex: idx, locationPower: game.armies[idx]});
			} else if (game.terrain[idx] !== game.playerIndex) {
				game.intel.undiscovered = false;
			}
		}

		// TODO: Consider using the smallest armies for the opening set of turns
		game.intel.myStandingArmies.sort((a, b) => b.locationPower - a.locationPower); // sort() so that our largest army will be at the front of the array.
	},
}

let dataToTrack = {
  foreignPolicy /* mode */: 'TURTLE|EXPLORE|EXPAND|DEFEND|CONSOLIDATE|DECOY|ATTACK|GAMBIT',
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
