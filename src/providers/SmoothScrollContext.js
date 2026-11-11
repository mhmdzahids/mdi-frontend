import { createContext, useContext } from 'react'

export const SmoothScrollContext = createContext({
  getLenis: () => null,
  isReducedMotion: false
})

export const useSmoothScroll = () => useContext(SmoothScrollContext)
