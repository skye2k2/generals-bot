import React, {useState} from "react";
import { ForceStart, Join, Quit, Team, ChooseBotVariant } from "../../src/client.js";
import { Button, Box, Select } from "grommet";
import config from '../config'

export default function Play({ match }) {
  const botId = match.params.bot

  let bot = {
    id: config[`BOT_USER_ID_${botId}`],
    name: config[`BOT_NAME_${botId}`],
    variant: config[`BOT_VARIANT_${botId}`],
  }

  const [teamValue, setTeamValue] = useState();
  const [botVariantValue, setBotVariantValue] = useState(bot.variant);
  const handleTeamChange = (option) => {
    setTeamValue(option);
    Team(config.GAME_ID, option);
  }
  // TODO: Remember bot variant chosen across refreshes
  const handleBotVariantChange = (option) => {
    setBotVariantValue(option);
    ChooseBotVariant(option);
  }

  setTimeout(() => {
    Join(bot.id, bot.name);
    ChooseBotVariant(botVariantValue || bot.variant);
  });

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
            placeholder="Bot Variant"
            size="small"
            options={['MurderBot', 'EnigmaBot']}
            value={botVariantValue}
            onChange={({option}) => handleBotVariantChange(option)}
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
