// import React from 'react'
import MurderBot from '../murderbot'
import { gameDefaults, initializeGameState }  from './testHelper'

describe('MurderBot', () => {
  let gameState
  let MurderBotSUT

  beforeEach(() => {
    MurderBotSUT = Object.assign({}, MurderBot) // Create a clone to keep from polluting read-only bot instance.
  })

  it('should exist', () => {
    expect(MurderBot).toBeInstanceOf(Object)
  })

  describe('init()', () => {

    it('should initialize from test configuration without errors', async () => {
      gameState = initializeGameState('empty', 'allArmiesOnGeneral')

      expect(gameState).toEqual(expect.objectContaining({playerIndex: gameDefaults.playerIndex}))
      expect(gameState).toEqual(expect.objectContaining({turn: gameDefaults.turn}))
      expect(gameState).toEqual(expect.objectContaining({mapHeight: gameDefaults.mapHeight}))
      expect(gameState).toEqual(expect.objectContaining({mapWidth: gameDefaults.mapWidth}))
      expect(gameState).toEqual(expect.objectContaining({mapSize: gameDefaults.mapSize}))

      MurderBotSUT.init(gameState)

      expect(gameState).toEqual(MurderBotSUT.game)
    })
  })

  describe('AI Logic', () => {

    describe('CREEP', () => {

      it('should execute predictably for one large army', async () => {
        gameState = initializeGameState('empty', 'allArmiesOnGeneral')
        MurderBotSUT.init(gameState)

        // TODO: Stop calling these directly, and call move(), maybe with a preview flag, so that the move queue is held for inspection
        MurderBotSUT.determineIntel()
        MurderBotSUT.determineForeignPolicy()
        MurderBotSUT.determineMoves()

        expect(MurderBotSUT.game.intel.attackQueue[0]).toEqual(expect.objectContaining({mode: 'CREEP'}))
      })

      it('should execute predictably for two large armies', async () => {
        gameState = initializeGameState('empty', 'twoLargeArmies')
        MurderBotSUT.init(gameState)

        MurderBotSUT.determineIntel()
        MurderBotSUT.determineForeignPolicy()
        MurderBotSUT.determineMoves()

        expect(MurderBotSUT.game.intel.attackQueue[0]).toEqual(expect.objectContaining({mode: 'CREEP'}))
      })

      it('should execute predictably for a block of equal armies', async () => {
        gameState = initializeGameState('occupiedCorner', 'cornerArmies')
        MurderBotSUT.init(gameState)

        MurderBotSUT.determineIntel()
        MurderBotSUT.determineForeignPolicy()
        MurderBotSUT.determineMoves()

        expect(MurderBotSUT.game.intel.attackQueue[0]).toEqual(expect.objectContaining({mode: 'CREEP'}))
      })
    })

    describe('MURDER', () => {

      it('should execute predictably for one large army on an empty board', async () => {
        gameState = initializeGameState('empty', 'allArmiesOnGeneral')
        gameState.opponents[0] = { color: 'RED', dead: false, tiles: 1, total: 10, availableArmies: 9, generalLocationIndex: 24 }
        gameState.generals = [24]
        gameState.armies[24] = 10
        gameState.terrain[24] = 0

        MurderBotSUT.init(gameState)

        console.dir(MurderBotSUT.game.intel.attackQueue)

        MurderBotSUT.determineIntel()
        MurderBotSUT.determineForeignPolicy()
        MurderBotSUT.determineMoves()

        expect(MurderBotSUT.game.intel.attackQueue[0]).toEqual(expect.objectContaining({mode: 'MURDER'}))

        MurderBotSUT.game.intel.attackQueue.forEach((move, arrayIndex) => {
          if (MurderBotSUT.game.intel.attackQueue[arrayIndex - 1] && move.mode === 'MURDER') {
            expect(move.attackerIndex).toEqual(MurderBotSUT.game.intel.attackQueue[arrayIndex - 1].targetIndex)
          }

          // Make sure we actually planned an attack on the enemy general
          if (move.targetIndex === 24) {
            expect(move).toEqual(expect.objectContaining({mode: 'MURDER', targetIndex: 24}))
          }
        });
      })
    })

    describe('DEFEND', () => {

      it.skip('should execute predictably when the opponent is stronger', async () => {
        gameState = initializeGameState('empty', 'allArmiesOnGeneral')
        gameState.opponents[0] = { color: 'RED', dead: false, tiles: 1, total: 10, availableArmies: 9, generalLocationIndex: 24 }
        gameState.generals = [24]
        gameState.armies[24] = 25
        gameState.terrain[24] = 0
        MurderBotSUT.init(gameState)

        MurderBotSUT.determineIntel()
        MurderBotSUT.determineForeignPolicy()
        MurderBotSUT.determineMoves()

        console.dir(MurderBotSUT.game.intel.attackQueue)

        expect(MurderBotSUT.game.intel.attackQueue[0]).toEqual(expect.objectContaining({mode: 'DEFEND'}))

        MurderBotSUT.game.intel.attackQueue.forEach((move, arrayIndex) => {
          if (MurderBotSUT.game.intel.attackQueue[arrayIndex - 1] && move.mode === 'DEFEND') {
          }

          // Make sure we actually planned to reinforce our general
          if (move.targetIndex === 6) {
            expect(move).toEqual(expect.objectContaining({mode: 'DEFEND', targetIndex: 6}))
          }
        });
      })
    })
  })
})
