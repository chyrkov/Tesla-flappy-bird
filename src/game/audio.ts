const MASTER_VOLUME = 0.8
const MUSIC_VOLUME = 0.32
const SFX_VOLUME = 0.7
const BPM = 100
const STEPS_PER_BAR = 16
const STEP_DURATION = 60 / BPM / 4
const SCHEDULE_AHEAD = 0.12
const SCHEDULER_INTERVAL_MS = 25
const SILENCE = 0.0001
const OPEN_FILTER = 18000
const MUFFLED_FILTER = 700

interface Chord {
  bass: number
  notes: readonly number[]
}

const CHORDS: readonly Chord[] = [
  { bass: 45, notes: [57, 60, 64] },
  { bass: 41, notes: [57, 60, 65] },
  { bass: 48, notes: [55, 60, 64] },
  { bass: 43, notes: [55, 59, 62] },
]

const ARP_PATTERN = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 2, 1, 3]
const NEW_BEST_NOTES = [784, 988, 1175, 1568]

interface AudioGraph {
  context: AudioContext
  master: GainNode
  sfx: GainNode
  music: GainNode
  musicFilter: BiquadFilterNode
  arpBus: GainNode
  noise: AudioBuffer
}

interface ToneOptions {
  destination: AudioNode
  type: OscillatorType
  frequency: number
  endFrequency?: number
  start: number
  duration: number
  volume: number
  attack?: number
}

interface NoiseOptions {
  destination: AudioNode
  start: number
  duration: number
  volume: number
  filterType: BiquadFilterType
  frequency: number
  endFrequency?: number
  q?: number
}

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext
}

export interface AudioEngine {
  unlock: () => void
  playFlap: () => void
  playScore: () => void
  playCrash: () => void
  playNewBest: () => void
  playFlip: () => void
  setMuted: (isMuted: boolean) => void
  setMusicMuffled: (isMuffled: boolean) => void
  suspend: () => void
  resume: () => void
}

export function createAudioEngine(initialMuted: boolean): AudioEngine {
  let graph: AudioGraph | null = null
  let isMuted = initialMuted
  let nextStepTime = 0
  let step = 0

  const runScheduler = () => {
    if (!graph || graph.context.state !== 'running') return
    const { context } = graph
    if (nextStepTime < context.currentTime) nextStepTime = context.currentTime + 0.05
    while (nextStepTime < context.currentTime + SCHEDULE_AHEAD) {
      scheduleMusicStep(graph, step, nextStepTime)
      nextStepTime += STEP_DURATION
      step = (step + 1) % (STEPS_PER_BAR * CHORDS.length)
    }
  }

  const unlock = () => {
    if (!graph) {
      graph = createAudioGraph()
      if (!graph) return
      graph.master.gain.value = isMuted ? 0 : MASTER_VOLUME
      window.setInterval(runScheduler, SCHEDULER_INTERVAL_MS)
    }
    if (graph.context.state === 'suspended') void graph.context.resume()
  }

  const play = (playSound: (activeGraph: AudioGraph, now: number) => void) => {
    if (!graph || graph.context.state === 'closed') return
    playSound(graph, graph.context.currentTime)
  }

  const setMuted = (value: boolean) => {
    isMuted = value
    if (!graph) return
    graph.master.gain.setTargetAtTime(isMuted ? 0 : MASTER_VOLUME, graph.context.currentTime, 0.02)
  }

  const setMusicMuffled = (isMuffled: boolean) => {
    if (!graph) return
    const frequency = isMuffled ? MUFFLED_FILTER : OPEN_FILTER
    graph.musicFilter.frequency.setTargetAtTime(frequency, graph.context.currentTime, 0.15)
  }

  const suspend = () => {
    if (graph?.context.state === 'running') void graph.context.suspend()
  }

  const resume = () => {
    if (graph?.context.state === 'suspended') void graph.context.resume()
  }

  return {
    unlock,
    playFlap: () => play(playFlapSound),
    playScore: () => play(playScoreSound),
    playCrash: () => play(playCrashSound),
    playNewBest: () => play(playNewBestSound),
    playFlip: () => play(playFlipSound),
    setMuted,
    setMusicMuffled,
    suspend,
    resume,
  }
}

function createAudioGraph(): AudioGraph | null {
  const AudioContextClass = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
  if (!AudioContextClass) return null

  const context = new AudioContextClass()
  const master = context.createGain()
  const sfx = context.createGain()
  const music = context.createGain()
  const musicFilter = context.createBiquadFilter()
  const arpBus = context.createGain()
  const delay = context.createDelay(1)
  const feedback = context.createGain()
  const delayFilter = context.createBiquadFilter()

  master.connect(context.destination)
  sfx.gain.value = SFX_VOLUME
  sfx.connect(master)
  music.gain.value = MUSIC_VOLUME
  musicFilter.type = 'lowpass'
  musicFilter.frequency.value = OPEN_FILTER
  music.connect(musicFilter).connect(master)

  delay.delayTime.value = STEP_DURATION * 3
  feedback.gain.value = 0.38
  delayFilter.type = 'lowpass'
  delayFilter.frequency.value = 2200
  arpBus.connect(music)
  arpBus.connect(delay)
  delay.connect(delayFilter)
  delayFilter.connect(feedback)
  feedback.connect(delay)
  delayFilter.connect(music)

  return { context, master, sfx, music, musicFilter, arpBus, noise: createNoiseBuffer(context) }
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12)
}

function playTone(context: AudioContext, options: ToneOptions): void {
  const { destination, type, frequency, endFrequency, start, duration, volume } = options
  const attack = options.attack ?? 0.005
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  if (endFrequency)
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
  gain.gain.setValueAtTime(SILENCE, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + attack)
  gain.gain.exponentialRampToValueAtTime(SILENCE, start + duration)

  oscillator.connect(gain).connect(destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.05)
}

function playNoise(context: AudioContext, buffer: AudioBuffer, options: NoiseOptions): void {
  const { destination, start, duration, volume, filterType, frequency, endFrequency } = options
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()

  source.buffer = buffer
  filter.type = filterType
  filter.Q.value = options.q ?? 1
  filter.frequency.setValueAtTime(frequency, start)
  if (endFrequency) filter.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(SILENCE, start + duration)

  source.connect(filter).connect(gain).connect(destination)
  source.start(start, Math.random() * 0.5)
  source.stop(start + duration + 0.05)
}

function playBass(
  context: AudioContext,
  destination: AudioNode,
  frequency: number,
  start: number,
  duration: number,
): void {
  const oscillator = context.createOscillator()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()

  oscillator.type = 'sawtooth'
  oscillator.frequency.value = frequency
  filter.type = 'lowpass'
  filter.Q.value = 6
  filter.frequency.setValueAtTime(1200, start)
  filter.frequency.exponentialRampToValueAtTime(220, start + duration)
  gain.gain.setValueAtTime(SILENCE, start)
  gain.gain.exponentialRampToValueAtTime(0.32, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(SILENCE, start + duration)

  oscillator.connect(filter).connect(gain).connect(destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.05)
}

function playPad(
  context: AudioContext,
  destination: AudioNode,
  notes: readonly number[],
  start: number,
  duration: number,
): void {
  const filter = context.createBiquadFilter()
  const gain = context.createGain()

  filter.type = 'lowpass'
  filter.frequency.value = 1100
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(0.05, start + 0.5)
  gain.gain.setValueAtTime(0.05, start + duration - 0.4)
  gain.gain.linearRampToValueAtTime(0, start + duration)
  filter.connect(gain).connect(destination)

  for (const note of notes) {
    for (const detune of [-9, 9]) {
      const oscillator = context.createOscillator()
      oscillator.type = 'sawtooth'
      oscillator.frequency.value = midiToFrequency(note)
      oscillator.detune.value = detune
      oscillator.connect(filter)
      oscillator.start(start)
      oscillator.stop(start + duration + 0.05)
    }
  }
}

function scheduleMusicStep(graph: AudioGraph, step: number, time: number): void {
  const { context, music, arpBus, noise } = graph
  const chord = CHORDS[Math.floor(step / STEPS_PER_BAR) % CHORDS.length]
  const beatStep = step % STEPS_PER_BAR

  if (beatStep === 0) playPad(context, music, chord.notes, time, STEP_DURATION * STEPS_PER_BAR)

  if (beatStep % 4 === 0) {
    playTone(context, {
      destination: music,
      type: 'sine',
      frequency: 150,
      endFrequency: 42,
      start: time,
      duration: 0.3,
      volume: 0.9,
      attack: 0.002,
    })
  }

  if (beatStep === 4 || beatStep === 12) {
    playNoise(context, noise, {
      destination: music,
      start: time,
      duration: 0.18,
      volume: 0.35,
      filterType: 'highpass',
      frequency: 1400,
    })
    playTone(context, {
      destination: music,
      type: 'triangle',
      frequency: 220,
      endFrequency: 150,
      start: time,
      duration: 0.1,
      volume: 0.2,
    })
  }

  playNoise(context, noise, {
    destination: music,
    start: time,
    duration: 0.045,
    volume: beatStep % 4 === 2 ? 0.1 : 0.035,
    filterType: 'highpass',
    frequency: 7500,
  })

  if (beatStep % 2 === 0) {
    const octave = beatStep % 8 === 6 ? 12 : 0
    playBass(context, music, midiToFrequency(chord.bass + octave), time, STEP_DURATION * 1.8)
  }

  const arpIndex = ARP_PATTERN[beatStep]
  const arpNote = arpIndex === 3 ? chord.notes[0] + 12 : chord.notes[arpIndex]
  playTone(context, {
    destination: arpBus,
    type: 'square',
    frequency: midiToFrequency(arpNote + 12),
    start: time,
    duration: STEP_DURATION * 0.9,
    volume: 0.045,
  })
}

function playFlapSound(graph: AudioGraph, now: number): void {
  const { context, sfx, noise } = graph
  playNoise(context, noise, {
    destination: sfx,
    start: now,
    duration: 0.22,
    volume: 0.35,
    filterType: 'bandpass',
    frequency: 600,
    endFrequency: 2600,
    q: 1.2,
  })
  playTone(context, {
    destination: sfx,
    type: 'sine',
    frequency: 160,
    endFrequency: 60,
    start: now,
    duration: 0.14,
    volume: 0.35,
  })
  playTone(context, {
    destination: sfx,
    type: 'square',
    frequency: 420,
    endFrequency: 760,
    start: now,
    duration: 0.08,
    volume: 0.04,
  })
}

function playScoreSound(graph: AudioGraph, now: number): void {
  const { context, sfx } = graph
  playTone(context, {
    destination: sfx,
    type: 'square',
    frequency: 988,
    start: now,
    duration: 0.08,
    volume: 0.08,
  })
  playTone(context, {
    destination: sfx,
    type: 'square',
    frequency: 1319,
    start: now + 0.07,
    duration: 0.16,
    volume: 0.08,
  })
}

function playCrashSound(graph: AudioGraph, now: number): void {
  const { context, sfx, noise } = graph
  playNoise(context, noise, {
    destination: sfx,
    start: now,
    duration: 0.9,
    volume: 0.7,
    filterType: 'lowpass',
    frequency: 4000,
    endFrequency: 120,
  })
  playTone(context, {
    destination: sfx,
    type: 'sine',
    frequency: 140,
    endFrequency: 30,
    start: now,
    duration: 0.6,
    volume: 0.6,
  })
  playTone(context, {
    destination: sfx,
    type: 'sawtooth',
    frequency: 300,
    endFrequency: 40,
    start: now,
    duration: 0.5,
    volume: 0.12,
  })
}

function playFlipSound(graph: AudioGraph, now: number): void {
  const { context, sfx, noise } = graph
  playNoise(context, noise, {
    destination: sfx,
    start: now,
    duration: 0.45,
    volume: 0.3,
    filterType: 'bandpass',
    frequency: 400,
    endFrequency: 3200,
    q: 2,
  })
  playTone(context, {
    destination: sfx,
    type: 'triangle',
    frequency: 440,
    endFrequency: 1320,
    start: now,
    duration: 0.4,
    volume: 0.08,
  })
}

function playNewBestSound(graph: AudioGraph, now: number): void {
  const { context, sfx } = graph
  NEW_BEST_NOTES.forEach((frequency, index) => {
    playTone(context, {
      destination: sfx,
      type: 'triangle',
      frequency,
      start: now + 0.15 + index * 0.09,
      duration: 0.2,
      volume: 0.12,
    })
  })
}
