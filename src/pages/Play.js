import React, {useState} from "react";
import { ForceStart, Join, Quit, Team, BotType } from "../../src/client.js";
import { Button, Box, Select } from "grommet";
import config from '../config'

export default function Play({ match }) {
  const botId = match.params.bot

  let bot = {
    id: config[`BOT_USER_ID_${botId}`],
    name: config[`BOT_NAME_${botId}`],
    type: config[`BOT_TYPE_${botId}`],
  }

  setTimeout(() => {
    Join(bot.id, bot.name);
    BotType(bot.type)
  });

  const [teamValue, setTeamValue] = useState()
  const [typeValue, setTypeValue] = useState(bot.type)
  const handleTeamChange = option => {
    setTeamValue(option)
    Team(config.GAME_ID, option)
  }
  const handleTypeChange = option => {
    setTypeValue(option)
    BotType(option)
  }

  return (
    <>
      <p>GAME ID: {config.GAME_ID} <br /> (close this window to leave a lobby or quit)</p>
      <Box pad="small">
        <div>
          <Button
            onClick={() => {
              ForceStart();
            }}
            label="Force Start"
          ></Button>
          <Button
            onClick={() => {
              Join(bot.id, bot.name);
            }}
            label="Join Game"
          ></Button>
          <Select
            placeholder="Team"
            size="small"
            options={['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']}
            value={teamValue}
            onChange={({option}) => handleTeamChange(option)}
          />
          <Select
            placeholder="Bot Type"
            size="small"
            options={['bot', 'enigma']}
            value={typeValue}
            onChange={({option}) => handleTypeChange(option)}
          />
          <Button
            onClick={() => {
              Quit();
            }}
            label="Quit"
          ></Button>
        </div>
      </Box>

      <Box>
        <pre id="log" style={{"backgroundColor": "#eee", "maxHeight": "50vh", "minHeight": "6em", "overflow": "scroll"}}>
          Connected to lobby: {config.GAME_ID}
        </pre>
      </Box>
    </>
  );
}
