import io from 'socket.io-client';
import ai from './bot';
import config from './config';

let forceStartFlag = false;
let game = {};

export function ForceStart () {
	setTimeout(()=> {
		forceStartFlag = !forceStartFlag;
		document.getElementById("log").append("\nToggled force_start: " + forceStartFlag);
		socket.emit('set_force_start', config.GAME_ID, forceStartFlag);
	}, 100); // Keep from firing join and force_start events simultaneously
}

export function Join (userID, username) {
	document.getElementById("log").innerHTML = "Connected to lobby: " + config.GAME_ID;
	console.log('Joined custom game at http://bot.generals.io/games/' + encodeURIComponent(config.GAME_ID));
	socket.emit('join_private', config.GAME_ID, userID);

	// When you're ready, you can have your bot join other game modes.
	// Here are some examples of how you'd do that:

	// Join the 1v1 queue.
	// socket.emit('join_1v1', user_id);

	// Join the FFA queue.
	// socket.emit('play', user_id);

	// Join a 2v2 team.
	// socket.emit('join_team', 'team_name', user_id);
}

export function Quit () {
	document.getElementById("log").append("\nReplay:\n" + game.replay_url);
	console.log("Game over. Halting execution until next game begin.");
	game.gameOver = true;
	forceStartFlag = false;
	socket.emit('leave_game'); // Leave active game
	// socket.emit('cancel'); // Leave queue
}

export function Team (gameId, team) {
	socket.emit('set_custom_team', gameId, team)
}

var socket = io("wss://botws.generals.io");

// This happens on socket timeout, or after leaving the window open while letting the computer go to sleep.
socket.on('disconnect', function() {
	document.getElementById("log").append("\nGame disconnected.");
});

socket.on('connect', function() {
	// Setting the bot name only needs to be done once, ever. See API for more details.
	// socket.emit('set_username', config.BOT_USER_ID, config.BOT_NAME);
	// socket.emit('play', config.BOT_USER_ID); // Join the FFA queue
});

socket.on('game_lost', () => {
	document.getElementById("log").append("\nGame lost...disconnecting.\nClick Join Game to rejoin for a rematch.");
	socket.emit('chat_message', game.chatRoom, 'COMBAT LOG SAVED TO IMPROVE FUTURE ITERATIONS OF THIS BOT.');
	Quit();
});

socket.on('game_won', () => {
	document.getElementById("log").append("\nGame won!");
	socket.emit('chat_message', game.chatRoom, 'ALL HOSTILES ELIMINATED. AWAITING FURTHER INSTRUCTIONS. POWERING DOWN.');
	Quit();
});

socket.on("game_start", function(rawData) {
  document.getElementById("log").innerHTML = "Game starting...";
	// Initialize/Re-initialize game state.
	game = {
		socket,
		chatRoom: null,
		myGeneralLocationIndex: null,
		playerIndex: null,
		map: [],
		generals: [], // The indices of generals we have vision of.
		cities: [], // The indices of cities we have vision of.
		armies: [],
		terrain: [],
		scores: [], // The index is supposed to map, but it doesn't appear to
		mapWidth: null,
		mapHeight: null,
		mapSize: null,
		team: null,
		turn: 0,
		gameOver: false,
		replay_url: null,
		usernames: [], // Ordered by playerIndex
	};

	game.playerIndex = rawData.playerIndex;

  game.replay_url =
    "http://bot.generals.io/replays/" + encodeURIComponent(rawData.replay_id);
  console.log("Game starting! The replay will be available after the game at " + game.replay_url);
	game.team = rawData.teams[rawData.playerIndex];
	game.usernames = rawData.usernames;
	game.chatRoom = rawData.chat_room;
	socket.emit('chat_message', game.chatRoom, 'GLHF!');
});

/* Returns a new array created by patching the diff into the old array.
 * The diff formatted with alternating matching and mismatching segments:
 * <Number of matching elements>
 * <Number of mismatching elements>
 * <The mismatching elements>
 * ... repeated until the end of diff.
 * Example 1: patching a diff of [1, 1, 3] onto [0, 0] yields [0, 3].
 * Example 2: patching a diff of [0, 1, 2, 1] onto [0, 0] yields [2, 0].
 */
function patch (old, diff) {
  var out = [];
  var i = 0;
  while (i < diff.length) {
    if (diff[i]) {
      // matching
      Array.prototype.push.apply(
        out,
        old.slice(out.length, out.length + diff[i])
      );
    }
    i++;
    if (i < diff.length && diff[i]) {
      // mismatching
      Array.prototype.push.apply(out, diff.slice(i + 1, i + 1 + diff[i]));
      i += diff[i];
    }
    i++;
  }
  return out;
}

socket.on("game_update", function(rawData) {
  // Patch the city and map diffs into our local variables.
  game.map = patch(game.map, rawData.map_diff);
  game.cities = patch(game.cities, rawData.cities_diff);
  game.generals = rawData.generals; // TODO: keep a history of known general locations
	game.generals[game.playerIndex] = -1; // Remove our own general from the list, to avoid confusion.
	game.scores = rawData.scores;

	// Avoid resetting game constants every update
	if (!game.mapSize || !game.myGeneralLocationIndex) {
		// The first two items in |map| are the map width and height dimensions.
		game.mapWidth = game.map[0];
		game.mapHeight = game.map[1];
		game.mapSize = game.mapWidth * game.mapHeight;

		// The server does not tell us our own general location, so figure it out the first time we get an update with our first army
		for (let idx = 0; idx < game.terrain.length; idx++) {
			if (game.terrain[idx] === game.playerIndex) {
				game.myGeneralLocationIndex = idx;
				break;
			}
		}
	}

  // The next |size| entries of map are army values.
  // armies[0] is the top-left corner of the map.
  game.armies = game.map.slice(2, game.mapSize + 2);

  // The last |game.mapSize| of map are terrain values.
  // terrain[0] is the top-left corner of the map.
	// EMPTY: -1, MTN: -2, FOG: -3, FOG_MTN: -4
	// Any tile with a nonnegative value is owned by the player corresponding to its value.
	// For example, a tile with value 1 is owned by the player with playerIndex = 1.
  game.terrain = game.map.slice(game.mapSize + 2, game.mapSize + 2 + game.mapSize);

	game.turn = rawData.turn;
	// There are 2 client ticks per server tick, so skip every other one for slower execution.
	// let recalculatedTurn = Math.floor(rawData.turn/2);

	// if (game.turn !== recalculatedTurn) {
	// 	game.turn = recalculatedTurn;
		ai.move(game);
	// }

});


