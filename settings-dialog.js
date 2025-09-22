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

  openSettingsDialog() {
    const dialog = document.getElementById("settingsDialog");
    if (!dialog) {
      console.error("Settings dialog element not found in DOM");
      return;
    }

    // Reset UI state
    const copyStatus = document.getElementById("copyStatus");
    if (copyStatus) {
      copyStatus.textContent = "";
      copyStatus.style.color = "#666";
    }
    const progressBar = document.getElementById("resetProgress");
    const btnText = document.getElementById("resetBtnText");
    if (progressBar) progressBar.style.width = "0%";
    if (btnText) btnText.textContent = "🗑️ Hold to Reset All Data (4s)";

    const input = document.getElementById("discordWebhookUrl");
    if (input) {
      input.value = this.settings.discordWebhookUrl || "";
      input.focus();
    }

    // Populate voice select
    this.populateVoices();

    // Set speech mute button state (now controlled by master mute)
    const speechMuteBtn = document.getElementById("speechMuteBtn");
    if (speechMuteBtn) {
      speechMuteBtn.textContent = this.masterMuted ? "🔇" : "🔊";
      speechMuteBtn.classList.toggle("muted", this.masterMuted);
      speechMuteBtn.onclick = () => {
        this.masterMuteToggle();
      };
    }

    // Voice select onchange
    const voiceSelect = document.getElementById("voiceSelect");
    if (voiceSelect) {
      voiceSelect.onchange = () => {
        this.settings.voiceIndex = parseInt(voiceSelect.value);
        this.saveSettings();
      };
    }

    // Voice volume slider
    const speechVolumeSlider = document.getElementById("speechVolumeSlider");
    if (speechVolumeSlider) {
      speechVolumeSlider.value = Math.round(
        (this.settings.speechVolume || 0.5) * 100
      );
      const speechVolumeValue = document.getElementById("speechVolumeValue");
      if (speechVolumeValue) {
        speechVolumeValue.textContent = speechVolumeSlider.value + "%";
      }
      speechVolumeSlider.oninput = () => {
        this.settings.speechVolume = parseFloat(speechVolumeSlider.value) / 100;
        if (speechVolumeValue) {
          speechVolumeValue.textContent = speechVolumeSlider.value + "%";
        }
        this.saveSettings();
      };
    }

    // Update music volume elements to reflect master state
    const musicVolumeSlider = document.getElementById("musicVolumeSlider");
    if (musicVolumeSlider) {
      musicVolumeSlider.value = this.masterMuted
        ? 0
        : Math.round(this.musicVolume * 100);
    }

    const musicMuteBtn = document.getElementById("musicMuteBtn");
    if (musicMuteBtn) {
      musicMuteBtn.textContent = this.masterMuted ? "🔇" : "🔊";
      musicMuteBtn.classList.toggle("muted", this.masterMuted);
      musicMuteBtn.onclick = () => {
        this.masterMuteToggle();
      };
    }

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.style.display = "block";
    }
  }

  saveSettingsFromDialog() {
    const discordWebhookUrl =
      document.getElementById("discordWebhookUrl").value;

    this.settings.discordWebhookUrl = discordWebhookUrl;
    this.saveSettings();

    const dialog = document.getElementById("settingsDialog");
    if (dialog && typeof dialog.close === "function") {
      dialog.close();
    } else if (dialog) {
      dialog.style.display = "none";
    }

    // Show confirmation
    this.game.log("⚙️ Settings saved successfully!", "skill");
  }

  autoSaveSettings() {
    const discordWebhookUrl =
      document.getElementById("discordWebhookUrl").value;

    this.settings.discordWebhookUrl = discordWebhookUrl;
    this.saveSettings();

    // Update tooltip for manage mode toggle if manage dialog is open
    if (
      document.getElementById("manageDialog") &&
      !document.getElementById("manageDialog").hidden
    ) {
      const label = document.querySelector('label[for="manageModeToggle"]');
      if (label) {
        const hasWebhook = discordWebhookUrl && discordWebhookUrl.trim() !== "";
        if (!hasWebhook) {
          label.title =
            "Discord webhook URL is not set. Please configure it in Settings.";
        } else {
          label.title = ""; // Clear title if webhook is set
        }
      }
    }
  }

  async copyProfileLink() {
    if (!window.okey) {
      const statusElement = document.getElementById("copyStatus");
      if (statusElement) {
        statusElement.textContent = "❌ Profile key not available";
        statusElement.style.color = "#e74c3c";
        setTimeout(() => {
          statusElement.textContent = "";
        }, 3000);
      }
      return;
    }

    const profileUrl = `https://ghervis.github.io/waddle/#${window.okey}`;

    try {
      await navigator.clipboard.writeText(profileUrl);
      const statusElement = document.getElementById("copyStatus");
      if (statusElement) {
        statusElement.textContent = "✅ Link copied to clipboard!";
        statusElement.style.color = "#4CAF50";
        setTimeout(() => {
          statusElement.textContent = "";
        }, 3000);
      }
    } catch (error) {
      console.error("Failed to copy link:", error);
      const statusElement = document.getElementById("copyStatus");
      if (statusElement) {
        statusElement.textContent = "❌ Failed to copy link";
        statusElement.style.color = "#e74c3c";
        setTimeout(() => {
          statusElement.textContent = "";
        }, 3000);
      }
    }
  }

  async copyInviteLink() {
    const inviteUrl =
      "https://discord.com/oauth2/authorize?client_id=1413746602979495936&scope=bot+applications.commands";

    try {
      await navigator.clipboard.writeText(inviteUrl);
      const statusElement = document.getElementById("inviteCopyStatus");
      if (statusElement) {
        statusElement.textContent = "✅ Invite link copied to clipboard!";
        statusElement.style.color = "#4CAF50";
        setTimeout(() => {
          statusElement.textContent = "";
        }, 3000);
      }
    } catch (error) {
      console.error("Failed to copy invite link:", error);
      const statusElement = document.getElementById("inviteCopyStatus");
      if (statusElement) {
        statusElement.textContent = "❌ Failed to copy invite link";
        statusElement.style.color = "#e74c3c";
        setTimeout(() => {
          statusElement.textContent = "";
        }, 3000);
      }
    }
  }

  startResetHold(event) {
    // Prevent default behavior for touch events to avoid conflicts
    if (event && event.type.startsWith("touch")) {
      event.preventDefault();
    }

    // Don't start if already running
    if (this.resetHoldInterval) {
      return;
    }

    this.resetHoldTimer = 0;
    this.resetHoldInterval = setInterval(() => {
      this.resetHoldTimer += 100;
      const progress = (this.resetHoldTimer / 4000) * 100;

      const progressBar = document.getElementById("resetProgress");
      const btnText = document.getElementById("resetBtnText");

      if (progressBar) {
        progressBar.style.width = progress + "%";
      }

      if (btnText) {
        const remaining = Math.ceil((4000 - this.resetHoldTimer) / 1000);
        btnText.textContent = `🗑️ Resetting in ${remaining}s...`;
      }

      if (this.resetHoldTimer >= 4000) {
        this.executeReset();
      }
    }, 100);
  }

  stopResetHold() {
    if (this.resetHoldInterval) {
      clearInterval(this.resetHoldInterval);
      this.resetHoldInterval = null;
    }

    const progressBar = document.getElementById("resetProgress");
    const btnText = document.getElementById("resetBtnText");

    if (progressBar) {
      progressBar.style.width = "0%";
    }

    if (btnText) {
      btnText.textContent = "🗑️ Hold to Reset All Data (4s)";
    }
  }

  executeReset() {
    // Clear all localStorage data
    localStorage.removeItem("duckRaceCustomRacers");
    localStorage.removeItem("duckRaceSettings");
    localStorage.removeItem("customRacerNames");
    localStorage.removeItem("customRacerProfilePictures");
    localStorage.removeItem("customRacerColors");

    // Reset game state
    this.game.customRacers = [];
    this.game.duckNames = [];
    this.game.duckColors = [];
    this.game.duckProfilePictures = [];
    this.settings = {};
    this.game.customRacerNames = this.game.loadCustomRacerNames();
    this.game.customRacerProfilePictures =
      this.game.loadCustomRacerProfilePictures();
    this.game.customRacerColors = this.game.loadCustomRacerColors();

    // Close dialog
    const dialog = document.getElementById("settingsDialog");
    if (dialog && typeof dialog.close === "function") {
      dialog.close();
    } else if (dialog) {
      dialog.style.display = "none";
    }

    // Reinitialize
    this.game.updateRacersList();
    this.game.draw();

    // Show confirmation
    this.game.log("🗑️ All data has been reset!", "skill");

    // Stop the timer
    this.stopResetHold();
  }

  // Sync volume state from global variables when game loads
  syncVolumeState() {
    const backgroundMusic = document.getElementById("backgroundMusic");
    const volumeBtn = document.getElementById("volumeBtn");

    if (backgroundMusic) {
      backgroundMusic.volume = this.musicVolume;
      backgroundMusic.muted = this.masterMuted;
    }

    if (volumeBtn) {
      volumeBtn.textContent = this.masterMuted ? "🔇" : "🔊";
      volumeBtn.classList.toggle("muted", this.masterMuted);
    }

    // Update settings dialog elements
    const musicVolumeSlider = document.getElementById("musicVolumeSlider");
    const musicMuteBtn = document.getElementById("musicMuteBtn");

    if (musicVolumeSlider) {
      musicVolumeSlider.value = this.masterMuted
        ? 0
        : Math.round(this.musicVolume * 100);
    }

    if (musicMuteBtn) {
      musicMuteBtn.textContent = this.masterMuted ? "🔇" : "🔊";
      musicMuteBtn.classList.toggle("muted", this.masterMuted);
    }

    // Update speech mute button in settings
    const speechMuteBtn = document.getElementById("speechMuteBtn");
    if (speechMuteBtn) {
      speechMuteBtn.textContent = this.masterMuted ? "🔇" : "🔊";
      speechMuteBtn.classList.toggle("muted", this.masterMuted);
    }

    this.saveMasterVolumeSettings();
  }

  // Master mute toggle - controls all audio
  masterMuteToggle() {
    this.masterMuted = !this.masterMuted;
    this.saveMasterVolumeSettings();

    // Update background music
    const backgroundMusic = document.getElementById("backgroundMusic");
    if (backgroundMusic) {
      backgroundMusic.muted = this.masterMuted;
    }

    // Update finish cheering
    const finishCheering = document.getElementById("finishCheering");
    if (finishCheering) {
      finishCheering.muted = this.masterMuted;
    }

    // Update speech settings to match master mute
    this.settings.speechMuted = this.masterMuted;

    // Update UI elements
    const volumeBtn = document.getElementById("volumeBtn");
    if (volumeBtn) {
      volumeBtn.textContent = this.masterMuted ? "🔇" : "🔊";
      volumeBtn.classList.toggle("muted", this.masterMuted);
    }

    const musicMuteBtn = document.getElementById("musicMuteBtn");
    if (musicMuteBtn) {
      musicMuteBtn.textContent = this.masterMuted ? "🔇" : "🔊";
      musicMuteBtn.classList.toggle("muted", this.masterMuted);
    }

    // Update speech mute button
    const speechMuteBtn = document.getElementById("speechMuteBtn");
    if (speechMuteBtn) {
      speechMuteBtn.textContent = this.masterMuted ? "🔇" : "🔊";
      speechMuteBtn.classList.toggle("muted", this.masterMuted);
    }

    // Update music volume slider display
    const musicVolumeSlider = document.getElementById("musicVolumeSlider");
    if (musicVolumeSlider) {
      musicVolumeSlider.value = this.masterMuted
        ? 0
        : Math.round(this.musicVolume * 100);
    }
  }

  // Handle music volume changes from slider
  onMusicVolumeChange(newVolume) {
    if (this.masterMuted && newVolume > 0) {
      // If muted and sliding to >0, unmute
      this.masterMuteToggle();
    }

    this.musicVolume = newVolume;
    const backgroundMusic = document.getElementById("backgroundMusic");
    if (backgroundMusic) {
      backgroundMusic.volume = newVolume;
    }
    this.saveMasterVolumeSettings();
  }

  saveMasterVolumeSettings() {
    localStorage.setItem("volumeMuted", this.masterMuted);
    localStorage.setItem("musicVolume", this.musicVolume);
  }

  populateVoices() {
    const select = document.getElementById("voiceSelect");
    if (!select) return;

    select.innerHTML = "";
    const voices = speechSynthesis
      .getVoices()
      .filter((voice) => voice.lang.startsWith("en-US"));
    voices.forEach((voice, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = voice.name + (voice.default ? " (default)" : "");
      select.appendChild(opt);
    });

    if (voices.length > 0) {
      select.value = this.settings.voiceIndex || 0;
    }
  }
}

// Initialize settings dialog when game is created
window.settingsDialog = null;
