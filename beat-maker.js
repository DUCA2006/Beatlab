"use strict";

window.BeatlabBeatMaker = (function () {

  let audioContext = null;

  let masterGain = null;

  let isPlaying = false;

  let timer = null;

  let currentStep = 0;

  let nextNoteTime = 0;

  let bpm = 110;

  let swing = 0;

  let volume = 0.8;

  const STEPS = 16;

  const patterns = {

    kick: [

      1, 0, 0, 0,

      1, 0, 0, 0,

      1, 0, 0, 0,

      1, 0, 0, 0

    ],

    snare: [

      0, 0, 0, 0,

      1, 0, 0, 0,

      0, 0, 0, 0,

      1, 0, 0, 0

    ],

    hat: [

      1, 1, 1, 1,

      1, 1, 1, 1,

      1, 1, 1, 1,

      1, 1, 1, 1

    ],

    clap: [

      0, 0, 0, 0,

      0, 0, 0, 0,

      1, 0, 0, 0,

      0, 0, 0, 0

    ],

    bass: [

      1, 0, 0, 0,

      0, 0, 1, 0,

      1, 0, 0, 0,

      0, 0, 1, 0

    ]

  };

  function initialize() {

    if (audioContext) return;

    const AudioContextClass =

      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {

      throw new Error("Your browser does not support Web Audio.");

    }

    audioContext = new AudioContextClass();

    masterGain = audioContext.createGain();

    masterGain.gain.value = volume;

    masterGain.connect(audioContext.destination);

  }

  async function unlockAudio() {

    initialize();

    if (audioContext.state === "suspended") {

      await audioContext.resume();

    }

  }

  function makeNoise(duration) {

    const length = Math.max(

      1,

      Math.floor(audioContext.sampleRate * duration)

    );

    const buffer = audioContext.createBuffer(

      1,

      length,

      audioContext.sampleRate

    );

    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {

      data[i] = Math.random() * 2 - 1;

    }

    return buffer;

  }

  function kick(time) {

    const oscillator = audioContext.createOscillator();

    const gain = audioContext.createGain();

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(150, time);

    oscillator.frequency.exponentialRampToValueAtTime(

      42,

      time + 0.16

    );

    gain.gain.setValueAtTime(1, time);

    gain.gain.exponentialRampToValueAtTime(

      0.001,

      time + 0.32

    );

    oscillator.connect(gain);

    gain.connect(masterGain);

    oscillator.start(time);

    oscillator.stop(time + 0.34);

  }

  function snare(time) {

    const noise = audioContext.createBufferSource();

    const filter = audioContext.createBiquadFilter();

    const noiseGain = audioContext.createGain();

    noise.buffer = makeNoise(0.2);

    filter.type = "highpass";

    filter.frequency.value = 1200;

    noiseGain.gain.setValueAtTime(0.65, time);

    noiseGain.gain.exponentialRampToValueAtTime(

      0.001,

      time + 0.18

    );

    noise.connect(filter);

    filter.connect(noiseGain);

    noiseGain.connect(masterGain);

    noise.start(time);

    noise.stop(time + 0.2);

    const body = audioContext.createOscillator();

    const bodyGain = audioContext.createGain();

    body.type = "triangle";

    body.frequency.value = 180;

    bodyGain.gain.setValueAtTime(0.45, time);

    bodyGain.gain.exponentialRampToValueAtTime(

      0.001,

      time + 0.1

    );

    body.connect(bodyGain);

    bodyGain.connect(masterGain);

    body.start(time);

    body.stop(time + 0.12);

  }

  function hiHat(time) {

    const noise = audioContext.createBufferSource();

    const filter = audioContext.createBiquadFilter();

    const gain = audioContext.createGain();

    noise.buffer = makeNoise(0.08);

    filter.type = "highpass";

    filter.frequency.value = 7500;

    gain.gain.setValueAtTime(0.25, time);

    gain.gain.exponentialRampToValueAtTime(

      0.001,

      time + 0.065

    );

    noise.connect(filter);

    filter.connect(gain);

    gain.connect(masterGain);

    noise.start(time);

    noise.stop(time + 0.08);

  }

  function clap(time) {

    [0, 0.018, 0.04].forEach(function (offset) {

      const noise = audioContext.createBufferSource();

      const filter = audioContext.createBiquadFilter();

      const gain = audioContext.createGain();

      noise.buffer = makeNoise(0.08);

      filter.type = "bandpass";

      filter.frequency.value = 1800;

      gain.gain.setValueAtTime(0.3, time + offset);

      gain.gain.exponentialRampToValueAtTime(

        0.001,

        time + offset + 0.08

      );

      noise.connect(filter);

      filter.connect(gain);

      gain.connect(masterGain);

      noise.start(time + offset);

      noise.stop(time + offset + 0.09);

    });

  }

  function bass(time, step) {

    const oscillator = audioContext.createOscillator();

    const filter = audioContext.createBiquadFilter();

    const gain = audioContext.createGain();

    const notes = [55, 55, 73.42, 65.41];

    const note = notes[Math.floor(step / 4) % notes.length];

    oscillator.type = "sawtooth";

    oscillator.frequency.setValueAtTime(note, time);

    filter.type = "lowpass";

    filter.frequency.value = 220;

    gain.gain.setValueAtTime(0.25, time);

    gain.gain.exponentialRampToValueAtTime(

      0.001,

      time + 0.2

    );

    oscillator.connect(filter);

    filter.connect(gain);

    gain.connect(masterGain);

    oscillator.start(time);

    oscillator.stop(time + 0.22);

  }

  function playInstrument(instrument, time, step) {

    switch (instrument) {

      case "kick":

        kick(time);

        break;

      case "snare":

        snare(time);

        break;

      case "hat":

        hiHat(time);

        break;

      case "clap":

        clap(time);

        break;

      case "bass":

        bass(time, step);

        break;

    }

  }

  function scheduleStep(step, time) {

    Object.keys(patterns).forEach(function (instrument) {

      if (patterns[instrument][step]) {

        playInstrument(instrument, time, step);

      }

    });

    if (typeof onStep === "function") {

      const delay = Math.max(

        0,

        (time - audioContext.currentTime) * 1000

      );

      setTimeout(function () {

        if (isPlaying) onStep(step);

      }, delay);

    }

  }

  let onStep = null;

  function scheduler() {

    while (

      isPlaying &&

      nextNoteTime < audioContext.currentTime + 0.1

    ) {

      scheduleStep(currentStep, nextNoteTime);

      const secondsPerBeat = 60 / bpm;

      const stepDuration = secondsPerBeat / 4;

      nextNoteTime += stepDuration;

      if (currentStep % 2 === 1) {

        nextNoteTime += stepDuration * swing * 0.5;

      }

      currentStep = (currentStep + 1) % STEPS;

    }

  }

  async function play() {

    await unlockAudio();

    if (isPlaying) return;

    isPlaying = true;

    nextNoteTime = audioContext.currentTime + 0.05;

    timer = setInterval(scheduler, 25);

  }

  function stop() {

    isPlaying = false;

    if (timer) {

      clearInterval(timer);

      timer = null;

    }

    currentStep = 0;

    if (typeof onStep === "function") {

      onStep(-1);

    }

  }

  function toggleStep(instrument, step) {

    if (!patterns[instrument]) return false;

    if (step < 0 || step >= STEPS) return false;

    patterns[instrument][step] =

      patterns[instrument][step] ? 0 : 1;

    return Boolean(patterns[instrument][step]);

  }

  function setPattern(instrument, values) {

    if (!patterns[instrument]) return;

    if (!Array.isArray(values) || values.length !== STEPS) {

      throw new Error("A pattern must contain exactly 16 steps.");

    }

    patterns[instrument] = values.map(function (value) {

      return value ? 1 : 0;

    });

  }

  function getPattern(instrument) {

    return patterns[instrument]

      ? patterns[instrument].slice()

      : null;

  }

  function setBPM(value) {

    bpm = Math.max(40, Math.min(240, Number(value) || 110));

    return bpm;

  }

  function setSwing(value) {

    swing = Math.max(0, Math.min(1, Number(value) || 0));

  }

  function setVolume(value) {

    volume = Math.max(0, Math.min(1, Number(value)));

    if (masterGain) {

      masterGain.gain.setTargetAtTime(

        volume,

        audioContext.currentTime,

        0.02

      );

    }

  }

  function setStepListener(callback) {

    onStep = callback;

  }

  function randomize() {

    Object.keys(patterns).forEach(function (instrument) {

      patterns[instrument] = patterns[instrument].map(

        function () {

          const chance = instrument === "hat" ? 0.8 : 0.25;

          return Math.random() < chance ? 1 : 0;

        }

      );

    });

    return getAllPatterns();

  }

  function getAllPatterns() {

    const copy = {};

    Object.keys(patterns).forEach(function (key) {

      copy[key] = patterns[key].slice();

    });

    return copy;

  }

  function reset() {

    stop();

    Object.keys(patterns).forEach(function (instrument) {

      patterns[instrument] = new Array(STEPS).fill(0);

    });

  }

  function getState() {

    return {

      isPlaying: isPlaying,

      bpm: bpm,

      swing: swing,

      volume: volume,

      currentStep: currentStep,

      patterns: getAllPatterns()

    };

  }

  return {

    play: play,

    stop: stop,

    toggleStep: toggleStep,

    setPattern: setPattern,

    getPattern: getPattern,

    setBPM: setBPM,

    setSwing: setSwing,

    setVolume: setVolume,

    setStepListener: setStepListener,

    randomize: randomize,

    getAllPatterns: getAllPatterns,

    reset: reset,

    getState: getState

  };

})();