"use strict";

window.BEATLAB_CONFIG = {
  appName: "BEATLAB AI",
  version: "1.1.0",
  
  audio: {
    maxRecordingMinutes: 10,
    defaultSampleRate: 44100,
    preferredFormat: "audio/webm",
    maxUploadSizeMB: 30
  },
  
  storage: {
    projectsKey: "beatlab_projects_v1",
    settingsKey: "beatlab_settings_v1",
    libraryKey: "beatlab_library_v1"
  },
  
  studio: {
    defaultVolume: 0.8,
    defaultBPM: 100,
    minBPM: 40,
    maxBPM: 240,
    metronomeEnabled: false
  },
  
  effects: {
    reverb: 0,
    echo: 0,
    bass: 0,
    treble: 0,
    vocalEnhancement: false
  },
  
  ai: {
    enabled: false,
    endpoint: "",
    provider: "gemini",
    features: [
      "song-analysis",
      "beat-recommendations",
      "music-generation",
      "vocal-enhancement"
    ]
  },
  
  beatStyles: [
    "Afrobeat",
    "Amapiano",
    "Hip-Hop",
    "R&B",
    "Gospel",
    "Pop",
    "Trap",
    "Drill",
    "Emotional Piano"
  ]
};