"use strict";
document.addEventListener("DOMContentLoaded", function () {
  const $ = (id) => document.getElementById(id);
  const recorder = window.BeatlabRecorder;
  const audioEngine = window.BeatlabAudio;
  const ai = window.BeatlabAI;
  const config = window.BEATLAB_CONFIG || {};
  const state = {
    recordingUrl: null,
    recordingBlob: null,
    importedUrl: null,
    importedBlob: null,
    importedName: "",
    importedTrackId: null,
    recorderTrackId: null,
    projects: [],
    toastTimer: null,
    isRecording: false,
    isPaused: false
  };
  const elements = {
    importButton: $("importButton"),
    recordButton: $("recordButton"),
    audioInput: $("audioInput"),
    recordingPanel: $("recordingPanel"),
    trackPanel: $("trackPanel"),
    recordMainButton: $("recordMainButton"),
    recordMainLabel: $("recordMainLabel"),
    stopRecordButton: $("stopRecordButton"),
    recordTimer: $("recordTimer"),
    recordStatus: $("recordStatus"),
    recordHint: $("recordHint"),
    waveform: $("waveform"),
    audioPlayer: $("audioPlayer"),
    playerControls: $("playerControls"),
    newTakeButton: $("newTakeButton"),
    importedPlayer: $("importedPlayer"),
    trackName: $("trackName"),
    trackDetails: $("trackDetails"),
    trackTitle: $("trackTitle"),
    playButton: $("playButton"),
    removeTrackButton: $("removeTrackButton"),
    analyzeButton: $("analyzeButton"),
    analysisResult: $("analysisResult"),
    analysisText: $("analysisText"),
    changeTrackButton: $("changeTrackButton"),
    emptyState: $("emptyState"),
    projectList: $("projectList"),
    projectCount: $("projectCount"),
    toast: $("toast")
  };
  function showToast(message) {
    clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    state.toastTimer = setTimeout(function () {
      elements.toast.classList.remove("visible");
    }, 3200);
  }
  function formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return String(minutes).padStart(2, "0") +
      ":" +
      String(remainder).padStart(2, "0");
  }
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + " KB";
    }
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }
  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "Unknown duration";
    }
    return formatTime(seconds * 1000);
  }
  function createWaveform() {
    elements.waveform.innerHTML = "";
    for (let i = 0; i < 57; i++) {
      const bar = document.createElement("span");
      bar.className = "wave-bar";
      bar.style.height =
        (8 + Math.random() * 48) + "px";
      bar.style.animationDelay =
        (Math.random() * 0.7) + "s";
      elements.waveform.appendChild(bar);
    }
  }
  function setRecordingUI(recording) {
    state.isRecording = recording;
    elements.recordMainButton.classList.toggle(
      "is-recording",
      recording
    );
    elements.recordMainLabel.textContent =
      recording ? "Recording..." : "Start recording";
    elements.stopRecordButton.disabled = !recording;
    elements.recordStatus.textContent =
      recording ? "RECORDING" : "READY";
    elements.recordHint.textContent = recording
      ? "You're recording. Find your flow."
      : "Put on your headphones and get ready.";
    elements.waveform.classList.toggle(
      "recording",
      recording
    );
  }
  function stopAllAudio() {
    try {
      elements.importedPlayer.pause();
      elements.audioPlayer.pause();
    } catch (error) {
      console.warn(error);
    }
  }
  async function startRecording() {
    if (!recorder) {
      showToast("Recording engine is unavailable.");
      return;
    }
    try {
      elements.recordingPanel.hidden = false;
      elements.trackPanel.hidden = true;
      createWaveform();
      await recorder.startRecording();
      setRecordingUI(true);
      elements.recordTimer.textContent = "00:00";
      showToast("Recording started. Let it flow! 🎙️");
    } catch (error) {
      setRecordingUI(false);
      showToast(error.message || "Could not start recording.");
    }
  }
  function finishRecording() {
    if (!recorder) return;
    if (!recorder.stopRecording()) {
      showToast("No active recording to stop.");
    }
  }
  function handleRecorderEvent(eventName, data) {
    if (eventName === "timeupdate") {
      elements.recordTimer.textContent =
        formatTime(data.milliseconds);
    }
    if (eventName === "statechange") {
      if (data.state === "recording") {
        setRecordingUI(true);
      }
      if (
        data.state === "processing" ||
        data.state === "stopped" ||
        data.state === "idle"
      ) {
        setRecordingUI(false);
      }
    }
    if (eventName === "recordingready") {
      state.recordingBlob = data.blob;
      if (state.recordingUrl) {
        URL.revokeObjectURL(state.recordingUrl);
      }
      state.recordingUrl = data.url;
      elements.audioPlayer.src = data.url;
      elements.audioPlayer.hidden = false;
      elements.playerControls.hidden = false;
      elements.recordHint.textContent =
        "Recording saved in this session. Play it back and listen.";
      elements.recordStatus.textContent = "TAKE READY";
      saveProject({
        name: "Recording " + new Date().toLocaleTimeString(),
        type: "recording",
        size: data.size,
        blob: data.blob,
        url: data.url,
        duration: data.duration / 1000
      });
      showToast("Your recording is ready! 🎧");
    }
    if (eventName === "error") {
      showToast(
        data.error?.message || "A recording error occurred."
      );
    }
  }
  if (recorder) {
    recorder.subscribe(handleRecorderEvent);
  }
  elements.importButton.addEventListener("click", function () {
    elements.audioInput.click();
  });
  elements.changeTrackButton.addEventListener("click", function () {
    elements.audioInput.click();
  });
  elements.audioInput.addEventListener("change", async function () {
    const file = elements.audioInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      showToast("Please choose an audio file.");
      elements.audioInput.value = "";
      return;
    }
    if (state.importedUrl) {
      URL.revokeObjectURL(state.importedUrl);
    }
    if (state.importedTrackId) {
      try {
        audioEngine.removeTrack(state.importedTrackId);
      } catch (error) {
        console.warn(error);
      }
    }
    state.importedBlob = file;
    state.importedName = file.name;
    state.importedUrl = URL.createObjectURL(file);
    elements.importedPlayer.src = state.importedUrl;
    elements.trackName.textContent = file.name;
    elements.trackDetails.textContent = formatBytes(file.size);
    elements.trackTitle.textContent = "Your track";
    elements.analysisResult.hidden = true;
    elements.trackPanel.hidden = false;
    elements.recordingPanel.hidden = true;
    try {
      state.importedTrackId = audioEngine.createTrack(
        file.name,
        { volume: 1 }
      );
      audioEngine.loadAudio(
        state.importedTrackId,
        file
      );
    } catch (error) {
      console.warn("Audio engine setup:", error);
    }
    saveProject({
      name: file.name,
      type: "import",
      size: file.size,
      blob: file,
      url: state.importedUrl,
      duration: 0
    });
    try {
      const duration = await new Promise(function (resolve) {
        const player = new Audio();
        player.preload = "metadata";
        player.src = state.importedUrl;
        player.onloadedmetadata = function () {
          resolve(player.duration);
          player.removeAttribute("src");
        };
        player.onerror = function () {
          resolve(0);
        };
      });
      elements.trackDetails.textContent =
        formatDuration(duration) + " · " + formatBytes(file.size);
    } catch (error) {
      console.warn(error);
    }
    elements.audioInput.value = "";
    showToast("Track imported successfully! 🎵");
    elements.trackPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
  elements.recordButton.addEventListener("click", function () {
    elements.recordingPanel.hidden = false;
    elements.recordingPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
  elements.recordMainButton.addEventListener("click", async function () {
    if (state.isRecording) {
      return;
    }
    await startRecording();
  });
  elements.stopRecordButton.addEventListener("click", finishRecording);
  elements.newTakeButton.addEventListener("click", function () {
    elements.audioPlayer.pause();
    elements.audioPlayer.removeAttribute("src");
    elements.audioPlayer.hidden = true;
    elements.playerControls.hidden = true;
    state.recordingBlob = null;
    elements.recordingPanel.hidden = false;
    startRecording();
  });
  elements.playButton.addEventListener("click", async function () {
    const player = elements.importedPlayer;
    if (!state.importedUrl) {
      showToast("Import a song first.");
      return;
    }
    try {
      if (player.paused) {
        stopAllAudio();
        await player.play();
        elements.playButton.textContent = "Ⅱ";
      } else {
        player.pause();
        elements.playButton.textContent = "▶";
      }
    } catch (error) {
      showToast("Could not play this audio file.");
    }
  });
  elements.importedPlayer.addEventListener("ended", function () {
    elements.playButton.textContent = "▶";
  });
  elements.importedPlayer.addEventListener("pause", function () {
    elements.playButton.textContent = "▶";
  });
  elements.importedPlayer.addEventListener("play", function () {
    elements.playButton.textContent = "Ⅱ";
  });
  elements.removeTrackButton.addEventListener("click", function () {
    if (state.importedTrackId) {
      try {
        audioEngine.removeTrack(state.importedTrackId);
      } catch (error) {
        console.warn(error);
      }
    }
    if (state.importedUrl) {
      URL.revokeObjectURL(state.importedUrl);
    }
    state.importedTrackId = null;
    state.importedUrl = null;
    state.importedBlob = null;
    state.importedName = "";
    elements.importedPlayer.pause();
    elements.importedPlayer.removeAttribute("src");
    elements.trackPanel.hidden = true;
    elements.analysisResult.hidden = true;
    showToast("Track removed.");
  });
  elements.analyzeButton.addEventListener("click", async function () {
    if (!state.importedBlob) {
      showToast("Import a song before analysing it.");
      return;
    }
    if (!ai || !config.ai?.endpoint) {
      showToast(
        "AI Producer needs a secure backend connection first."
      );
      return;
    }
    elements.analyzeButton.disabled = true;
    elements.analyzeButton.textContent = "Analysing your song...";
    try {
      const result = await ai.analyseSong(
        state.importedBlob,
        "Analyse the vocal style, mood, approximate tempo and suitable instrumental direction."
      );
      elements.analysisText.textContent = result.analysis;
      elements.analysisResult.hidden = false;
      showToast("Song analysis complete!");
    } catch (error) {
      showToast(error.message || "Song analysis failed.");
    } finally {
      elements.analyzeButton.disabled = false;
      elements.analyzeButton.textContent = "✦ Analyse my song";
    }
  });
  function saveProject(project) {
    const item = {
      id: Date.now() + Math.random(),
      name: project.name,
      type: project.type,
      size: project.size,
      blob: project.blob,
      url: project.url,
      duration: project.duration || 0,
      createdAt: new Date().toISOString()
    };
    state.projects.unshift(item);
    renderProjects();
    return item;
  }
  function renderProjects() {
    elements.projectList.innerHTML = "";
    elements.projectCount.textContent =
      state.projects.length + " PROJECT" +
      (state.projects.length === 1 ? "" : "S");
    elements.emptyState.hidden = state.projects.length > 0;
    state.projects.forEach(function (project) {
      const row = document.createElement("div");
      row.className = "project-item";
      const art = document.createElement("div");
      art.className = "track-art";
      art.textContent = project.type === "recording" ? "🎙" : "♫";
      const info = document.createElement("div");
      info.className = "track-info";
      const name = document.createElement("strong");
      name.textContent = project.name;
      const detail = document.createElement("span");
      detail.textContent =
        project.type === "recording"
          ? "Recorded just now"
          : formatBytes(project.size);
      info.append(name, detail);
      row.append(art, info);
      elements.projectList.appendChild(row);
    });
  }
  function scrollToSection(section) {
    const sections = {
      home: document.querySelector(".welcome"),
      studio: elements.recordingPanel,
      producer: elements.trackPanel,
      library: document.querySelector(".recent-section"),
      beats: null,
      effects: null
    };
   
    if (section === "effects") {
      showToast("Vocal Effects are coming in the next development phase.");
      return;
    }
    const target = sections[section];
    if (target) {
      if (section === "studio") {
        elements.recordingPanel.hidden = false;
      }
      if (section === "producer" && elements.trackPanel.hidden) {
        elements.trackPanel.hidden = false;
      }
      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
    document.querySelectorAll(".nav-item").forEach(function (button) {
      button.classList.toggle(
        "active",
        button.dataset.section === section
      );
    });
  }
  document.querySelectorAll("[data-section]").forEach(function (button) {
    button.addEventListener("click", function () {
      scrollToSection(button.dataset.section);
    });
  });
  elements.profileButton.addEventListener("click", function () {
    showToast("Profile and account settings will be added later.");
  });
  window.addEventListener("beforeunload", function () {
    if (recorder) {
      recorder.cleanup();
    }
  });
  renderProjects();
  console.log("BEATLAB AI Studio initialized.");
});