import React, { useEffect, useState } from "react"
import { ForceStart, Join, Quit, Team, ChooseBotVariant, InitializeSocket } from "../../src/client.js"
import { Button, Box, CheckBox, Select } from "grommet"
import config from '../config'
import Map from "../components/Map"
import io from 'socket.io-client'

const socket = io("wss://botws.generals.io")

InitializeSocket(socket)

export default function Play({ match }) {
  const botId = match.params.bot

  const bot = {
    id: config[`BOT_USER_ID_${botId}`],
    name: config[`BOT_NAME_${botId}`],
    variant: config[`BOT_VARIANT_${botId}`],
  }

  // Handle sticky options per game ID
  const cache = (mode, data) => {
    if (mode === "READ") {
      let localData = localStorage.getItem(`generals-bot-${botId}`)
      localData = localData ? JSON.parse(localData) : { botVariantValue: 'MurderBot', showMap: true }

      return localData[data]
    } else if (mode === "WRITE") {
      localStorage.setItem(`generals-bot-${botId}`, JSON.stringify(data))
    }
  }

  const [teamValue, setTeamValue] = useState()
  const [botVariantValue, setBotVariantValue] = useState(cache("READ", "botVariantValue"))
  const [showMap, setShowMap] = useState(cache("READ", "showMap"))

  const handleTeamChange = (choice) => {
    setTeamValue(choice)
    Team(config.GAME_ID, choice)
  }

  // TODO: Load a different default bot variant for each ID
  const handleBotVariantChange = (choice) => {
    setBotVariantValue(choice)
    ChooseBotVariant(choice)
    cache("WRITE", {botVariantValue: choice, showMap: showMap})
  }

  const handleMapDisplayChange = (checked) => {
    setShowMap(checked)
    cache("WRITE", {botVariantValue: botVariantValue, showMap: checked})
  }

  // Empty dependency array forces a single run once, on mount, despite React warnings
  useEffect(() => {
    Join(bot.id, bot.name)
    ChooseBotVariant(botVariantValue || bot.variant)

    // Auto-scroll the log when entries are added
    const mutationObserverCallback = function(mutationList) {
      for(const mutation of mutationList) {
        if (mutation.type === 'childList') {
          mutation.target.scrollTop = mutation.target.scrollHeight
        }
      }
    }

    const logObserver = new MutationObserver(mutationObserverCallback)

    logObserver.observe(document.getElementById('log'), {
      attributes: false,
      childList: true,
      subtree: true
    })
  }, [])

  return (
    <>
      <p>GAME ID: <a href={"https://bot.generals.io/games/" + config.GAME_ID} target="_blank" rel="noopener noreferrer">{config.GAME_ID}</a> <br /><em>(close this window to leave a lobby or quit)</em></p>
      <Box pad="small">
        <div>
          <Button
            onClick={() => {
              ForceStart()
            }}
            label="Force Start"
          ></Button>
          <Button
            label="Join Game"
            margin="xsmall"
            onClick={() => {
              Join(bot.id, bot.name)
            }}
          ></Button>
          <Select
            placeholder="Team"
            size="xsmall"
            margin="xsmall"
            options={['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']}
            value={teamValue}
            onChange={({option}) => handleTeamChange(option)}
          />
          <Select
            placeholder="Bot Variant"
            size="xsmall"
            margin="xsmall"
            options={['MurderBot', 'EnigmaBot']}
            value={botVariantValue}
            onChange={({option}) => handleBotVariantChange(option)}
          />
          <Button
            label="Quit"
            margin="xsmall"
            onClick={() => {
              Quit()
            }}
          ></Button>
          <br />
          <CheckBox
            label="(WIP) Show Map"
            pad="xsmall"
            checked={showMap}
            onChange={(evt) => handleMapDisplayChange(evt.target.checked)}
          />
        </div>
      </Box>

      <Box>
        <span>Game Log:</span>
        <pre id="log" style={{"backgroundColor": "#eee", "fontSize": "16px", "lineHeight": "16px", "margin": 0, "maxHeight": "30vh", "minHeight": "6em", "overflow": "scroll"}}>
          Connecting to lobby: {config.GAME_ID}
        </pre>
      </Box>
      {(
        showMap &&
        <Box>
          <Map />
        </Box>
      )}
    </>
  )
}
