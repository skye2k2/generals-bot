# generals.io Murderbot

This is a bot for [bot.generals.io](http://bot.generals.io).
<!-- Read the tutorial associated with making a bot at [dev.generals.io/api#tutorial](http://dev.generals.io/api#tutorial). -->

## How to run:

- In the `./src/` directory, create a `config.js` file with the following structure:

```javascript
export default {
  GAME_ID: '{theNameOfTheGameToJoin}',
  BOT_NAME_1: '[Bot]botName',
  BOT_USER_ID_1: '{userIdFromLocalStorageFromIncognitoWindow}',
  BOT_TYPE_1: 'bot',
  BOT_NAME_2: '[Bot]botName',
  BOT_USER_ID_2: '{userIdFromLocalStorageFromIncognitoWindow}',
  BOT_TYPE_2: 'enigma',
  // Set up multiple usernames/IDs so you can open a second tab and go to
  // /play/2, /play/3, etc. and have multiple bots join a game and play each other.
  ...
}
```
> NOTE: Do not commit the file, or anyone could use your bot's identity

 - Open `bot.generals.io/games/{GAME_ID}`, and set desired game settings.
 - Run `npm install` and `npm start`.
 - Open `localhost:3000/play/{botIdNumber}`, and the corresponding bot will join the game.
 - Click the force_start option in the bot UI and the lobby UI to start the game.

<details>

<summary>To-Do List:</summary>

- On turn 50, consolidate all newly-generated troops and either attack, expand, explore, or defend
- Fuzzy recursive logic for army consolidation
  - Identify location of target
  - Only use the top x% armies
  - Identify the path the goes through the most other armies
  - If you have grabbed x% of desired armies, bail out early and execute

</details>

<details>

<summary>Stages of Development Replays:</summary>

- [most recent failure]
- https://bot.generals.io/replays/rgjawPwsF (top of the leaderboard the whole game, with aggressive city and general attack algorithm, missing defense strategy)
- https://bot.generals.io/replays/rgTpm28ot (1st 3-player win)
- https://bot.generals.io/replays/rl-2BbHiY (1st legitimate win, with initial general attack algorithm)
- https://bot.generals.io/replays/BltYNsCKY (1st near-win, with 2 captures, without any specific city or general attack targeting or army gathering implemented)
- https://bot.generals.io/replays/rgRdQY0tY (hyper-aggressive creep reclamation)
- https://bot.generals.io/replays/HgErmdnFt (fast creep queue added)
- https://bot.generals.io/replays/BlkI7vOYY (improved decision-making)
- https://bot.generals.io/replays/SerSfIDYF (1st bot win, fast attack with quick expansion)
- https://bot.generals.io/replays/BgvSl-mtK (2x speed, now explores without backtracking so much and uses most-recent army when possible)
- https://bot.generals.io/replays/SlYu2rhuY (now conquers cities, stupidly)
- https://bot.generals.io/replays/SeHYrHndY (doesn't just shift armies back and forth)
- Emphasize capture of empty spaces (opening 6 turns are optimal)
- Parse game state into actionable data, avoids attacking mountains
- Minimize looping and halt execution on game completion
- Separate socket logic from AI logic

</details>

<details>

<summary>Pieces of data to consider tracking</summary>

<pre>
let dataToTrack = {
  foreignPolicy /* mode */: 'CREEP|TURTLE|EXPLORE|EXPAND|DEFEND|CONSOLIDATE|GATHER|MURDER|DECOY|ATTACK|GAMBIT',
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
</pre>

</details>
