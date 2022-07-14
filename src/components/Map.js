import React from "react"
import useMapData from "../services/useMapData"
// import { map } from "../test-env";

export default function Map() {
  const mapData = useMapData()
	const map = mapData.map

	if (!map) return null

	const mapWidth = map.splice(0, 1)[0]
  const mapHeight = map.splice(0, 1)[0]
  const mapSize = mapWidth * mapHeight
  const armies = map.splice(0, mapSize)
  const terrain = map
  // Instead of splitting off pieces of map as needed, like in client.js, here we actually incrementally modify map to remove mapWidth & mapHeight & armies, so that the looping through the map maps easier.

  function terrainToStyleClass (terrainValue) {
		let className = ''

    switch (terrainValue) {
			case -4:
				className = 'fog mountain'
				break
			case -3:
				className = 'fog'
				break
			case -2:
				className = 'mountain'
				break
			case 0:
				className = 'red'
				break
			case 1:
				className = 'lightblue'
				break
			case 2:
				className = 'green'
				break
			case 3:
				className = 'teal'
				break
			case 4:
				className = 'orange'
				break
			case 5:
				className = 'pink'
				break
			case 6:
				className = 'purple'
				break
			case 7:
				className = 'maroon'
				break
			case 8:
				className = 'yellow'
				break
			case 9:
				className = 'brown'
				break
			case 10:
				className = 'blue'
				break
			case 11:
				className = 'purple-blue'
				break
			default:
				break
		}

    return className
	}

  function MapRow ({arrayIndex}) {
    const elementArray = []

    for (let rowSquareIndex = arrayIndex; rowSquareIndex < arrayIndex + mapWidth; rowSquareIndex++) {
			// TODO: Add city and general designation if appropriate
      elementArray.push(<MapSquare key={rowSquareIndex} index={rowSquareIndex} terrainValue={terrain[rowSquareIndex]} armyValue={armies[rowSquareIndex]} />)
    }

    return elementArray
  }

  function MapSquare ({index, terrainValue, armyValue}) {
		return <td title={index} className={terrainToStyleClass(terrainValue)}>{(armyValue > 0) ? armyValue : ''}</td>
  }

  return (
    <table id="gameMap">
      <tbody>
          {/* <td className="city"></td> */}
          {armies.map((armyCount, arrayIndex) => {
            if (arrayIndex % mapWidth === 0) {
              return (
                <tr key={arrayIndex}>
                  <MapRow key={arrayIndex} arrayIndex={arrayIndex} />
                </tr>
              )
            } else {
              return null
            }
          })}
      </tbody>
    </table>
  )
}
