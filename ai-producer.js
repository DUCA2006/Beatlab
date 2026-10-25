"use strict";
(function () {
  const config = window.BEATLAB_CONFIG || {};
  async function analyseSong(audioFile, instructions = "") {
    if (!(audioFile instanceof Blob)) {
      throw new Error("Please select or record a song first.");
    }
    if (!config.ai || !config.ai.endpoint) {
      throw new Error(
        "AI Producer is not connected yet. We need to configure the secure Gemini backend first."
      );
    }
    const formData = new FormData();
    formData.append("audio", audioFile, "recording.audio");
    formData.append("instructions", instructions);
    const response = await fetch(config.ai.endpoint, {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json"
      }
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("The AI service returned an invalid response.");
    }
    if (!response.ok) {
      throw new Error(
        result.error || "The AI Producer request failed."
      );
    }
    if (!result.analysis) {
      throw new Error(
        "The AI service did not return a song analysis."
      );
    }
    return result;
  }
  function buildProductionPrompt(style, instructions = "") {
    const styles = {
      afrobeat: "Afrobeat with syncopated percussion, melodic bass and lively rhythm",
      hiphop: "Hip-hop with punchy drums, a strong bass line and a complementary melody",
      rnb: "Smooth R&B with warm chords, gentle percussion and expressive musical layers",
      gospel: "Gospel-inspired music with uplifting chords, piano and expressive accompaniment",
      pop: "Modern pop with catchy melodies, polished percussion and a balanced arrangement",
      emotional: "Emotional music with expressive piano, atmospheric textures and gentle dynamics",
      amapiano: "Amapiano-inspired music with log-drum-style bass, spacious percussion and rhythmic grooves"
    };
    const selectedStyle =
      styles[String(style).toLowerCase()] ||
      "A musical arrangement that complements the original vocal performance";
    return [
      "Act as a music production assistant.",
      "Suggest an instrumental arrangement that complements the singer.",
      "Preserve the original vocal performance and intended emotion.",
      "Recommend a suitable tempo, musical mood, instruments and arrangement.",
      "Do not claim to have generated audio unless an audio-generation engine actually did so.",
      "Requested style: " + selectedStyle,
      "Additional instructions: " + (instructions || "None provided.")
    ].join("\n");
  }
  window.BeatlabAI = {
    analyseSong,
    buildProductionPrompt
  };
})();