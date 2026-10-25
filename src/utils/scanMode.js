/**
 * Helper Logika Mode Scan (1x vs 2x) & State Machine Status MES
 */

export function getEffectiveScanMode(scanModeSettings, stationId) {
  if (!scanModeSettings) return '1X'
  const stationOverride = scanModeSettings.station_modes?.[stationId]
  if (stationOverride && (stationOverride === '1X' || stationOverride === '2X')) {
    return stationOverride
  }
  return scanModeSettings.global_mode || '1X'
}

export function classifyLotStatus(rawStatus) {
  if (!rawStatus) return 'DICETAK'
  const s = String(rawStatus).toUpperCase()
  if (s === 'PRINTED_PENDING_STOCK_IN' || s === 'DICETAK') return 'DICETAK'
  if (s.startsWith('READY_IN_') || s === 'DI_STOK') return 'DI_STOK'
  if (s.startsWith('IN_TRANSIT_TO_') || s === 'KELUAR') return 'KELUAR'
  if (
    s === 'IN_ASSEMBLY_STATION' ||
    s === 'IN_FINISHING_STATION' ||
    s === 'IN_MEAT_MIXING_STATION' ||
    s === 'IN_SEASONING_STATION' ||
    s === 'DITERIMA'
  ) {
    return 'DITERIMA'
  }
  if (s === 'CONSUMED') return 'CONSUMED'
  if (s === 'CLOSED') return 'CLOSED'
  return s
}

export function groupStationLots(lots, stationId, scanModeSettings) {
  const mode = getEffectiveScanMode(scanModeSettings, stationId)
  const pendingConfirmation = []
  const onHandStock = []
  const inTransit = []
  const receivedOrConsumed = []

  const lotList = Array.isArray(lots) ? lots : []

  for (const lot of lotList) {
    const norm = classifyLotStatus(lot.status)
    if (norm === 'DICETAK') {
      if (mode === '2X') {
        pendingConfirmation.push(lot)
      } else {
        // Mode 1x: Langsung terhitung sebagai stok on-hand
        onHandStock.push(lot)
      }
    } else if (norm === 'DI_STOK') {
      onHandStock.push(lot)
    } else if (norm === 'KELUAR') {
      inTransit.push(lot)
    } else {
      receivedOrConsumed.push(lot)
    }
  }

  return {
    mode,
    pendingConfirmation,
    onHandStock,
    inTransit,
    receivedOrConsumed,
    totalStockCount: onHandStock.length,
    pendingCount: pendingConfirmation.length
  }
}
