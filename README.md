# generals.io Murderbot

This is a bot for [bot.generals.io](http://bot.generals.io). 
<!-- Read the tutorial associated with making a bot at [dev.generals.io/api#tutorial](http://dev.generals.io/api#tutorial). -->

## How to run:

- In the `./src/` directory, create a `config.js` file with the following structure:

```javascript
export default {
  GAME_ID: '{theNameOfTheGameToJoin}',
  BOT_USERNAME_1: '[Bot]botName',
  BOT_USER_ID_1: '{userIdFromLocalStorageFromIncognitoWindow}',
  BOT_USERNAME_1: '[Bot]botName',
  BOT_USER_ID_2: '{userIdFromLocalStorageFromIncognitoWindow}',
  // Set up multiple usernames/IDs so you can open a second tab and go to 
  // /play/2, /play/3, etc. and have multiple bots join a game and play each other.
  ...
}
```
> NOTE: Do not commit the file, or anyone could use your bot's identity

 - Open `localhost:3000/play/{botIdNumber}`, and the corresponding bot will join the game
 - Game will be live at `bot.generals.io/games/{GAME_ID}`

<details>

<summary>To-Do List:</summary>

- Fuzzy logic for army consolidation
- Maintain a short histoy, to avoid repeating/undoing actions, and to allow complex actions
- On turn 50, consolidate all newly-generated troops and either attack, expand, explore, or defend

</details>


<details>

<summary>Stages of Development Replays:</summary>

- [most recent failure]
- https://bot.generals.io/replays/SlYu2rhuY (now conquers cities)
- https://bot.generals.io/replays/SeHYrHndY (doesn't just shift armies back and forth)
- Emphasize capture of empty spaces (opening 6 turns are optimal)
- Parse game state into actionable data, avoids attacking mountains
- Minimize looping and halt execution on game completion
- Separate socket logic from AI logic

</details>
