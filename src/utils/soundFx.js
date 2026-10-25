// Sound & Haptic FX using Web Audio API and Navigator Vibrate
// Works across modern mobile browsers (Android Chrome, iOS Safari) without external audio files

let audioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

export function playSuccessBeep() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime) // A5 note
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.08) // A6 chirp

    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.12)
  } catch {
    // AudioContext might be restricted until user interaction
  }

  vibrateSuccess()
}

export function playErrorBeep() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(220, ctx.currentTime)
    osc.frequency.setValueAtTime(180, ctx.currentTime + 0.1)

    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  } catch {
    // ignore
  }

  vibrateError()
}

export function vibrateSuccess() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(60)
    }
  } catch {
    // ignore
  }
}

export function vibrateError() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100])
    }
  } catch {
    // ignore
  }
}
