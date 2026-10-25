"use strict";
(function () {
  let mediaRecorder = null;
  let microphoneStream = null;
  let audioChunks = [];
  let timerInterval = null;
  let recordingStartedAt = 0;
  let elapsedBeforePause = 0;
  let recordingState = "idle";
  let recordingBlob = null;
  let recordingUrl = null;
  const listeners = new Set();
  function emit(eventName, data = {}) {
    listeners.forEach(function (listener) {
      try {
        listener(eventName, data);
      } catch (error) {
        console.error("Recorder listener error:", error);
      }
    });
  }
  function getSupportedMimeType() {
    if (!window.MediaRecorder) {
      return "";
    }
    const formats = [
      "audio/webm;codecs=opus",
      "audio/mp4",
      "audio/webm",
      "audio/ogg;codecs=opus"
    ];
    for (const format of formats) {
      if (
        typeof MediaRecorder.isTypeSupported === "function" &&
        MediaRecorder.isTypeSupported(format)
      ) {
        return format;
      }
    }
    return "";
  }
  function getElapsedTime() {
    if (recordingState === "recording") {
      return elapsedBeforePause +
        (Date.now() - recordingStartedAt);
    }
    return elapsedBeforePause;
  }
  function startTimer() {
    stopTimer();
    timerInterval = setInterval(function () {
      emit("timeupdate", {
        milliseconds: getElapsedTime(),
        state: recordingState
      });
    }, 200);
  }
  function stopTimer() {
    if (timerInterval !== null) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
  async function startRecording() {
    if (recordingState === "recording") {
      throw new Error("A recording is already in progress.");
    }
    if (recordingState === "paused") {
      return resumeRecording();
    }
    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        "Microphone access is unavailable. Open the studio through HTTPS or a supported local preview."
      );
    }
    if (!window.MediaRecorder) {
      throw new Error(
        "Your browser does not support audio recording."
      );
    }
    emit("permissionrequest");
    try {
      microphoneStream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      const mimeType = getSupportedMimeType();
      mediaRecorder = mimeType
        ? new MediaRecorder(microphoneStream, { mimeType })
        : new MediaRecorder(microphoneStream);
      audioChunks = [];
      elapsedBeforePause = 0;
      recordingStartedAt = Date.now();
      recordingBlob = null;
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
        recordingUrl = null;
      }
      mediaRecorder.addEventListener("dataavailable", function (event) {
        if (event.data && event.data.size > 0) {
          audioChunks.push(event.data);
        }
      });
      mediaRecorder.addEventListener("error", function (event) {
        emit("error", {
          error: event.error ||
            new Error("An audio recording error occurred.")
        });
      });
      mediaRecorder.addEventListener("stop", function () {
        stopTimer();
        const actualMimeType =
          mediaRecorder.mimeType || mimeType || "audio/webm";
        recordingBlob = new Blob(audioChunks, {
          type: actualMimeType
        });
        recordingUrl = URL.createObjectURL(recordingBlob);
        if (microphoneStream) {
          microphoneStream.getTracks().forEach(function (track) {
            track.stop();
          });
          microphoneStream = null;
        }
        recordingState = "stopped";
        emit("recordingready", {
          blob: recordingBlob,
          url: recordingUrl,
          duration: elapsedBeforePause,
          mimeType: actualMimeType,
          size: recordingBlob.size
        });
        emit("statechange", {
          state: recordingState
        });
      });
      mediaRecorder.start(250);
      recordingState = "recording";
      startTimer();
      emit("statechange", {
        state: recordingState
      });
      return true;
    } catch (error) {
      if (microphoneStream) {
        microphoneStream.getTracks().forEach(function (track) {
          track.stop();
        });
        microphoneStream = null;
      }
      recordingState = "idle";
      emit("statechange", {
        state: recordingState
      });
      if (error.name === "NotAllowedError") {
        throw new Error(
          "Microphone permission was denied. Allow microphone access in your browser settings."
        );
      }
      if (error.name === "NotFoundError") {
        throw new Error("No microphone was found.");
      }
      throw error;
    }
  }
  function pauseRecording() {
    if (
      recordingState !== "recording" ||
      !mediaRecorder ||
      mediaRecorder.state !== "recording"
    ) {
      return false;
    }
    mediaRecorder.pause();
    elapsedBeforePause += Date.now() - recordingStartedAt;
    recordingState = "paused";
    stopTimer();
    emit("statechange", {
      state: recordingState
    });
    return true;
  }
  function resumeRecording() {
    if (
      recordingState !== "paused" ||
      !mediaRecorder ||
      mediaRecorder.state !== "paused"
    ) {
      return false;
    }
    mediaRecorder.resume();
    recordingStartedAt = Date.now();
    recordingState = "recording";
    startTimer();
    emit("statechange", {
      state: recordingState
    });
    return true;
  }
  function stopRecording() {
    if (
      !mediaRecorder ||
      mediaRecorder.state === "inactive"
    ) {
      return false;
    }
    elapsedBeforePause = getElapsedTime();
    stopTimer();
    recordingState = "processing";
    emit("statechange", {
      state: recordingState
    });
    mediaRecorder.stop();
    return true;
  }
  function getRecording() {
    if (!recordingBlob) {
      return null;
    }
    return {
      blob: recordingBlob,
      url: recordingUrl,
      duration: elapsedBeforePause,
      mimeType: recordingBlob.type,
      size: recordingBlob.size
    };
  }
  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Listener must be a function.");
    }
    listeners.add(listener);
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }
  function cleanup() {
    stopTimer();
    if (mediaRecorder &&
        mediaRecorder.state !== "inactive") {
      try {
        mediaRecorder.stop();
      } catch (error) {
        console.warn("Could not stop recorder:", error);
      }
    }
    if (microphoneStream) {
      microphoneStream.getTracks().forEach(function (track) {
        track.stop();
      });
      microphoneStream = null;
    }
  }
  window.BeatlabRecorder = {
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    getRecording,
    subscribe,
    cleanup,
    get state() {
      return recordingState;
    }
  };
})();