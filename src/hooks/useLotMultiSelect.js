import { useState } from 'react'

export function useLotMultiSelect(items = []) {
  const [selectedCodes, setSelectedCodes] = useState(new Set())
  const [isSelecting, setIsSelecting] = useState(false)

  const toggleSelect = (code) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const selectAll = () => {
    if (selectedCodes.size === items.length) {
      setSelectedCodes(new Set())
    } else {
      setSelectedCodes(new Set(items.map((i) => i.lotCode)))
    }
  }

  const clearSelection = () => {
    setSelectedCodes(new Set())
    setIsSelecting(false)
  }

  const startSelecting = () => {
    setIsSelecting(true)
  }

  const selectedLots = items.filter((i) => selectedCodes.has(i.lotCode))

  return {
    isSelecting,
    selectedCodes,
    selectedLots,
    selectedCount: selectedCodes.size,
    toggleSelect,
    selectAll,
    clearSelection,
    startSelecting,
    isAllSelected: items.length > 0 && selectedCodes.size === items.length
  }
}
