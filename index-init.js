function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const btn = document.getElementById("collapseBtn");

  sidebar.classList.toggle("collapsed");
  btn.classList.toggle("collapsed");
  btn.textContent = sidebar.classList.contains("collapsed") ? "▶" : "◀";
}

// Volume control functionality
let isMuted = localStorage.getItem("volumeMuted") === "true";
const backgroundMusic = document.getElementById("backgroundMusic");
const volumeBtn = document.getElementById("volumeBtn");

function toggleVolume() {
  if (window.game && window.game.masterMuteToggle) {
    window.game.masterMuteToggle();
  } else {
    // Fallback for when game isn't loaded yet
    isMuted = !isMuted;
    localStorage.setItem("volumeMuted", isMuted);
    backgroundMusic.muted = isMuted;
    volumeBtn.textContent = isMuted ? "🔇" : "🔊";
    volumeBtn.classList.toggle("muted", isMuted);
  }
}

// Load music volume
let musicVolume = parseFloat(localStorage.getItem("musicVolume")) || 0.3;

// Initialize background music with saved state (volume will be handled by game)
backgroundMusic.volume = musicVolume;
backgroundMusic.muted = isMuted;
volumeBtn.textContent = isMuted ? "🔇" : "🔊";
volumeBtn.classList.toggle("muted", isMuted);

// Wait for game to load, then sync volume state
document.addEventListener("DOMContentLoaded", function () {
  if (window.game && window.game.syncVolumeState) {
    window.game.syncVolumeState();
  }
});

// Play music when race starts
window.playBackgroundMusic = function () {
  backgroundMusic.play().catch((error) => {
    console.log("Could not play background music:", error);
  });
};

// Stop music when race ends
window.stopBackgroundMusic = function () {
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
};

// Function to focus the race title input when pencil is clicked
function focusRaceTitle() {
  const raceTitle = document.getElementById("raceTitle");
  raceTitle.focus();
  raceTitle.select();
}

// Race mode toggle functionality
const raceModeToggle = document.getElementById("raceModeToggle");
const startBtn = document.getElementById("startBtn");

// Load saved race mode preference
const savedRaceMode = localStorage.getItem("raceMode") || "casual";
raceModeToggle.checked = savedRaceMode === "ranked";
updateStartButtonColor();

raceModeToggle.addEventListener("change", async function () {
  const raceMode = this.checked ? "ranked" : "casual";
  console.log("raceMode changed to:", raceMode);
  localStorage.setItem("raceMode", raceMode);

  if ("ranked" === raceMode) {
    await window.game.generateRankedRacerId();
    await window.game.fetchOnlineLeaderboard();
  }
  updateStartButtonColor();
  updateSectionVisibility();

  // Update manage button visibility
  const manageBtn = document.getElementById("manageBtn");
  if (manageBtn) {
    if (raceMode === "casual") {
      manageBtn.style.display = "block";
    } else {
      manageBtn.style.display = "none";
    }
  }

  // Update the racers display immediately when mode changes
  if (window.game) {
    window.game.stopRace();
    // Enable start button after mode change if we have racers
    if (window.game.ducks && window.game.ducks.length > 0) {
      window.game.toggleStartBtn(true);
    }
  }
});

// Handle section visibility and collapsing
function updateSectionVisibility() {
  const leaderboardSection = document.getElementById("leaderboardSection");

  if (raceModeToggle.checked) {
    // Ranked mode: show leaderboard
    leaderboardSection.style.display = "block";
    if (window.game) {
      window.game.updateOnlineLeaderboard();
    }
  } else {
    // Casual mode: hide leaderboard
    leaderboardSection.style.display = "none";
  }
}

// Add event listeners for section toggling
document.addEventListener("DOMContentLoaded", function () {
  const leaderboardSection = document.getElementById("leaderboardSection");
  const skillsSection = document.getElementById("skillsSection");
  const raceLogSection = document.getElementById("raceLogSection");

  const sections = [skillsSection, raceLogSection, leaderboardSection].filter(
    Boolean
  );

  sections.forEach((section) => {
    section.addEventListener("toggle", function () {
      if (this.open) {
        // Close all other sections when this one opens
        sections.forEach((otherSection) => {
          if (otherSection !== this) {
            otherSection.removeAttribute("open");
          }
        });
      }
    });
  });

  window.speechSynthesis.getVoices();

  // Music volume slider handler (delegate to game when loaded)
  const musicVolumeSlider = document.getElementById("musicVolumeSlider");
  if (musicVolumeSlider) {
    musicVolumeSlider.value = isMuted ? 0 : Math.round(musicVolume * 100);
    musicVolumeSlider.addEventListener("input", function (e) {
      if (window.game && window.game.onMusicVolumeChange) {
        window.game.onMusicVolumeChange(parseFloat(e.target.value) / 100);
      } else {
        // Fallback
        const newVolume = parseFloat(e.target.value) / 100;
        backgroundMusic.volume = newVolume;
        musicVolume = newVolume;
        localStorage.setItem("musicVolume", newVolume);
      }
    });
  }

  // Settings mute button init and sync (delegate to game when loaded)
  const musicMuteBtn = document.getElementById("musicMuteBtn");
  if (musicMuteBtn) {
    musicMuteBtn.textContent = isMuted ? "🔇" : "🔊";
    musicMuteBtn.classList.toggle("muted", isMuted);
    musicMuteBtn.addEventListener("click", function () {
      if (window.game && window.game.masterMuteToggle) {
        window.game.masterMuteToggle();
      } else {
        toggleVolume();
      }
    });
  }

  // Set initial manage button visibility based on race mode
  const manageBtn = document.getElementById("manageBtn");
  if (manageBtn) {
    if (raceModeToggle.checked) {
      manageBtn.style.display = "none";
    } else {
      manageBtn.style.display = "block";
    }
  }
});

// Initial section visibility update
updateSectionVisibility();

function updateStartButtonColor() {
  if (raceModeToggle.checked) {
    // Ranked mode - crimson color
    startBtn.style.background = "#DC143C";
    startBtn.style.borderColor = "#a0102a";
  } else {
    // Casual mode - green color
    startBtn.style.background = "#228B22";
    startBtn.style.borderColor = "#1a6b1a";
  }
} // Function to disable/enable race mode toggle based on race state
function updateRaceModeToggleState(raceActive) {
  raceModeToggle.disabled = raceActive;
}

// Make the function available globally for duck-race.js
window.updateRaceModeToggleState = updateRaceModeToggleState;
