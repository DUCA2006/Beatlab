"use strict";
(function () {
  let audioContext = null;
  let masterGain = null;
  let masterCompressor = null;
  const tracks = new Map();
  let nextTrackId = 1;
  function ensureAudioContext() {
    if (!audioContext) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error(
          "Web Audio is not supported by this browser."
        );
      }
      audioContext = new AudioContextClass();
      masterGain = audioContext.createGain();
      masterCompressor = audioContext.createDynamicsCompressor();
      masterCompressor.threshold.value = -8;
      masterCompressor.knee.value = 15;
      masterCompressor.ratio.value = 3;
      masterCompressor.attack.value = 0.005;
      masterCompressor.release.value = 0.2;
      masterGain.connect(masterCompressor);
      masterCompressor.connect(audioContext.destination);
    }
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(function (error) {
        console.warn("Audio context resume failed:", error);
      });
    }
    return audioContext;
  }
  function createTrack(name, options = {}) {
    const context = ensureAudioContext();
    const input = context.createGain();
    const equalizerLow = context.createBiquadFilter();
    const equalizerMid = context.createBiquadFilter();
    const equalizerHigh = context.createBiquadFilter();
    const trackGain = context.createGain();
    equalizerLow.type = "lowshelf";
    equalizerLow.frequency.value = 180;
    equalizerMid.type = "peaking";
    equalizerMid.frequency.value = 1000;
    equalizerMid.Q.value = 0.8;
    equalizerHigh.type = "highshelf";
    equalizerHigh.frequency.value = 5000;
    input.connect(equalizerLow);
    equalizerLow.connect(equalizerMid);
    equalizerMid.connect(equalizerHigh);
    equalizerHigh.connect(trackGain);
    trackGain.connect(masterGain);
    const id = "track_" + nextTrackId++;
    const track = {
      id,
      name: name || "Untitled track",
      input,
      equalizerLow,
      equalizerMid,
      equalizerHigh,
      gain: trackGain,
      volume: options.volume ?? 1,
      muted: false,
      audioElement: null,
      mediaSource: null,
      objectUrl: null,
      effects: {},
      disposed: false
    };
    trackGain.gain.value = track.volume;
    tracks.set(id, track);
    return id;
  }
  function getTrack(id) {
    const track = tracks.get(id);
    if (!track || track.disposed) {
      throw new Error("Audio track not found.");
    }
    return track;
  }
  function loadAudio(id, source) {
    const track = getTrack(id);
    if (!source) {
      throw new Error("Please provide an audio file or URL.");
    }
    if (track.audioElement) {
      track.audioElement.pause();
      if (track.mediaSource) {
        track.mediaSource.disconnect();
      }
      track.audioElement.removeAttribute("src");
      track.audioElement.load();
      track.audioElement = null;
      track.mediaSource = null;
    }
    const audio = new Audio();
    audio.preload = "metadata";
    audio.playsInline = true;
    let audioUrl = source;
    if (source instanceof Blob) {
      audioUrl = URL.createObjectURL(source);
      track.objectUrl = audioUrl;
    }
    audio.src = audioUrl;
    const context = ensureAudioContext();
    const sourceNode =
      context.createMediaElementSource(audio);
    sourceNode.connect(track.input);
    track.audioElement = audio;
    track.mediaSource = sourceNode;
    return audio;
  }
  async function play(id) {
    const track = getTrack(id);
    if (!track.audioElement) {
      throw new Error("Load an audio file before playing.");
    }
    const context = ensureAudioContext();
    if (context.state === "suspended") {
      await context.resume();
    }
    await track.audioElement.play();
    return true;
  }
  function pause(id) {
    const track = getTrack(id);
    if (track.audioElement) {
      track.audioElement.pause();
    }
  }
  function stop(id) {
    const track = getTrack(id);
    if (track.audioElement) {
      track.audioElement.pause();
      track.audioElement.currentTime = 0;
    }
  }
  function setVolume(id, value) {
    const track = getTrack(id);
    const volume = Math.max(0, Math.min(1, Number(value)));
    if (!Number.isFinite(volume)) {
      throw new Error("Volume must be a number from 0 to 1.");
    }
    track.volume = volume;
    track.gain.gain.setTargetAtTime(
      track.muted ? 0 : volume,
      ensureAudioContext().currentTime,
      0.015
    );
  }
  function mute(id, muted = true) {
    const track = getTrack(id);
    track.muted = Boolean(muted);
    track.gain.gain.setTargetAtTime(
      track.muted ? 0 : track.volume,
      ensureAudioContext().currentTime,
      0.015
    );
  }
  function setEQ(id, settings = {}) {
    const track = getTrack(id);
    const context = ensureAudioContext();
    const low = Math.max(
      -12,
      Math.min(12, Number(settings.bass ?? 0))
    );
    const mid = Math.max(
      -12,
      Math.min(12, Number(settings.mid ?? 0))
    );
    const high = Math.max(
      -12,
      Math.min(12, Number(settings.treble ?? 0))
    );
    if (![low, mid, high].every(Number.isFinite)) {
      throw new Error("EQ values must be valid numbers.");
    }
    const now = context.currentTime;
    track.equalizerLow.gain.setTargetAtTime(low, now, 0.02);
    track.equalizerMid.gain.setTargetAtTime(mid, now, 0.02);
    track.equalizerHigh.gain.setTargetAtTime(high, now, 0.02);
  }
  function setMasterVolume(value) {
    ensureAudioContext();
    const volume = Math.max(
      0,
      Math.min(1, Number(value))
    );
    if (!Number.isFinite(volume)) {
      throw new Error("Master volume must be between 0 and 1.");
    }
    masterGain.gain.setTargetAtTime(
      volume,
      audioContext.currentTime,
      0.02
    );
  }
  function getDuration(id) {
    const track = getTrack(id);
    return track.audioElement
      ? track.audioElement.duration
      : 0;
  }
  function getCurrentTime(id) {
    const track = getTrack(id);
    return track.audioElement
      ? track.audioElement.currentTime
      : 0;
  }
  function seek(id, seconds) {
    const track = getTrack(id);
    if (!track.audioElement) {
      throw new Error("No audio loaded.");
    }
    const duration = track.audioElement.duration;
    if (!Number.isFinite(duration)) {
      return false;
    }
    track.audioElement.currentTime = Math.max(
      0,
      Math.min(duration, Number(seconds) || 0)
    );
    return true;
  }
  function addReverb(id, amount = 0.2) {
    const track = getTrack(id);
    const context = ensureAudioContext();
    const wetAmount = Math.max(
      0,
      Math.min(1, Number(amount))
    );
    if (!Number.isFinite(wetAmount)) {
      throw new Error("Reverb amount must be between 0 and 1.");
    }
    if (track.effects.reverb) {
      track.effects.reverb.wet.gain.value = wetAmount;
      return;
    }
    const convolver = context.createConvolver();
    const wet = context.createGain();
    const dry = context.createGain();
    const length = Math.floor(context.sampleRate * 1.5);
    const impulse = context.createBuffer(
      2,
      length,
      context.sampleRate
    );
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] =
          (Math.random() * 2 - 1) *
          Math.pow(1 - i / length, 3);
      }
    }
    convolver.buffer = impulse;
    track.equalizerHigh.disconnect();
    track.equalizerHigh.connect(dry);
    dry.connect(track.gain);
    track.equalizerHigh.connect(convolver);
    convolver.connect(wet);
    wet.connect(track.gain);
    wet.gain.value = wetAmount;
    dry.gain.value = 1;
    track.effects.reverb = {
      convolver,
      wet,
      dry
    };
  }
  function setReverb(id, amount) {
    const track = getTrack(id);
    if (!track.effects.reverb) {
      addReverb(id, amount);
      return;
    }
    track.effects.reverb.wet.gain.value = Math.max(
      0,
      Math.min(1, Number(amount))
    );
  }
  function exportWav(id) {
    const track = getTrack(id);
    if (!track.audioElement) {
      return Promise.reject(
        new Error("Load audio before exporting.")
      );
    }
    return new Promise(function (resolve, reject) {
      const audio = track.audioElement;
      if (!Number.isFinite(audio.duration) ||
          audio.duration <= 0) {
        reject(new Error("The audio duration is not available."));
        return;
      }
      const sampleRate = 44100;
      const offline = new OfflineAudioContext(
        2,
        Math.ceil(audio.duration * sampleRate),
        sampleRate
      );
      const source = offline.createBufferSource();
      const fetchUrl = audio.currentSrc || audio.src;
      fetch(fetchUrl)
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Could not load audio for export.");
          }
          return response.arrayBuffer();
        })
        .then(function (arrayBuffer) {
          return offline.decodeAudioData(arrayBuffer);
        })
        .then(function (audioBuffer) {
          source.buffer = audioBuffer;
          const gain = offline.createGain();
          gain.gain.value = track.muted ? 0 : track.volume;
          source.connect(gain);
          gain.connect(offline.destination);
          source.start(0);
          return offline.startRendering();
        })
        .then(function (renderedBuffer) {
          const wavBlob = audioBufferToWav(renderedBuffer);
          resolve(wavBlob);
        })
        .catch(reject);
    });
  }
  function audioBufferToWav(buffer) {
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const frames = buffer.length;
    const bytesPerSample = 2;
    const dataSize = frames * channels * bytesPerSample;
    const arrayBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(arrayBuffer);
    function writeString(offset, value) {
      for (let i = 0; i < value.length; i++) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    }
    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(
      28,
      sampleRate * channels * bytesPerSample,
      true
    );
    view.setUint16(32, channels * bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);
    let offset = 44;
    for (let i = 0; i < frames; i++) {
      for (let channel = 0; channel < channels; channel++) {
        let sample = buffer.getChannelData(channel)[i];
        sample = Math.max(-1, Math.min(1, sample));
        const pcm = sample < 0
          ? sample * 32768
          : sample * 32767;
        view.setInt16(offset, pcm, true);
        offset += 2;
      }
    }
    return new Blob([arrayBuffer], {
      type: "audio/wav"
    });
  }
  function removeTrack(id) {
    const track = tracks.get(id);
    if (!track) {
      return;
    }
    track.disposed = true;
    if (track.audioElement) {
      track.audioElement.pause();
      track.audioElement.removeAttribute("src");
      track.audioElement.load();
    }
    try {
      track.input.disconnect();
      track.equalizerLow.disconnect();
      track.equalizerMid.disconnect();
      track.equalizerHigh.disconnect();
      track.gain.disconnect();
    } catch (error) {
      console.warn("Audio cleanup warning:", error);
    }
    if (track.objectUrl) {
      URL.revokeObjectURL(track.objectUrl);
    }
    tracks.delete(id);
  }
  window.BeatlabAudio = {
    createTrack,
    loadAudio,
    play,
    pause,
    stop,
    setVolume,
    mute,
    setEQ,
    setMasterVolume,
    getDuration,
    getCurrentTime,
    seek,
    addReverb,
    setReverb,
    exportWav,
    removeTrack,
    get context() {
      return audioContext;
    }
  };
})();