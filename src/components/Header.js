import React from "react";
import { Anchor, Box, Heading } from "grommet";
import { Link } from "react-router-dom";
import config from '../config'

const BOT_NUMBER = (window.location.pathname.includes('/play/')) ? window.location.pathname.replace('/play/', '') : '';

// TODO: Change the header color to match the bot color

export default function Header() {
  return (
    <Box background="brand" pad="medium" direction="row" align="center">
      { (BOT_NUMBER) &&
        <Heading level="1" margin="medium">
        {config[`BOT_NAME_${BOT_NUMBER}`]} {BOT_NUMBER} (generals.io)
      </Heading>
}
      <Box margin="small">
        <Link component={Anchor} to="/play">
          Play
        </Link>
      </Box>
      <Box margin="small">
        <Link component={Anchor} to="/test">
          Test
        </Link>
      </Box>
    </Box>
  );
}
