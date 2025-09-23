// Settings Dialog Management
class SettingsDialog {
  constructor(game) {
    this.game = game;
    this.settings = {};
    this.masterMuted = false;
    this.musicVolume = 0.3;
    this.resetHoldTimer = 0;
    this.resetHoldInterval = null;
  }

  loadSettings() {
    const saved = localStorage.getItem("duckRaceSettings");
    this.settings = saved
      ? JSON.parse(saved)
      : {
          discordWebhookUrl: "",
          speechMuted: false,
          voiceIndex: 0,
          speechVolume: 0.5,
        };

    // Load master volume settings
    this.masterMuted = localStorage.getItem("volumeMuted") === "true";
    this.musicVolume = parseFloat(localStorage.getItem("musicVolume")) || 0.3;
  }

  saveSettings() {
    localStorage.setItem("duckRaceSettings", JSON.stringify(this.settings));
  }
}

// Initialize settings dialog when game is created
window.settingsDialog = null;
