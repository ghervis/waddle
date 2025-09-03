// Duck Race Game with Skills System
class DuckRaceGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.logElement = document.getElementById("log");
    this.leaderboardElement = document.getElementById("leaderboard");
    this.raceTitleInput = document.getElementById("raceTitle");

    // Game settings
    this.raceDistance = 4000; // 15x longer
    this.maxRacers = 100; // Support up to 100 racers
    this.laneHeight = 70; // Back to original spacing for first 5 racers
    this.baseSpeed = 1.6; // 2x faster (was 0.8)
    this.cameraX = 0; // Camera position for side-scrolling
    this.viewportWidth = 800; // Canvas width

    // Background elements
    this.trees = [];
    this.bushes = [];

    // Duck data
    this.duckNames = [];
    this.duckColors = [];
    this.duckProfilePictures = [];

    // Game state
    this.ducks = [];
    this.raceActive = false;
    this.raceStartTime = 0;
    this.gameLoop = null;
    this.animationId = null;
    this.lastFrameTime = 0;
    this.skillTimer = null;
    this.gameLoopRunning = false; // Prevent double execution

    // Load custom racers from localStorage
    this.loadCustomRacers();

    // Load settings from localStorage
    this.loadSettings();

    // Initialize with default ducks if no custom racers exist
    this.initializeDefaultRacers();

    // Skills system
    this.skills = {
      boost: { name: "Boost", description: "+10% speed for 3s" },
      bomb: { name: "Bomb", description: "Stun leader for 2s" },
      leech: {
        name: "Splash 🌊",
        description: "-5% speed to all, +5% per affected to caster for 2s",
      },
      immune: { name: "Immune", description: "Immune to skills for 2s" },
      lightning: {
        name: "Lightning",
        description: "Stun others for 1s (last place only)",
      },
      magnet: {
        name: "Magnet",
        description:
          "Speed boost based on distance from leader (last place only)",
      },
    };

    this.updateRacersList();
    this.draw();
    this.generateBackgroundElements();
    this.setupEventListeners();
  }

  loadCustomRacers() {
    const saved = localStorage.getItem("duckRaceCustomRacers");
    this.customRacers = saved ? JSON.parse(saved) : [];

    // Clean up any duplicate names that might exist
    this.cleanupDuplicateNames();
  }

  loadSettings() {
    const saved = localStorage.getItem("duckRaceSettings");
    this.settings = saved
      ? JSON.parse(saved)
      : {
          discordWebhookUrl: "",
        };
  }

  saveSettings() {
    localStorage.setItem("duckRaceSettings", JSON.stringify(this.settings));
  }

  cleanupDuplicateNames() {
    const nameCount = {};

    this.customRacers.forEach((racer, index) => {
      const originalName = racer.name;
      let currentName = originalName;
      let counter = 1;

      // If this name already exists, append a number
      while (nameCount[currentName]) {
        currentName = `${originalName} (${counter})`;
        counter++;
      }

      nameCount[currentName] = true;
      this.customRacers[index].name = currentName;
    });

    // Save the cleaned up data
    if (Object.keys(nameCount).length !== this.customRacers.length) {
      this.saveCustomRacers();
    }
  }

  initializeDefaultRacers() {
    // If no custom racers exist, create default ones and save to localStorage
    if (this.customRacers.length === 0) {
      const defaultNames = ["Quacky", "Splash", "Waddle", "Feather", "Ripple"];
      defaultNames.forEach((name) => {
        this.addRacer(name, this.generateUniqueColor(), "");
      });
    }
  }

  saveCustomRacers() {
    localStorage.setItem(
      "duckRaceCustomRacers",
      JSON.stringify(this.customRacers)
    );
  }

  addRacer(name, color, profilePicture = "") {
    // Ensure unique name
    let uniqueName = name || `Duck ${this.customRacers.length + 1}`;
    let counter = 1;
    while (this.customRacers.some((racer) => racer.name === uniqueName)) {
      if (name) {
        uniqueName = `${name} (${counter})`;
      } else {
        uniqueName = `Duck ${this.customRacers.length + counter + 1}`;
      }
      counter++;
    }

    const newRacer = {
      id: Date.now() + Math.floor(Math.random() * 1000), // Integer ID
      name: uniqueName,
      color: color || `hsl(${Math.random() * 360}, 70%, 50%)`,
      profilePicture: profilePicture,
    };
    this.customRacers.push(newRacer);
    this.saveCustomRacers();
    this.updateRacersList();
  }

  removeRacer(id) {
    // Convert id to string for comparison
    const racerId = String(id);
    const racer = this.customRacers.find((r) => String(r.id) === racerId);
    if (racer && confirm(`Are you sure you want to delete ${racer.name}?`)) {
      this.customRacers = this.customRacers.filter(
        (racer) => String(racer.id) !== racerId
      );
      this.saveCustomRacers();
      this.updateRacersList();
    }
  }

  updateRacersList() {
    // Combine default and custom racers
    this.duckNames = [];
    this.duckColors = [];
    this.duckProfilePictures = [];

    // Add default racers first if no custom ones
    if (this.customRacers.length === 0) {
      this.duckNames = ["Quacky", "Splash", "Waddle", "Feather", "Ripple"];
      this.duckColors = ["#FFD700", "#FF6347", "#32CD32", "#1E90FF", "#DA70D6"];
      this.duckProfilePictures = [null, null, null, null, null];
    } else {
      // Use custom racers
      this.duckNames = this.customRacers.map((racer) => racer.name);
      this.duckColors = this.customRacers.map((racer) => racer.color);
      this.duckProfilePictures = this.customRacers.map(
        (racer) => racer.profilePicture || null
      );
    }

    this.updateLeaderboard();
    // Always show a preview of racers on the track
    this.initializeDucks();
    this.draw();
  }

  generateRandomColor() {
    // Generate a random color from the full RGB range
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `rgb(${r}, ${g}, ${b})`;
  }

  generateUniqueColor() {
    let newColor;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      newColor = this.generateRandomColor();
      attempts++;
    } while (this.duckColors.includes(newColor) && attempts < maxAttempts);

    return newColor;
  }

  generateBackgroundElements() {
    // Generate random trees and bushes on the top land patch only
    for (let i = 0; i < 50; i++) {
      this.trees.push({
        x: Math.random() * this.raceDistance * 1.5,
        y: Math.random() * 10 + 5, // Place on top land patch (15-40px height, well above water at 50px)
        size: Math.random() * 25 + 15, // Slightly smaller to fit better on land
        type: Math.random() > 0.5 ? "tree" : "bush",
        parallaxLayer: Math.random() > 0.5 ? 0.2 : 0.5, // Background (0.3) moves slower, foreground (0.7) moves faster
      });
    }
  }
  initializeDucks() {
    this.ducks = [];
    const racerCount = Math.min(this.duckNames.length, this.maxRacers);

    // Reserve 50px from bottom for progress bar
    const bottomMargin = 50;
    const usableHeight = this.canvas.height - 80 - bottomMargin; // From top water area to progress bar

    for (let i = 0; i < racerCount; i++) {
      // Calculate lane positioning - evenly distribute all racers across usable height
      const laneY =
        80 + (i * usableHeight) / racerCount + usableHeight / racerCount / 2;

      // Get profile picture directly from customRacers to ensure accuracy
      let profilePicture = null;
      if (this.customRacers.length > 0 && i < this.customRacers.length) {
        profilePicture = this.customRacers[i].profilePicture || null;
      } else {
        profilePicture = this.duckProfilePictures[i] || null;
      }

      this.ducks.push({
        id: i,
        name: this.duckNames[i] || `Duck ${i + 1}`,
        color: this.duckColors[i] || `hsl(${(i * 360) / racerCount}, 70%, 50%)`, // Generate colors if not enough
        profilePicture: profilePicture, // Use directly fetched profile picture
        x: 50, // Start position
        y: laneY, // Calculated lane positioning
        speed: this.baseSpeed, // Same speed for all ducks
        baseSpeed: this.baseSpeed, // Same base speed for all ducks
        finished: false,
        finishTime: 0,
        position: 1,

        // Status effects
        stunned: 0,
        boosted: 0,
        immune: 0,
        leechAffected: 0,
        magnetBoost: 0,
        magnetMultiplier: 1.0,
        splashBoost: 0,
        splashMultiplier: 1.0,

        // Skill display
        skillText: "",
        skillTextTimer: 0,
        nextSkillTime: Date.now() + Math.random() * 5000 + 5000, // Random 5-10 seconds

        // Visual effects
        effects: [],

        // Multipliers
        speedMultiplier: 1.0,
      });
    }
  }

  setupEventListeners() {
    document.getElementById("startBtn").addEventListener("click", () => {
      if (this.raceActive) {
        this.stopRace();
      } else {
        this.startRace();
      }
    });

    document.getElementById("addRacerBtn").addEventListener("click", () => {
      this.openAddRacerDialog();
    });

    // Race title management
    this.raceTitleInput.addEventListener("focus", () => {
      if (!this.raceActive) {
        this.raceTitleInput.select();
      }
    });

    // Add visibility change listeners to keep game running when tab is hidden
    document.addEventListener("visibilitychange", () => {
      if (this.raceActive && document.hidden) {
        // When tab becomes hidden, ensure game continues with setTimeout
        this.ensureGameContinues();
      } else if (!document.hidden) {
        // When tab becomes visible, stop backup loop and reset timing
        this.backupLoopRunning = false;
        this.lastFrameTime = performance.now();
      }
    });

    // Also listen for page focus/blur events as backup
    window.addEventListener("blur", () => {
      if (this.raceActive) {
        this.ensureGameContinues();
      }
    });
  }

  ensureGameContinues() {
    // Reset the frame timing to prevent jumps when tab becomes visible again
    this.lastFrameTime = performance.now();
    
    // Start backup loop if not already running
    if (!this.backupLoopRunning) {
      this.startBackupLoop();
    }
  }

  startBackupLoop() {
    this.backupLoopRunning = true;
    const backupGameLoop = () => {
      if (this.raceActive && document.hidden && this.backupLoopRunning) {
        if (!this.gameLoopRunning) {
          this.gameLoopRunning = true;
          
          const currentTime = performance.now();
          const deltaTime = currentTime - this.lastFrameTime;
          
          // Cap deltaTime to prevent timing issues
          const cappedDeltaTime = Math.min(deltaTime, 33.33);
          
          if (cappedDeltaTime >= 16.67) {
            this.update();
            this.draw();
            this.updateLeaderboard();
            this.lastFrameTime = currentTime;
          }
          
          this.gameLoopRunning = false;
        }
        setTimeout(backupGameLoop, 16.67);
      } else {
        this.backupLoopRunning = false;
      }
    };
    setTimeout(backupGameLoop, 16.67);
  }

  openAddRacerDialog() {
    // Remove any existing dialogs first
    const existingDialog = document.querySelector(".racer-dialog");
    if (existingDialog) {
      existingDialog.remove();
    }

    const dialog = document.createElement("div");
    dialog.className = "racer-dialog";
    const randomColor = this.generateUniqueColor();
    dialog.innerHTML = `
      <div class="dialog-content" style="background: linear-gradient(to left, ${randomColor}, rgba(255,255,255,0.9)); position: relative;">
        <button class="dialog-close-btn" onclick="this.closest('.racer-dialog').remove()">×</button>
        <h3>Add New Racer</h3>
        <input type="text" id="addDialogRacerName" placeholder="Duck name" maxlength="32" />
        
        <div class="file-upload-area" onclick="document.getElementById('addDialogImageFile').click()" ondrop="window.game.handleImageDrop(event, 'add')" ondragover="window.game.handleDragOver(event)" ondragleave="window.game.handleDragLeave(event)">
          <div>📷 Click or drag to upload profile picture</div>
          <div style="font-size: 10px; color: #666; margin-top: 5px;">Will be resized to 64x64 pixels</div>
          <div id="addDialogImagePreview"></div>
        </div>
        <input type="file" id="addDialogImageFile" accept="image/*" style="display: none;" onchange="window.game.handleImageUpload(event, 'add')" />
        
        <button id="addDialogRandomizeColor" onclick="window.game.randomizeAddDialogColor()" style="margin: 10px 0; padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">Randomize Color 🌈</button>
        <div class="dialog-buttons">
          <button onclick="this.closest('.racer-dialog').remove()">Cancel</button>
          <button onclick="window.game.addRacerFromDialog()">Add Duck</button>
        </div>
      </div>
    `;
    // Store the current color for the dialog
    dialog.currentColor = randomColor;
    dialog.uploadedImage = null; // Store the base64 image data
    document.body.appendChild(dialog);
    document.getElementById("addDialogRacerName").focus();
  }

  addRacerFromDialog() {
    const name = document.getElementById("addDialogRacerName").value;
    const dialog = document.querySelector(".racer-dialog");
    const color = dialog ? dialog.currentColor : this.generateUniqueColor();
    const imageData = dialog ? dialog.uploadedImage : null;

    if (name.trim()) {
      this.addRacer(name, color, imageData);
      document.querySelector(".racer-dialog").remove();
    }
  }

  handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add("dragover");
  }

  handleDragLeave(event) {
    event.currentTarget.classList.remove("dragover");
  }

  handleImageDrop(event, dialogType) {
    event.preventDefault();
    event.currentTarget.classList.remove("dragover");

    const files = event.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith("image/")) {
      this.processImageFile(files[0], dialogType);
    }
  }

  handleImageUpload(event, dialogType) {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      this.processImageFile(file, dialogType);
    }
  }

  processImageFile(file, dialogType) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to resize image to 64x64
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = 64;
        canvas.height = 64;

        // Draw resized image
        ctx.drawImage(img, 0, 0, 64, 64);

        // Convert to base64
        const base64Data = canvas.toDataURL("image/png");

        // Store in dialog and show preview
        const dialog = document.querySelector(".racer-dialog");
        if (dialog) {
          dialog.uploadedImage = base64Data;

          // Show preview
          const previewContainer = document.getElementById(
            dialogType === "add"
              ? "addDialogImagePreview"
              : "editDialogImagePreview"
          );
          if (previewContainer) {
            previewContainer.innerHTML = `<img src="${base64Data}" class="preview-image" alt="Preview" />`;
          }
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  randomizeAddDialogColor() {
    const dialog = document.querySelector(".racer-dialog");
    if (dialog) {
      const newColor = this.generateUniqueColor();
      dialog.currentColor = newColor;
      const dialogContent = dialog.querySelector(".dialog-content");
      dialogContent.style.background = `linear-gradient(to left, ${newColor}, rgba(255,255,255,0.9))`;
    }
  }

  openSettingsDialog() {
    // Remove any existing dialogs first
    const existingDialog = document.querySelector(".settings-dialog");
    if (existingDialog) {
      existingDialog.remove();
    }

    const dialog = document.createElement("div");
    dialog.className = "settings-dialog";
    dialog.innerHTML = `
      <div class="dialog-content" style=" min-width: 400px; position: relative;">
        <button class="dialog-close-btn" onclick="this.closest('.settings-dialog').remove()">×</button>
        <h3>⚙️ Settings</h3>
        <label for="discordWebhookUrl" style="display: block; margin-bottom: 5px; font-weight: bold;">Discord Webhook URL:</label>
        <input type="url" id="discordWebhookUrl" placeholder="https://discord.com/api/webhooks/..." value="${
          this.settings.discordWebhookUrl || ""
        }" style="width: 100%; margin-bottom: 15px;" onchange="window.game.autoSaveSettings()" />
        
        <div style="margin: 20px 0; padding: 15px; border: 2px solid #e74c3c; border-radius: 8px; background: rgba(231, 76, 60, 0.1);">
          <h4 style="margin: 0 0 10px 0; color: #e74c3c;">⚠️ Danger Zone</h4>
          <button id="resetDataBtn" class="reset-data-btn" onmousedown="window.game.startResetHold()" onmouseup="window.game.stopResetHold()" onmouseleave="window.game.stopResetHold()">
            <span id="resetBtnText">🗑️ Hold to Reset All Data (4s)</span>
            <div id="resetProgress" class="reset-progress"></div>
          </button>
        </div>
        
        <div class="dialog-buttons">
          <button onclick="this.closest('.settings-dialog').remove()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    document.getElementById("discordWebhookUrl").focus();
  }

  saveSettingsFromDialog() {
    const discordWebhookUrl =
      document.getElementById("discordWebhookUrl").value;

    this.settings.discordWebhookUrl = discordWebhookUrl;
    this.saveSettings();

    document.querySelector(".settings-dialog").remove();

    // Show confirmation
    this.log("⚙️ Settings saved successfully!", "skill");
  }

  autoSaveSettings() {
    const discordWebhookUrl =
      document.getElementById("discordWebhookUrl").value;

    this.settings.discordWebhookUrl = discordWebhookUrl;
    this.saveSettings();
  }

  startResetHold() {
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

    // Reset game state
    this.customRacers = [];
    this.duckNames = [];
    this.duckColors = [];
    this.duckProfilePictures = [];
    this.settings = {};

    // Close dialog
    const dialog = document.querySelector(".settings-dialog");
    if (dialog) {
      dialog.remove();
    }

    // Reinitialize
    this.initializeDefaultRacers();
    this.updateRacersList();
    this.draw();

    // Show confirmation
    this.log("🗑️ All data has been reset!", "skill");

    // Stop the timer
    this.stopResetHold();
  }

  editRacer(id) {
    // Convert id to string for comparison
    const racerId = String(id);
    const racer = this.customRacers.find((r) => String(r.id) === racerId);
    if (!racer) return;

    // Remove any existing dialogs first
    const existingDialog = document.querySelector(".racer-dialog");
    if (existingDialog) {
      existingDialog.remove();
    }

    const dialog = document.createElement("div");
    dialog.className = "racer-dialog";
    dialog.innerHTML = `
      <div class="dialog-content" style="background: linear-gradient(to left, ${
        racer.color
      }, rgba(255,255,255,0.9)); position: relative;">
        <button class="dialog-close-btn" onclick="this.closest('.racer-dialog').remove()">×</button>
        <h3>Edit Racer</h3>
        <input type="text" id="editDialogRacerName" placeholder="Duck name" maxlength="32" value="${
          racer.name
        }" />
        
        <div class="file-upload-area" onclick="document.getElementById('editDialogImageFile').click()" ondrop="window.game.handleImageDrop(event, 'edit')" ondragover="window.game.handleDragOver(event)" ondragleave="window.game.handleDragLeave(event)">
          <div>📷 Click or drag to upload profile picture</div>
          <div style="font-size: 10px; color: #666; margin-top: 5px;">Will be resized to 64x64 pixels</div>
          <div id="editDialogImagePreview">${
            racer.profilePicture
              ? `<img src="${racer.profilePicture}" class="preview-image" alt="Current" />`
              : ""
          }</div>
        </div>
        <input type="file" id="editDialogImageFile" accept="image/*" style="display: none;" onchange="window.game.handleImageUpload(event, 'edit')" />
        
        <button onclick="window.game.randomizeRacerColor('${id}')" style="margin: 10px 0; padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">Randomize Color 🌈</button>
        <div class="dialog-buttons">
          <button onclick="this.closest('.racer-dialog').remove()">Cancel</button>
          <button onclick="window.game.updateRacerFromDialog('${id}')">Update Duck</button>
        </div>
      </div>
    `;
    dialog.uploadedImage = racer.profilePicture; // Start with existing image
    document.body.appendChild(dialog);
    document.getElementById("editDialogRacerName").focus();
  }

  updateRacerFromDialog(id) {
    const name = document.getElementById("editDialogRacerName").value;
    const dialog = document.querySelector(".racer-dialog");
    const imageData = dialog ? dialog.uploadedImage : null;

    if (name.trim()) {
      // Convert id to string for comparison
      const racerId = String(id);
      const racerIndex = this.customRacers.findIndex(
        (r) => String(r.id) === racerId
      );
      if (racerIndex !== -1) {
        // Ensure unique name (exclude current racer from check)
        let uniqueName = name;
        let counter = 1;
        while (
          this.customRacers.some(
            (racer, index) => index !== racerIndex && racer.name === uniqueName
          )
        ) {
          uniqueName = `${name} (${counter})`;
          counter++;
        }

        this.customRacers[racerIndex].name = uniqueName;
        this.customRacers[racerIndex].profilePicture = imageData;
        this.saveCustomRacers();
        this.updateRacersList();

        // Update active duck's profile picture if race is running
        if (this.raceActive && this.ducks[racerIndex]) {
          this.ducks[racerIndex].name = uniqueName;
          this.ducks[racerIndex].profilePicture = imageData;
        }
      }
      document.querySelector(".racer-dialog").remove();
    }
  }

  randomizeRacerColor(id) {
    // Convert id to string for comparison
    const racerId = String(id);
    const racerIndex = this.customRacers.findIndex(
      (r) => String(r.id) === racerId
    );
    if (racerIndex !== -1) {
      // Generate a new unique color
      const newColor = this.generateUniqueColor();
      this.customRacers[racerIndex].color = newColor;

      // Update the dialog background
      const dialogContent = document.querySelector(
        ".racer-dialog .dialog-content"
      );
      if (dialogContent) {
        dialogContent.style.background = `linear-gradient(to left, ${newColor}, rgba(255,255,255,0.9))`;
      }

      // Save and update the display
      this.saveCustomRacers();
      this.updateRacersList();
    }
  }

  startRace() {
    if (this.raceActive) return;

    // Check if there are any racers
    if (this.duckNames.length === 0) {
      alert("Cannot start race! Please add at least one racer.");
      return;
    }

    this.raceActive = true;
    this.raceStartTime = Date.now();
    const startBtn = document.getElementById("startBtn");
    startBtn.innerHTML = "🛑 <span class='startBtn-text'>Stop</span>";
    startBtn.disabled = false;

    // Hide Add Racer button during race
    const addBtn = document.getElementById("addRacerBtn");
    addBtn.classList.add("hidden");

    // Disable race title editing during race
    this.raceTitleInput.disabled = true;

    // Ensure we have the latest racer data before initializing ducks
    this.updateRacersList();
    this.initializeDucks();
    this.clearLog();
    this.log("🏁 Race Started! Ducks are off!");

    // Play start sound
    this.playSound("start");

    // Start background music
    if (window.playBackgroundMusic) {
      window.playBackgroundMusic();
    }

    // Start game loop with requestAnimationFrame and setTimeout fallback
    this.lastFrameTime = performance.now();
    this.gameLoopRunning = false;
    this.backupLoopRunning = false;
    this.gameLoop = () => {
      if (this.gameLoopRunning) return; // Prevent double execution
      this.gameLoopRunning = true;

      const currentTime = performance.now();
      const deltaTime = currentTime - this.lastFrameTime;

      // Cap deltaTime to prevent large jumps when tab becomes visible again
      const cappedDeltaTime = Math.min(deltaTime, 33.33); // Cap at 2 frames (33.33ms)

      // Target 60 FPS (16.67ms per frame)
      if (cappedDeltaTime >= 16.67) {
        this.update();
        this.draw();
        this.updateLeaderboard();
        this.lastFrameTime = currentTime;
      }

      this.gameLoopRunning = false;

      if (this.raceActive) {
        // Use requestAnimationFrame as primary timing mechanism
        requestAnimationFrame(this.gameLoop);
        
        // Backup setTimeout for when tab is hidden (but prevent double execution)
        if (document.hidden && !this.backupLoopRunning) {
          this.startBackupLoop();
        }
      }
    };

    requestAnimationFrame(this.gameLoop);

    // No longer need global skill timer - each duck has individual timing
  }

  update() {
    if (!this.raceActive) return;

    const now = Date.now();
    let allFinished = true;

    // Update camera to follow the leader
    if (this.ducks && this.ducks.length > 0) {
      const leader = this.ducks.reduce((prev, curr) =>
        curr.x > prev.x ? curr : prev
      );
      this.cameraX = Math.max(0, leader.x - this.viewportWidth / 3);
    }

    this.ducks.forEach((duck) => {
      if (duck.finished) return;
      allFinished = false;

      // Update status effects
      this.updateStatusEffects(duck, now);

      // Move duck if not stunned
      if (duck.stunned < now) {
        duck.x += duck.speed * duck.speedMultiplier;

        // Check if finished
        if (duck.x >= this.raceDistance) {
          duck.x = this.raceDistance;
          duck.finished = true;
          duck.finishTime = now - this.raceStartTime;
          this.addEffect(duck, "🏆 FINISHED!", "#FFD700", 3000);
          this.log(
            `🏆 ${duck.name} finished in ${(duck.finishTime / 1000).toFixed(
              2
            )}s!`
          );
          // Play finish sound
          this.playSound("finish");
        }
      }

      // Check for skill usage with individual timers
      if (now >= duck.nextSkillTime && !duck.finished) {
        this.tryUseSkill(duck, now);
        // Set next skill time (5-10 seconds from now)
        duck.nextSkillTime = now + Math.random() * 5000 + 5000;
      }
    });

    // Update positions
    this.updatePositions();

    // Check if race is over
    if (allFinished) {
      this.endRace();
    }
  }

  updateStatusEffects(duck, now) {
    duck.speedMultiplier = 1.0;

    // Apply boost
    if (duck.boosted > now) {
      duck.speedMultiplier *= 1.1;
    }

    // Apply magnet boost
    if (duck.magnetBoost > now) {
      duck.speedMultiplier *= duck.magnetMultiplier;
    }

    // Apply splash boost
    if (duck.splashBoost > now) {
      duck.speedMultiplier *= duck.splashMultiplier;
    }

    // Apply leech effect
    if (duck.leechAffected > now) {
      duck.speedMultiplier *= 0.95;
    }

    // Update effects
    duck.effects = duck.effects.filter((effect) => effect.endTime > now);
  }

  addEffect(duck, text, color, duration) {
    const now = Date.now();
    duck.effects.push({
      text: text,
      color: color,
      startTime: now,
      endTime: now + duration,
      y: Math.random() * 30 - 15, // Random vertical offset
    });
  }

  updatePositions() {
    // Sort ducks by distance traveled
    const sortedDucks = [...this.ducks].sort((a, b) => b.x - a.x);
    sortedDucks.forEach((duck, index) => {
      duck.position = index + 1;
    });
  }

  useRandomSkills() {
    // This method is no longer used - skills are handled individually in update()
  }

  tryUseSkill(duck, now) {
    if (duck.finished || duck.stunned > now) return;

    // 70% chance to actually use a skill when the timer is up
    if (Math.random() > 0.7) return;

    const availableSkills = this.getAvailableSkills(duck);
    if (availableSkills.length === 0) return;

    // Check race progress for lightning boost
    const raceProgress = duck.x / this.raceDistance;
    let skill;

    if (availableSkills.includes("lightning") && raceProgress > 0.8) {
      // 60% chance to use lightning when race progress > 80%
      skill =
        Math.random() < 0.6
          ? "lightning"
          : availableSkills[Math.floor(Math.random() * availableSkills.length)];
    } else {
      skill =
        availableSkills[Math.floor(Math.random() * availableSkills.length)];
    }

    this.useSkill(duck, skill, now);
  }

  getAvailableSkills(duck) {
    const skills = ["boost", "bomb", "leech", "immune"];

    // Lightning and Magnet can only be used by last place
    if (
      duck.position === this.ducks.filter((d) => !d.finished).length &&
      duck.position === this.ducks.length
    ) {
      skills.push("lightning", "magnet");
    }

    return skills;
  }

  useSkill(duck, skillName, now) {
    if (duck.immune > now) return; // Duck is immune

    // Set skill text display
    duck.skillText = this.skills[skillName].name;
    duck.skillTextTimer = now + 2000;

    // Play skill sound effect
    this.playSound("skill");

    switch (skillName) {
      case "boost":
        const boostDuration = 1000 + Math.random() * 3000; // 1-4 seconds
        duck.boosted = now + boostDuration;
        this.addEffect(duck, "⏩ BOOST!", "#FFD700", 2000);
        this.log(`⏩ ${duck.name} #${duck.position} used Boost!`, "skill");
        break;

      case "bomb":
        if (this.ducks && this.ducks.length > 0) {
          const leader = this.ducks.reduce((prev, curr) =>
            curr.x > prev.x && !curr.finished ? curr : prev
          );
          if (leader && leader !== duck && leader.immune <= now) {
            const bombStunDuration = 1000 + Math.random() * 1000; // 1-2 seconds
            leader.stunned = now + bombStunDuration;
            this.addEffect(duck, "💣 BOMB!", "#FF4444", 1500);
            this.addEffect(leader, "💥 STUNNED!", "#FF0000", 2000);
            this.log(
              `💣 ${duck.name} #${duck.position} bombed ${leader.name} #${leader.position}!`,
              "skill"
            );
          }
        }
        break;

      case "leech":
        let affectedCount = 0;
        const splashDuration = 1000 + Math.random() * 1000; // 1-2 seconds
        this.ducks.forEach((target) => {
          if (target.immune <= now) {
            target.leechAffected = now + splashDuration;
            if (target !== duck) {
              affectedCount++;
              this.addEffect(target, "🌊 SPLASH", "#0088FF", splashDuration);
            }
          }
        });

        // Give caster bonus based on affected ducks (5% per affected duck)
        const splashBoostMultiplier = 1 + affectedCount * 0.05;
        duck.splashBoost = now + splashDuration;
        duck.splashMultiplier = splashBoostMultiplier;

        this.addEffect(duck, "🌊 WADDLE WADDLE!", "#0066CC", splashDuration);
        this.log(
          `🌊 ${duck.name} #${duck.position} used Splash! Affected ${
            affectedCount + 1
          } ducks, +${Math.round((splashBoostMultiplier - 1) * 100)}% speed`,
          "skill"
        );
        break;

      case "immune":
        const immuneDuration = 1000 + Math.random() * 2000; // 1-3 seconds
        duck.immune = now + immuneDuration;
        this.addEffect(duck, "🛡️ IMMUNE!", "#00FFFF", immuneDuration);
        this.log(`🛡️ ${duck.name} #${duck.position} used Immune!`, "skill");
        break;

      case "lightning":
        this.ducks.forEach((target) => {
          if (target !== duck && target.immune <= now && !target.finished) {
            target.stunned = now + 1000;
            this.addEffect(target, "⚡ ZAP!", "#FFFF00", 1000);
          }
        });
        this.addEffect(duck, "⚡ LIGHTNING!", "#FFD700", 1500);
        this.log(
          `⚡ ${duck.name} #${duck.position} used Lightning! All others stunned!`,
          "skill"
        );
        break;

      case "magnet":
        // Find the leader (duck with highest x position)
        const leader = this.ducks.reduce((prev, curr) =>
          curr.x > prev.x ? curr : prev
        );

        // Calculate distance difference between caster and leader
        const distanceDiff = leader.x - duck.x;

        // Calculate boost: 5% per 100 distance units, capped at 50%
        const boostPercent = Math.min(0.5, (distanceDiff / 100) * 0.05);
        const magnetDuration = 1000 + Math.random() * 2000; // 1-3 seconds

        // Apply magnet boost
        duck.magnetBoost = now + magnetDuration;
        duck.magnetMultiplier = 1 + boostPercent;

        this.addEffect(
          duck,
          `🧲 MAGNET ${Math.round(boostPercent * 100)}%!`,
          "#FF6B6B",
          magnetDuration
        );
        this.log(
          `🧲 ${duck.name} #${duck.position} used Magnet! ${Math.round(
            boostPercent * 100
          )}% speed boost!`,
          "skill"
        );
        break;
    }
  }

  draw() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw water background
    this.drawWater();

    // Draw finish line
    this.drawFinishLine();

    // Draw ducks
    this.drawDucks();

    // Draw UI
    this.drawUI();

    // Draw winner overlay if any duck has finished (show immediately when leader crosses finish line)
    if (
      this.ducks &&
      this.ducks.length > 0 &&
      this.ducks.some((d) => d.finished)
    ) {
      this.drawWinnerOverlay();
    }
  }

  /**
   * Draws a dark transparent overlay with the winner's profile/circle, name, and trophy.
   */
  drawWinnerOverlay() {
    // Find winner (lowest finishTime)
    const winner = this.ducks.reduce((prev, curr) =>
      curr.finished && (!prev.finished || curr.finishTime < prev.finishTime)
        ? curr
        : prev
    );
    if (!winner.finished) return;

    const ctx = this.ctx;
    const { width, height } = this.canvas;

    // Draw dark transparent overlay
    ctx.save();
    ctx.fillStyle = "rgba(20, 20, 30, 0.82)";
    ctx.fillRect(0, 0, width, height);

    // Center coordinates
    const centerX = width / 2;
    const centerY = height / 2;

    // Draw trophy emoji
    ctx.font = "64px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 8;
    ctx.fillText("🏆", centerX, centerY - 80);
    ctx.shadowBlur = 0;

    // Draw profile picture or colored circle
    const avatarY = centerY - 10;
    const avatarRadius = 48;
    if (winner.profilePicture && winner.profilePicture.trim() !== "") {
      this.drawProfilePicture(winner, centerX, avatarY, avatarRadius);
    } else {
      // Draw colored circle with initial
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, avatarY, avatarRadius, 0, 2 * Math.PI);
      ctx.fillStyle = winner.color || "#888";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.font = "bold 40px Arial";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(winner.name[0], centerX, avatarY);
      ctx.restore();
    }

    // Draw winner name
    ctx.font = "bold 36px Arial";
    ctx.fillStyle = winner.color || "#FFD700";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 6;
    ctx.fillText(winner.name, centerX, centerY + 50);
    ctx.shadowBlur = 0;

    // Draw subtext
    ctx.font = "20px Arial";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Winner!", centerX, centerY + 95);

    ctx.restore();
  }

  drawWater() {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, "#87CEEB");
    gradient.addColorStop(1, "#20B2AA");

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw land patches
    this.drawLandPatches();

    // Draw background trees and bushes (on land)
    this.drawBackgroundElements();

    // Draw vertical wavy lines moving right to left (more transparent, only in water area)
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.05)"; // Even more transparent
    this.ctx.lineWidth = 1;

    const topLandHeight = 50;
    const bottomLandHeight = 25;
    const waterStartY = topLandHeight;
    const waterEndY = this.canvas.height - bottomLandHeight;

    // Create right-to-left movement using time
    const timeOffset = Date.now() * 0.05; // Adjust speed by changing multiplier

    for (let i = 0; i < 20; i++) {
      const x =
        this.canvas.width +
        40 -
        ((i * 40 + timeOffset) % (this.canvas.width + 80)); // Right to left movement
      this.ctx.beginPath();
      this.ctx.moveTo(x, waterStartY);

      // Create wavy vertical line only in water area
      for (let y = waterStartY; y <= waterEndY; y += 10) {
        const waveX = x + Math.sin(y * 0.02) * 8;
        this.ctx.lineTo(waveX, y);
      }
      this.ctx.stroke();
    }
  }

  drawLandPatches() {
    // Top land patch (thicker)
    const topLandHeight = 50;
    this.ctx.fillStyle = "#9ACD32"; // Dark sea green
    this.ctx.fillRect(0, 0, this.canvas.width, topLandHeight);

    // Add soil layer beneath top land
    this.ctx.fillStyle = "#8B4513"; // Saddle brown (soil color)
    this.ctx.fillRect(0, topLandHeight - 8, this.canvas.width, 8);

    // Add grass texture to top land
    this.ctx.fillStyle = "#7aa328ff"; // Yellow green
    this.ctx.fillRect(0, topLandHeight - 15, this.canvas.width, 7);

    // Add some grass details
    this.ctx.fillStyle = "#4c9700ff"; // Lawn green
    for (let i = 0; i < this.canvas.width; i += 5) {
      if (Math.random() > 0.7) {
        this.ctx.fillRect(
          i,
          topLandHeight - 15 - Math.random() * 10 - 5,
          2,
          Math.random() * 8 + 3
        );
      }
    }
  }

  drawBackgroundElements() {
    this.trees.forEach((element) => {
      // Apply parallax scrolling - elements move at different speeds based on their layer
      // Lower parallaxLayer values = slower movement (farther away)
      // Higher parallaxLayer values = faster movement (closer)
      const screenX = element.x - this.cameraX * element.parallaxLayer;

      if (screenX > -100 && screenX < this.canvas.width + 100) {
        if (element.type === "tree") {
          this.drawTree(screenX, element.y - 20, element.size);
        } else {
          this.drawBush(screenX, element.y, element.size);
        }
      }
    });
  }

  drawTree(x, y, size) {
    // Tree trunk
    this.ctx.fillStyle = "#8B4513";
    this.ctx.fillRect(x - size / 8, y + size / 2, size / 4, size / 2);

    // Tree leaves
    this.ctx.fillStyle = "#228B22";
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, size / 2, size / 2, 0, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  drawBush(x, y, size) {
    this.ctx.fillStyle = "#43a326ff";
    this.ctx.beginPath();
    this.ctx.ellipse(x, y + size / 3, size / 2, size / 3, 0, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  darkenColor(color, factor) {
    // Simple color darkening function
    if (color.startsWith("#")) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgb(${Math.floor(r * (1 - factor))}, ${Math.floor(
        g * (1 - factor)
      )}, ${Math.floor(b * (1 - factor))})`;
    }
    return color; // Return original if not hex
  }

  drawFinishLine() {
    // Calculate finish line position relative to camera
    const finishX = this.raceDistance - this.cameraX;

    // Only draw if finish line is visible
    if (finishX > -50 && finishX < this.canvas.width + 50) {
      // Draw checkered pattern - make it wider and more visible
      const finishLineWidth = 20;
      const checkerSize = 15;

      // Draw the base line
      this.ctx.fillStyle = "#000";
      this.ctx.fillRect(finishX, 0, finishLineWidth, this.canvas.height);

      // Create checkered pattern
      for (let y = 0; y < this.canvas.height; y += checkerSize) {
        for (let x = 0; x < finishLineWidth; x += checkerSize) {
          // Alternate colors based on position
          const isBlack =
            (Math.floor(y / checkerSize) + Math.floor(x / checkerSize)) % 2 ===
            0;
          this.ctx.fillStyle = isBlack ? "#000" : "#fff";
          this.ctx.fillRect(
            finishX + x,
            y,
            Math.min(checkerSize, finishLineWidth - x),
            Math.min(checkerSize, this.canvas.height - y)
          );
        }
      }

      // Add border to make it more visible
      this.ctx.strokeStyle = "#333";
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(finishX, 0, finishLineWidth, this.canvas.height);

      // Finish text with better visibility
      this.ctx.fillStyle = "#fff";
      this.ctx.strokeStyle = "#000";
      this.ctx.lineWidth = 2;
      this.ctx.font = "bold 18px Arial";
      this.ctx.textAlign = "center";
      this.ctx.strokeText("FINISH", finishX + finishLineWidth / 2, 30);
      this.ctx.fillText("FINISH", finishX + finishLineWidth / 2, 30);
      this.ctx.textAlign = "left"; // Reset alignment
    }

    // Progress indicator (full width at bottom) - only show during race or after race completion
    const hasFinishedDucks =
      this.ducks && this.ducks.some((duck) => duck.finished);
    if (this.raceActive || hasFinishedDucks) {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      this.ctx.fillRect(0, this.canvas.height - 25, this.canvas.width, 25);

      // Show progress of leading duck based on actual race distance
      let progress = 0;
      let progressColor = "#333"; // Default color
      if (this.ducks && this.ducks.length > 0) {
        if (this.raceActive) {
          // During race: show current leader
          const leader = this.ducks.reduce((prev, curr) =>
            curr.x > prev.x ? curr : prev
          );
          progress = Math.min(leader.x / this.raceDistance, 1);
          progressColor = leader.color;
        } else {
          // After race: show winner (first place finisher)
          const winner = this.ducks.reduce((prev, curr) =>
            curr.finished &&
            (!prev.finished || curr.finishTime < prev.finishTime)
              ? curr
              : prev
          );
          progress = 1; // Show full progress
          progressColor = winner.color;
        }

        this.ctx.fillStyle = progressColor;
        this.ctx.fillRect(
          0,
          this.canvas.height - 25,
          this.canvas.width * progress,
          25
        );
      }

      // Progress text (centered)
      this.ctx.fillStyle = "#fff";
      this.ctx.font = "bold 16px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText(
        `Race Progress: ${(progress * 100).toFixed(1)}%`,
        this.canvas.width / 2,
        this.canvas.height - 6
      );
      this.ctx.textAlign = "left"; // Reset text alignment
    }
  }

  drawDucks() {
    // Sort ducks by position (last place drawn first, 1st place drawn last - so leader appears on top)
    const sortedDucks = [...this.ducks].sort((a, b) => b.position - a.position);
    sortedDucks.forEach((duck) => {
      // Only draw ducks that are visible in the camera view
      const screenX = duck.x - this.cameraX;
      if (screenX > -100 && screenX < this.canvas.width + 100) {
        this.drawDuck(duck);
      }
    });
  }

  drawDuck(duck) {
    const now = Date.now();

    // Calculate screen position (world position minus camera offset)
    const screenX = duck.x - this.cameraX;
    const screenY = duck.y;

    // Bigger duck proportions - body 70% bigger, head 80% bigger total (40% bigger again)
    const duckWidth = Math.round(28 * 1.4); // 47.6 -> 48 (70% bigger)
    const duckHeight = Math.round(20 * 1.7); // 34 (70% bigger)
    const headSize = Math.round(16 * 1.4 * 1.4); // 22 * 1.4 = 30.8 -> 31 (40% bigger again)

    // Draw status effects background
    if (duck.stunned > now) {
      this.ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
      this.ctx.fillRect(
        screenX - 20,
        screenY - 20,
        duckWidth * 1.8,
        duckHeight * 1.8
      );
    } else if (duck.boosted > now) {
      this.ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
      this.ctx.fillRect(
        screenX - 20,
        screenY - 20,
        duckWidth * 1.8,
        duckHeight * 1.8
      );
    } else if (duck.immune > now) {
      this.ctx.fillStyle = "rgba(0, 255, 255, 0.3)";
      this.ctx.fillRect(
        screenX - 20,
        screenY - 20,
        duckWidth * 1.8,
        duckHeight * 1.8
      );
    }

    // Draw black outline first (rubber duck style)
    this.ctx.strokeStyle = "#333";
    this.ctx.lineWidth = 3;

    // Draw tail feathers FIRST (behind the body) - moved to upper right of duck's body
    this.ctx.fillStyle = duck.color;
    this.ctx.strokeStyle = "#333";
    this.ctx.lineWidth = 2;

    // Third smaller tail feather - upper right position (rotated 30 degrees clockwise)
    this.ctx.save(); // Save context for tail rotation
    this.ctx.translate(screenX - 35, screenY - 10); // Move to tail center
    this.ctx.rotate(Math.PI / 6); // Rotate 30 degrees clockwise (π/6 radians)
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 6, 8, -0.4, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore(); // Restore context after tail rotation

    // Draw duck body with realistic teardrop/waterdrop shape
    this.ctx.save(); // Save context for rotation
    this.ctx.translate(screenX + 8, screenY - 8); // Move body closer to head (right 8px, up 8px)
    this.ctx.rotate(Math.PI / 6); // Rotate 30 degrees clockwise (π/6 radians)

    this.ctx.fillStyle = duck.color;
    this.ctx.strokeStyle = "#333";
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();

    // Create a teardrop shape using a path (coordinates adjusted for rotation center)
    // Start from the back (tail end) - rounder
    const moveDuckBodyDownwards = 20;
    this.ctx.moveTo(-duckWidth + 5, 0 + moveDuckBodyDownwards);

    // Top curve (back to front, getting more pointed)
    this.ctx.quadraticCurveTo(
      -duckWidth * 0.12,
      -duckHeight + moveDuckBodyDownwards, // Control point (top center)
      duckWidth - 4,
      -duckHeight / 3 + moveDuckBodyDownwards // End point (front top)
    );

    // Front point (more pointed like a teardrop)
    this.ctx.quadraticCurveTo(
      duckWidth + 2,
      0 + moveDuckBodyDownwards, // Control point (front tip)
      duckWidth - 8,
      duckHeight / 3 + moveDuckBodyDownwards // End point (front bottom)
    );

    // Bottom curve (front to back)
    this.ctx.quadraticCurveTo(
      -duckWidth / 2,
      duckHeight + moveDuckBodyDownwards, // Control point (bottom center)
      -duckWidth + 5,
      0 + moveDuckBodyDownwards // End point (back to start)
    );

    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore(); // Restore context after rotation

    // Draw duck head with black outline (positioned better for teardrop body)
    this.ctx.fillStyle = duck.color;
    this.ctx.beginPath();
    this.ctx.ellipse(
      screenX + 22, // Slightly closer to body front
      screenY - 6, // Slightly lower
      headSize,
      headSize,
      0,
      0,
      2 * Math.PI
    );
    this.ctx.fill();
    this.ctx.stroke();

    // Draw orange beak (rubber duck style)
    this.ctx.fillStyle = "#FF8C00";
    this.ctx.beginPath();
    this.ctx.ellipse(screenX + 35, screenY - 6, 10, 5, 0, 0, 2 * Math.PI); // Adjusted position and size
    this.ctx.fill();
    this.ctx.strokeStyle = "#333";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Draw black eye (adjusted for new head position)
    this.ctx.fillStyle = "#000";
    this.ctx.beginPath();
    this.ctx.ellipse(screenX + 25, screenY - 12, 3, 3, 0, 0, 2 * Math.PI); // Adjusted position and size
    this.ctx.fill();

    // White eye highlight
    this.ctx.fillStyle = "#fff";
    this.ctx.beginPath();
    this.ctx.ellipse(screenX + 26, screenY - 13, 1, 1, 0, 0, 2 * Math.PI); // Adjusted position and size
    this.ctx.fill();

    // Draw black eye (adjusted for new head position)
    this.ctx.fillStyle = "#000";
    this.ctx.beginPath();
    this.ctx.ellipse(screenX + 42, screenY - 12, 3, 3, 0, 0, 2 * Math.PI); // Adjusted position and size
    this.ctx.fill();

    // White eye highlight
    this.ctx.fillStyle = "#fff";
    this.ctx.beginPath();
    this.ctx.ellipse(screenX + 43, screenY - 13, 1, 1, 0, 0, 2 * Math.PI); // Adjusted position and size
    this.ctx.fill();

    // Draw wing detail (rubber duck style) - rotated to match body rotation (30 degrees clockwise + original wing angle)
    this.ctx.save(); // Save current transformation
    this.ctx.translate(screenX - 10, screenY + 4); // Move to wing center
    this.ctx.rotate(-Math.PI / 3.2); // Original wing rotation + 30 degrees clockwise body rotation
    this.ctx.scale(1, -1); // Flip vertically

    this.ctx.strokeStyle = "#333";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(0, -3, 12, 1.9, 4.5); // Wing arc at origin
    this.ctx.stroke();

    // Draw another wing line
    this.ctx.beginPath();
    this.ctx.arc(4, 5, 8, 2.1, 4); // Second wing line
    this.ctx.stroke();

    this.ctx.restore(); // Restore transformation

    // Draw profile picture if available - fitted inside the duck's head (adjusted for much larger head)
    if (duck.profilePicture && duck.profilePicture.trim() !== "") {
      this.drawProfilePicture(duck, screenX + 22, screenY - 6, headSize - 6); // Adjusted radius for bigger head (31-6=25)
    }

    // Draw name with white text and transparent black background at bottom of duck body
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    this.ctx.fillRect(screenX - 25, screenY + 20, 70, 18);
    this.ctx.fillStyle = "#fff";
    this.ctx.font = "bold 12px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText(duck.name, screenX + 10, screenY + 32);
    this.ctx.textAlign = "left"; // Reset alignment

    // Draw position (bigger) - moved to right of the name tag
    // Only show position when race is active (hide when race is finished)
    if (this.raceActive) {
      this.ctx.fillStyle = "#fff";
      this.ctx.font = "bold 12px Arial";
      this.ctx.fillText(`#${duck.position}`, screenX + 50, screenY + 32);
    }

    // Draw floating effects
    duck.effects.forEach((effect) => {
      const progress =
        (now - effect.startTime) / (effect.endTime - effect.startTime);
      const alpha = Math.max(0, 1 - progress);
      const yOffset = progress * 30; // Float upward more

      this.ctx.fillStyle = effect.color;
      this.ctx.globalAlpha = alpha;
      this.ctx.font = "bold 14px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText(
        effect.text,
        screenX + 10,
        screenY - 35 + effect.y - yOffset
      );
      this.ctx.globalAlpha = 1;
      this.ctx.textAlign = "left";
    });

    // Draw status effects text
    if (duck.stunned > now) {
      this.ctx.fillStyle = "#ff0000";
      this.ctx.font = "bold 10px Arial";
      this.ctx.fillText("STUNNED", screenX - 10, screenY - 30);
    } else if (duck.boosted > now) {
      this.ctx.fillStyle = "#ffff00";
      this.ctx.font = "bold 10px Arial";
      this.ctx.fillText("BOOST", screenX - 10, screenY - 30);
    } else if (duck.immune > now) {
      this.ctx.fillStyle = "#00ffff";
      this.ctx.font = "bold 10px Arial";
      this.ctx.fillText("IMMUNE", screenX - 10, screenY - 30);
    }
  }

  drawUI() {
    // Draw race timer (always show during race)
    if (this.raceActive) {
      const elapsedTime = (Date.now() - this.raceStartTime) / 1000;
      this.ctx.fillStyle = "#fff";
      this.ctx.font = "bold 20px Arial";
      this.ctx.fillText(`Time: ${elapsedTime.toFixed(1)}s`, 10, 30);
    }

    // Removed the leaderboard overlay - now it's in the left panel
  }

  stopRace() {
    this.raceActive = false;
    this.gameLoopRunning = false;

    // Stop background music
    if (window.stopBackgroundMusic) {
      window.stopBackgroundMusic();
    }

    // Reset race state but keep racers visible
    this.initializeDucks(); // Reinitialize ducks at starting positions
    this.cameraX = 0;

    // Update button text back to "Start Race"
    const startBtn = document.getElementById("startBtn");
    startBtn.innerHTML = "🏁 <span class='startBtn-text'>Start</span>";
    startBtn.disabled = false;

    // Show Add Racer button again
    const addBtn = document.getElementById("addRacerBtn");
    addBtn.classList.remove("hidden");

    // Re-enable race title editing
    this.raceTitleInput.disabled = false;

    // Clear the canvas
    this.draw();

    // Update leaderboard to show normal view
    this.updateLeaderboard();

    // Clear log
    this.clearLog();
    this.log("🛑 Race stopped and reset!");
  }

  endRace() {
    this.raceActive = false;
    // Animation will stop naturally when raceActive becomes false
    // No longer need to clear skillTimer as we use individual duck timers

    // Stop background music
    if (window.stopBackgroundMusic) {
      window.stopBackgroundMusic();
    }

    const startBtn = document.getElementById("startBtn");
    startBtn.innerHTML = "🏁 <span class='startBtn-text'>Start</span>";
    startBtn.disabled = false;

    // Show Add Racer button again
    const addBtn = document.getElementById("addRacerBtn");
    addBtn.classList.remove("hidden");

    // Re-enable race title editing
    this.raceTitleInput.disabled = false;

    // Update UI to show add button again
    this.updateLeaderboard();

    // Announce winner
    if (this.ducks && this.ducks.length > 0) {
      const winner = this.ducks.reduce((prev, curr) =>
        curr.finishTime < prev.finishTime ? curr : prev
      );

      this.log(`🎉 WINNER: ${winner.name}! 🎉`, "winner");
      this.log(
        `Final time: ${(winner.finishTime / 1000).toFixed(2)} seconds`,
        "winner"
      );
    }

    // Show final standings
    const standings = [...this.ducks].sort(
      (a, b) => a.finishTime - b.finishTime
    );
    this.log("📊 Final Standings:");
    standings.forEach((duck, index) => {
      this.log(
        `${index + 1}. ${duck.name} - ${(duck.finishTime / 1000).toFixed(2)}s`
      );
    });

    // Publish results to Discord webhook if configured
    this.publishToDiscord(standings);
  }

  async publishToDiscord(standings) {
    if (
      !this.settings.discordWebhookUrl ||
      this.settings.discordWebhookUrl.trim() === ""
    ) {
      return; // No webhook configured
    }

    try {
      const winner = standings[0];
      const raceTime = new Date().toLocaleString();
      const raceTitle = this.raceTitleInput
        ? this.raceTitleInput.value || "Duck Racing"
        : "Duck Racing";

      // Create standings text for description
      const standingsText = standings
        .slice(0, 15) // Show up to 15 racers
        .map((duck, index) => {
          const medal =
            index === 0
              ? "🥇"
              : index === 1
              ? "🥈"
              : index === 2
              ? "🥉"
              : `${index + 1}.`;
          return `${medal} **${duck.name}** - \`${(
            duck.finishTime / 1000
          ).toFixed(2)}s\``;
        })
        .join("\n");

      // Create embeds for the race results
      const embed = {
        title: `🦆 ${raceTitle} 🏁`,
        description: `**🏆 Winner: ${winner.name}** - \`${(
          winner.finishTime / 1000
        ).toFixed(2)}s\`\n\n**📊 Final Standings:**\n${standingsText}`,
        color: 0xffd700, // Gold color
        footer: {
          text: `Race completed at ${raceTime}`,
          icon_url:
            "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f986.png",
        },
        timestamp: new Date().toISOString(),
      };

      const payload = {
        embeds: [embed],
      };

      const response = await fetch(this.settings.discordWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        this.log("📤 Results published to Discord!", "skill");
      } else {
        this.log("❌ Failed to publish to Discord", "skill");
      }
    } catch (error) {
      console.error("Discord webhook error:", error);
      this.log("❌ Error publishing to Discord", "skill");
    }
  }

  log(message, type = "") {
    const logEntry = document.createElement("div");
    logEntry.className = `log-entry ${type ? "log-" + type : ""}`;
    logEntry.textContent = message;
    this.logElement.appendChild(logEntry);
    this.logElement.scrollTop = this.logElement.scrollHeight;
  }

  clearLog() {
    this.logElement.innerHTML = "";
  }

  updateLeaderboard() {
    // Update sidebar header with racer count
    const sidebarHeader = document.querySelector(".sidebar-header h2");
    if (sidebarHeader) {
      const racerCount = this.duckNames.length;
      sidebarHeader.textContent = `🦆 ${racerCount} Racers`;
    }

    // During race: show sorted by position
    // Before/after race: show all racers with management buttons
    this.leaderboardElement.innerHTML = "";

    if (this.raceActive) {
      // Sort ducks by position (distance traveled) during race
      const sortedDucks = [...this.ducks].sort((a, b) => {
        if (a.finished && b.finished) {
          return a.finishTime - b.finishTime; // Sort finished ducks by finish time
        } else if (a.finished) {
          return -1; // Finished ducks come first
        } else if (b.finished) {
          return 1;
        } else {
          return b.x - a.x; // Sort unfinished ducks by distance
        }
      });

      sortedDucks.forEach((duck, index) => {
        const entry = document.createElement("div");
        entry.className = "racer-config"; // Use same style as non-racing

        // Add gradient background style
        const gradientStyle = `background: linear-gradient(to left, ${duck.color}, transparent);`;
        entry.style.cssText = gradientStyle;

        const position = index + 1;
        const progress = duck.finished
          ? `${(duck.finishTime / 1000).toFixed(2)}s`
          : `${Math.round((duck.x / this.raceDistance) * 100)}%`;

        // Create racer circle content
        let racerCircleContent;
        if (duck.profilePicture && duck.profilePicture.trim() !== "") {
          racerCircleContent = `<div class="racer-circle profile-picture-circle" style="background-image: url('${duck.profilePicture}'); background-size: cover; background-position: center; border-radius: 50%;"></div>`;
        } else {
          const initial = duck.name.charAt(0).toUpperCase();
          racerCircleContent = `<div class="racer-circle" style="background-color: ${duck.color}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">${initial}</div>`;
        }

        entry.innerHTML = `
          <div class="duck-info">
            ${racerCircleContent}
            <div class="duck-name">${duck.name}</div>
          </div>
          <div class="racer-buttons">
            <span style="color: #fff; font-weight: bold; font-size: 14px;">#${position}</span>
          </div>
        `;

        this.leaderboardElement.appendChild(entry);
      });
    } else {
      // Show all racers with edit/delete buttons when not racing
      this.duckNames.forEach((name, index) => {
        const entry = document.createElement("div");
        entry.className = "racer-config";

        // Find the custom racer that matches this name and position
        let racerId = null;
        let profilePicture = null;
        if (this.customRacers.length > 0 && index < this.customRacers.length) {
          // Use direct index mapping since duckNames is built from customRacers in order
          const racer = this.customRacers[index];
          if (racer) {
            racerId = racer.id;
            profilePicture = racer.profilePicture;
          }
        }

        // Add gradient background style
        const racerColor = this.duckColors[index];
        const gradientStyle = `background: linear-gradient(to left, ${racerColor}, transparent);`;
        entry.style.cssText = gradientStyle;

        const editButton = racerId
          ? `<button onclick="window.game.editRacer('${racerId}')" class="edit-btn-small">✏️</button>`
          : "";
        const removeButton = racerId
          ? `<button onclick="window.game.removeRacer('${racerId}')" class="remove-btn-small">✖</button>`
          : "";

        // Create racer circle content
        let racerCircleContent;
        if (profilePicture && profilePicture.trim() !== "") {
          racerCircleContent = `<div class="racer-circle profile-picture-circle" style="background-image: url('${profilePicture}'); background-size: cover; background-position: center; border-radius: 50%;"></div>`;
        } else {
          const initial = name.charAt(0).toUpperCase();
          racerCircleContent = `<div class="racer-circle" style="background-color: ${racerColor}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">${initial}</div>`;
        }

        entry.innerHTML = `
          <div class="duck-info">
            ${racerCircleContent}
            <div class="duck-name">${name}</div>
          </div>
          <div class="racer-buttons">
            ${editButton}
            ${removeButton}
          </div>
        `;

        this.leaderboardElement.appendChild(entry);
      });

      // Don't add the Add Racer button during race - it will be handled separately
    }
  }

  drawProfilePicture(duck, x, y, radius) {
    // Create circular clipping path
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    this.ctx.clip();

    // Draw white background circle
    this.ctx.fillStyle = "#fff";
    this.ctx.fill();

    // Try to load and draw the actual image
    if (duck.profilePicture && duck.profilePicture.trim() !== "") {
      // Create a unique key using duck id and full profile picture hash
      const imageKey = `img_${duck.id}_${
        duck.profilePicture.length
      }_${duck.profilePicture.substring(duck.profilePicture.length - 20)}`; // Use duck id + length + last 20 chars for uniqueness

      // Check if image is already loaded
      if (!this.loadedImages) {
        this.loadedImages = {};
      }

      if (this.loadedImages[imageKey]) {
        // Image is loaded, draw it
        const img = this.loadedImages[imageKey];
        if (img.complete && img.naturalWidth > 0) {
          // Calculate scaling to fit in circle
          const scale = Math.min(
            (radius * 2) / img.naturalWidth,
            (radius * 2) / img.naturalHeight
          );
          const width = img.naturalWidth * scale;
          const height = img.naturalHeight * scale;

          this.ctx.drawImage(img, x - width / 2, y - height / 2, width, height);
        }
      } else {
        // Image not loaded yet, start loading
        const img = new Image();
        img.onload = () => {
          this.loadedImages[imageKey] = img;
          // Trigger a redraw when image loads to display it immediately
          this.draw();
        };
        img.onerror = () => {
          // Mark as failed so we don't keep trying
          this.loadedImages[imageKey] = null;
        };

        // Check if it's a base64 image or URL
        if (duck.profilePicture.startsWith("data:")) {
          // It's a base64 image, use directly
          img.src = duck.profilePicture;
        } else {
          // It's a URL, use CORS proxy
          img.crossOrigin = "anonymous";
          img.src = `https://corsproxy.io/?${encodeURIComponent(
            duck.profilePicture
          )}`;
        }

        // Show initials while loading
        this.ctx.fillStyle = "#333";
        this.ctx.font = "bold 12px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(duck.name[0], x, y + 4);
      }
    } else {
      // No image URL, show initials
      this.ctx.fillStyle = "#333";
      this.ctx.font = "bold 12px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText(duck.name[0], x, y + 4);
    }

    this.ctx.restore();

    // Draw border around the circle
    this.ctx.save();
    this.ctx.strokeStyle = "#333";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    this.ctx.stroke();
    this.ctx.restore();
  }

  playSound(type) {
    // Create simple sound effects using Web Audio API
    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      switch (type) {
        case "start":
          oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
          oscillator.frequency.setValueAtTime(
            880,
            audioContext.currentTime + 0.1
          );
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + 0.3
          );
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.3);
          break;
        case "skill":
          oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + 0.2
          );
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.2);
          break;
        case "finish":
          oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
          oscillator.frequency.setValueAtTime(
            659,
            audioContext.currentTime + 0.1
          );
          oscillator.frequency.setValueAtTime(
            784,
            audioContext.currentTime + 0.2
          );
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + 0.5
          );
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.5);
          break;
      }
    } catch (e) {
      console.log("Audio not supported");
    }
  }
}

// Initialize the game when page loads
document.addEventListener("DOMContentLoaded", () => {
  window.game = new DuckRaceGame();
});
