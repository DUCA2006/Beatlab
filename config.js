"use strict";
/*
 * BEATLAB AI — Application Configuration
 *
 * Keep private API keys on a secure backend.
 * Never put your Gemini API key in this file.
 */
window.BEATLAB_CONFIG = {
  appName: "BEATLAB AI",
  version: "1.0.0",
  audio: {
    maxRecordingMinutes: 10,
    defaultSampleRate: 44100,
    preferredFormat: "audio/webm"
  },
  storage: {
    projectsKey: "beatlab_projects_v1",
    settingsKey: "beatlab_settings_v1"
  },
  ai: {
    enabled: false,
    endpoint: ""
  }
};