import { useEffect, useState } from "react"
import { FetchMapData } from "../client.js"

/**
 * Map updating logic. Based on document-level events.
 * @returns {Array} - The latest updated map array.
 */
export default function useMapData() {
  const [mapData, setMapData] = useState(FetchMapData() || { map: []})

  const handleUpdate = (evt) => {
    setMapData(evt.detail)
  }

  useEffect(() => {
    document.addEventListener('MAP_UPDATE', handleUpdate)
    return () => { document.removeEventListener('MAP_UPDATE', handleUpdate) }

  }, [mapData])

  return mapData
}
