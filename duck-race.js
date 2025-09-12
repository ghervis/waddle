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
    this.gameLoopRunning = false; // Prevent double execution

    this.randomRemarkTimeout = null;

    // Initialize duck names pool
    this.customRacerNames = this.loadCustomRacerNames();
    this.customRacerProfilePictures = this.loadCustomRacerProfilePictures();

    this.generateRankedRacerId();

    // Load custom racers from localStorage
    this.loadCustomRacers();

    // Load settings from localStorage
    this.loadSettings();

    this.onlineRaceData = null;

    // Skills system
    this.skills = {
      boost: { name: "Boost", description: "+10% speed for 3s", emoji: "🚀" },
      bomb: { name: "Bomb", description: "Stun leader for 2s", emoji: "💣" },
      splash: {
        name: "Splash 🌊",
        description: "-5% speed to all, +5% per affected to caster for 2s",
        emoji: "🌊",
      },
      immune: {
        name: "Immune",
        description: "Immune to skills for 2s",
        emoji: "🛡️",
      },
      lightning: {
        name: "Lightning",
        description: "Stun others for 1s (last place only)",
        emoji: "⚡",
      },
      magnet: {
        name: "Magnet",
        description:
          "Speed boost based on distance from leader (last place only)",
        emoji: "🧲",
      },
    };

    this.updateRacersList();
    this.draw();
    this.generateBackgroundElements();
    this.setupEventListeners();
  }

  // Use race simulator for more accurate race simulation - MANDATORY
  useRaceSimulator() {
    if (!window.simulateRace) {
      console.error(
        "❌ Race simulator not loaded! Cannot start race without simulator."
      );
      alert(
        "Race simulator is required but not loaded. Please refresh the page."
      );
      return false;
    }

    console.log("🦆 Race simulator loaded successfully!", window.simulateRace);

    let participants;
    let raceMode;

    if (this.isRankedMode()) {
      // Ranked mode: Check if we already have ducks from online race data
      if (this.ducks && this.ducks.length > 0) {
        // Use the ducks we already have from the online race response
        participants = this.ducks.map((duck) => ({
          id: duck.id,
          name: duck.name,
          profile: duck.profilePicture,
          color: duck.color,
        }));
        console.log("🏆 Using ducks from online ranked race:", participants);
      } else {
        // Fallback to single ranked racer (shouldn't happen in normal flow)
        if (!window.rankedRacerId || !window.rankedRacerName) {
          console.error("❌ Ranked racer data not available!");
          alert("Ranked racer data is not loaded. Please refresh the page.");
          return false;
        }

        participants = [
          {
            id: window.rankedRacerId,
            name: window.rankedRacerName,
            profile: window.rankedRacerProfilePicture || null,
            color: window.rankedRacerColor || "#FFD700", // Default gold color for ranked racer
          },
        ];
        console.log("🏆 Using fallback single ranked racer:", participants[0]);
      }
      raceMode = "ranked";
    } else {
      // Casual mode: Convert current ducks to participants format for race simulator
      participants = this.ducks.map((duck) => ({
        id: duck.id,
        name: duck.name,
        profile: duck.profilePicture,
        color: duck.color,
      }));
      raceMode = "casual";

      console.log(
        "🏁 Starting CASUAL simulation with participants:",
        participants
      );
    }

    // Get race title
    const title = this.raceTitleInput.value.trim() || "Duck Race";

    // Run the simulation
    try {
      const simulationResult = window.simulateRace({
        participants,
        mode: raceMode,
      });

      if (simulationResult) {
        console.log("✅ Simulation completed successfully:", simulationResult);
        // Apply simulation results to visual ducks
        this.applySimulationResults(simulationResult);
        return true;
      } else {
        console.error("❌ Simulation failed:", simulationResult.error);
        alert("Race simulation failed: " + simulationResult.error);
        return false;
      }
    } catch (error) {
      console.error("❌ Race simulation error:", error);
      alert("Race simulation error: " + error.message);
      return false;
    }

    return false;
  }

  // Apply simulation results to the visual race
  applySimulationResults(raceData) {
    // Store the PRE-CALCULATED simulation data from race-simulator.js
    this.simulationDuration = raceData.duration;
    this.simulationStandings = [...raceData.standings];
    this.simulationEvents = raceData.events; // Skill events and race events
    this.simulationProgress = raceData.secondlyProgress; // Position data every 500ms
    this.simulationConfig = raceData.config;

    // Initialize smooth movement tracking
    this.lastSimulationTimeStep = -1; // Track when simulation data changes

    console.log("🔍 Using simulation results:", {
      duration: this.simulationDuration,
      events: this.simulationEvents.length,
      progressPoints: this.simulationProgress.length,
      standings: this.simulationStandings.map((s) => ({
        name: s.name,
        finishTime: s.finishTime,
        finished: s.finished,
      })),
    });

    // Reset visual ducks to starting positions
    this.ducks.forEach((duck, index) => {
      duck.x = 50;
      duck.finished = false;
      duck.finishTime = 0;
      duck.position = index + 1;

      // Reset status effects
      duck.stunned = 0;
      duck.boosted = 0;
      duck.immune = 0;
      duck.leechAffected = 0;
      duck.magnetBoost = 0;
      duck.splashBoost = 0;
      duck.speedMultiplier = 1.0;
      duck.effects = [];
    });

    // Mark that we're using simulation mode
    this.usingSimulation = true;
    this.simulationStartTime = Date.now();
    this.currentEventIndex = 0; // Track which events we've processed
    this.currentProgressIndex = 0; // Track progress data

    console.log(
      `🏁 Simulation ready: ${this.simulationEvents.length} events, ${this.simulationProgress.length} progress points`
    );
  }

  // Update duck positions based on PRE-CALCULATED simulation data
  updateFromSimulation() {
    if (!this.usingSimulation || !this.simulationProgress) return;

    const now = Date.now();
    const raceTimeMs = now - this.simulationStartTime; // Time in milliseconds

    // Process skill events that should have occurred by now
    while (
      this.currentEventIndex < this.simulationEvents.length &&
      this.simulationEvents[this.currentEventIndex].t <= raceTimeMs // Compressed: event.time -> event.t
    ) {
      const event = this.simulationEvents[this.currentEventIndex];
      this.replaySimulationEvent(event);
      this.currentEventIndex++;
    }

    // Get current positions from progress data (500ms intervals)
    const currentTimeStep = Math.floor(raceTimeMs / 500) * 500; // Round to nearest 500ms
    const nextTimeStep = currentTimeStep + 500;
    const progress = (raceTimeMs - currentTimeStep) / 500; // Fraction between time steps (0-1)

    // Check if we have new simulation data (only update targets when data changes)
    const hasNewData = this.lastSimulationTimeStep !== currentTimeStep;
    if (hasNewData) {
      this.lastSimulationTimeStep = currentTimeStep;
    }

    // Find the progress data for current and next time step
    const currentData = this.simulationProgress.find(
      (p) => p.t === currentTimeStep
    );
    const nextData = this.simulationProgress.find((p) => p.t === nextTimeStep);

    if (currentData) {
      // Update duck positions with smooth interpolation and auto-correction
      this.ducks.forEach((duck) => {
        // Handle ongoing smooth animations (like finishing) even if duck is marked as finished
        if (duck.smoothTarget) {
          this.smoothMoveToPosition(duck, duck.smoothTarget.x);
          return; // Continue animation, don't override with simulation data
        }

        if (duck.finished) return;

        // Find this duck's data in current time step using ID
        const currentDuckData = currentData.p.find((p) => p.i === duck.id);
        if (!currentDuckData) return;

        // Check if duck finished this time step (metersTraveled >= 4000)
        if (currentDuckData.mt >= 4000) {
          duck.finished = true;
          duck.finishTime = raceTimeMs; // Keep finishTime in milliseconds
          // Smooth animation to finish line instead of immediate warp
          this.smoothMoveToPosition(duck, this.convertMetersToPixels(4000));
          this.log(`🏁 ${duck.name} finished!`, "", true);
          return;
        }

        let targetMeters = currentDuckData.mt;

        // Simple linear interpolation between current and next data point
        if (nextData && progress > 0) {
          const nextDuckData = nextData.p.find((p) => p.i === duck.id);
          if (nextDuckData && nextDuckData.mt < 4000) {
            targetMeters =
              currentDuckData.mt +
              (nextDuckData.mt - currentDuckData.mt) * progress;
          }
        }

        // Convert to pixels and apply directly
        duck.x = this.convertMetersToPixels(targetMeters);

        // Calculate current effects from events for this duck at current time
        const currentEffects = this.calculateEffectsFromEvents(
          duck,
          raceTimeMs
        );

        // Update status effects for visual display with duration information
        duck.statusEffects = [];
        duck.effectDurations = {}; // Store remaining durations for visual effects

        if (currentEffects.stunned) {
          duck.statusEffects.push("stunned");
          duck.effectDurations.stunned = currentEffects.stunnedRemaining;
        }
        if (currentEffects.boosted) {
          duck.statusEffects.push("boosted");
          duck.effectDurations.boosted = currentEffects.boostedRemaining;
        }
        if (currentEffects.immune) {
          duck.statusEffects.push("immune");
          duck.effectDurations.immune = currentEffects.immuneRemaining;
        }
        if (currentEffects.splashAffected) {
          duck.statusEffects.push("splash");
          duck.effectDurations.splash = currentEffects.splashRemaining;
        }
        if (currentEffects.magnetBoosted) {
          duck.statusEffects.push("magnet");
          duck.effectDurations.magnet = currentEffects.magnetRemaining;
        }
      });
    }

    // Update camera to follow the leader and check for lead changes
    if (
      this.ducks &&
      this.ducks.length > 0 &&
      this.raceActive &&
      this.usingSimulation
    ) {
      // Get current race time for simulation data lookup
      const now = Date.now();
      const raceTimeMs = now - this.simulationStartTime;
      const currentTimeStep = Math.floor(raceTimeMs / 500) * 500;

      // Find simulation data for current time
      const currentData = this.simulationProgress.find(
        (p) => p.t === currentTimeStep
      );

      if (currentData && currentData.p && currentData.p.length > 0) {
        // Sort by actual meters traveled (mt) from simulation
        const sortedByProgress = [...currentData.p].sort((a, b) => b.mt - a.mt);
        const currentLeaderData = sortedByProgress[0];
        const currentLeader = this.getDuckById(currentLeaderData.i);

        // Check for lead changes based on actual progress
        if (
          this.previousLeaderId !== currentLeaderData.i &&
          currentLeader &&
          currentLeaderData.mt > 50 &&
          !this.ducks.some((d) => d.finished)
        ) {
          this.log(`1️⃣ ${currentLeader.name} takes the lead!`, "leader");
          this.takesTheLead(currentLeader.name);
          this.previousLeaderId = currentLeaderData.i;
        }

        // Use visual leader for camera
        const visualLeader = this.ducks.reduce((prev, curr) =>
          curr.x > prev.x ? curr : prev
        );
        this.cameraX = Math.max(0, visualLeader.x - this.viewportWidth / 3);
      } else {
        // Fallback to visual leader for camera only
        const leader = this.ducks.reduce((prev, curr) =>
          curr.x > prev.x ? curr : prev
        );
        this.cameraX = Math.max(0, leader.x - this.viewportWidth / 3);
      }
    } else if (this.ducks && this.ducks.length > 0) {
      // Fallback when not using simulation
      const leader = this.ducks.reduce((prev, curr) =>
        curr.x > prev.x ? curr : prev
      );
      this.cameraX = Math.max(0, leader.x - this.viewportWidth / 3);
    }

    // Update positions based on current x values
    const sortedDucks = [...this.ducks].sort((a, b) => b.x - a.x);
    sortedDucks.forEach((duck, index) => {
      duck.position = index + 1;
    });

    // Check if race is complete (both times now in milliseconds)
    if (raceTimeMs >= this.simulationDuration) {
      console.log("🏁 Simulation completed - ending race");
      this.endRace();
      this.updateLeaderboard();
    }
  }

  // Helper function to get duck by ID
  getDuckById(duckId) {
    return this.ducks.find((duck) => duck.id === duckId);
  }

  // Calculate current effects for a duck based on events
  calculateEffectsFromEvents(duck, currentTime) {
    const effects = {
      stunned: false,
      boosted: false,
      immune: false,
      splashAffected: false,
      magnetBoosted: false,
      // Add duration information for smoother animations
      stunnedRemaining: 0,
      boostedRemaining: 0,
      immuneRemaining: 0,
      splashRemaining: 0,
      magnetRemaining: 0,
    };

    if (!this.simulationEvents) return effects;

    // Check all events that could affect this duck
    this.simulationEvents.forEach((event) => {
      if (event.s && event.t <= currentTime) {
        // Check for skill events (compressed: event.skill -> event.s, event.time -> event.t)
        const timeElapsed = currentTime - event.t;
        const remainingTime = Math.max(
          0,
          (event.d || event.sd || 0) - timeElapsed
        );

        switch (
          event.s // Compressed: event.skill -> event.s
        ) {
          case "boost":
            if (event.id === duck.id && timeElapsed < event.d) {
              // Compressed: event.duck -> event.id, event.duration -> event.d
              effects.boosted = true;
              effects.boostedRemaining = Math.max(
                effects.boostedRemaining,
                remainingTime
              );
            }
            break;

          case "immune":
            if (event.id === duck.id && timeElapsed < event.d) {
              // Compressed field names
              effects.immune = true;
              effects.immuneRemaining = Math.max(
                effects.immuneRemaining,
                remainingTime
              );
            }
            break;

          case "bomb":
            if (event.ta === duck.name && timeElapsed < event.sd) {
              // Compressed: event.target -> event.ta, event.stunDuration -> event.sd
              effects.stunned = true;
              const stunRemaining = Math.max(0, event.sd - timeElapsed);
              effects.stunnedRemaining = Math.max(
                effects.stunnedRemaining,
                stunRemaining
              );
            }
            break;

          case "splash":
            // Check if this duck was in range during splash - affects ducks other than the caster
            const splashCaster = this.getDuckById(event.id);
            if (
              splashCaster &&
              splashCaster.name !== duck.name &&
              timeElapsed < event.d
            ) {
              effects.splashAffected = true;
              effects.splashRemaining = Math.max(
                effects.splashRemaining,
                remainingTime
              );
            }
            break;

          case "lightning":
            // Lightning affects all ducks except the caster
            const lightningCaster = this.getDuckById(event.id);
            if (
              lightningCaster &&
              lightningCaster.name !== duck.name &&
              timeElapsed < event.sd
            ) {
              effects.stunned = true;
              const lightningStunRemaining = Math.max(
                0,
                event.sd - timeElapsed
              );
              effects.stunnedRemaining = Math.max(
                effects.stunnedRemaining,
                lightningStunRemaining
              );
            }
            break;

          case "magnet":
            if (event.targetDuck === duck.name && timeElapsed < event.d) {
              // Compressed field names
              effects.magnetBoosted = true;
              effects.magnetRemaining = Math.max(
                effects.magnetRemaining,
                remainingTime
              );
            }
            break;
        }
      }
    });

    return effects;
  }

  // Calculate average speed during a time interval, considering effect start/end times
  calculateAverageSpeedDuringInterval(duck, startTime, endTime, baseSpeed) {
    const intervalDuration = endTime - startTime;
    if (intervalDuration <= 0) return baseSpeed;

    // Find all events that affect this duck during the interval
    const relevantEvents = this.simulationEvents.filter((event) => {
      if (event.type !== "skill") return false;

      // Check if event affects this duck
      let affectsThisDuck = false;
      switch (
        event.s // Compressed: event.skill -> event.s
      ) {
        case "boost":
        case "immune":
          affectsThisDuck = event.id === duck.id; // Compressed: event.duck -> event.id, compare by ID
          break;
        case "bomb":
          affectsThisDuck = event.ta === duck.name; // Compressed: event.target -> event.ta
          break;
        case "splash":
        case "lightning":
          affectsThisDuck = event.id !== duck.id; // Compressed: event.duck -> event.id, compare by ID
          break;
        case "magnet":
          affectsThisDuck = event.targetDuck === duck.name;
          break;
      }

      if (!affectsThisDuck) return false;

      // Check if event's duration overlaps with our interval
      const eventStartTime = event.t; // Compressed: event.time -> event.t
      const eventEndTime = event.t + (event.d || event.sd || 0); // Compressed: event.duration -> event.d, event.stunDuration -> event.sd

      return eventStartTime < endTime && eventEndTime > startTime;
    });

    // If no events affect this interval, return base speed
    if (relevantEvents.length === 0) return baseSpeed;

    // Sample speed at multiple points during the interval
    const sampleCount = Math.max(5, Math.ceil(intervalDuration / 100)); // Sample every 100ms or 5 samples minimum
    let totalSpeed = 0;

    for (let i = 0; i < sampleCount; i++) {
      const sampleTime = startTime + (intervalDuration * i) / (sampleCount - 1);
      const effectsAtTime = this.calculateEffectsFromEvents(duck, sampleTime);

      let speedAtTime = baseSpeed;
      if (effectsAtTime.stunned) {
        speedAtTime = 0;
      } else {
        if (effectsAtTime.boosted) speedAtTime *= 1.5;
        if (effectsAtTime.magnetBoosted) speedAtTime *= 1.3;
        if (effectsAtTime.splashAffected) speedAtTime *= 1.2;
      }

      totalSpeed += speedAtTime;
    }

    return totalSpeed / sampleCount;
  }

  // Convert meters from simulation to pixel positions on canvas
  convertMetersToPixels(meters) {
    const startX = 50; // Starting position in pixels
    const progress = Math.min(meters / 4000, 1); // Progress from 0 to 1 (4000m = finish line)
    return startX + (this.raceDistance - startX) * progress;
  }

  // Convert pixel positions back to meters
  convertPixelsToMeters(pixels) {
    const startX = 50; // Starting position in pixels
    const progress = Math.max(
      0,
      (pixels - startX) / (this.raceDistance - startX)
    );
    return progress * 4000; // Convert back to meters
  }

  // Smooth movement to a specific position (for finish line)
  smoothMoveToPosition(duck, targetX) {
    if (!duck.smoothTarget) {
      duck.smoothTarget = {
        x: targetX,
        startX: duck.x,
        startTime: Date.now(),
        duration: 500, // 500ms animation to finish
      };
    }

    const elapsed = Date.now() - duck.smoothTarget.startTime;
    const progress = Math.min(elapsed / duck.smoothTarget.duration, 1);

    // Easing function for smooth finish (ease-out)
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    duck.x =
      duck.smoothTarget.startX +
      (duck.smoothTarget.x - duck.smoothTarget.startX) * easedProgress;

    // Clean up when animation is complete
    if (progress >= 1) {
      duck.x = targetX;
      delete duck.smoothTarget;
    }
  }

  // Replay a single event from the pre-calculated simulation
  replaySimulationEvent(event) {
    // Determine event type based on compressed fields
    if (event.ft !== undefined) {
      // Finish event (has finish time)
      const finisher = this.getDuckById(event.id); // Get duck by ID
      if (finisher && !finisher.finished) {
        finisher.finished = true;
        finisher.finishTime = event.ft; // Compressed: event.finishTime -> event.ft
        // Use smooth animation to finish line instead of immediate positioning
        this.smoothMoveToPosition(finisher, this.convertMetersToPixels(4000));
        this.log(`🏁 ${finisher.name} finished the race!`);
        if (1 === finisher.position) {
          setTimeout(
            () => this.speakImmediately(`${finisher.name}, wins the race`),
            500
          );
        }
      }
    } else if (event.s) {
      // Skill event (has skill field)
      const duck = this.getDuckById(event.id); // Get duck by ID instead of name
      if (duck) {
        this.log(`${this.skills[event.s].emoji} ${duck.name} used ${event.s}!`); // Compressed: event.skill -> event.s

        // Add visual floating effect for skill use (display for 1 second)
        switch (
          event.s // Compressed: event.skill -> event.s
        ) {
          case "boost":
            this.addEffect(duck, "🚀 BOOST!", "#FFD700", 1000);
            break;
          case "immune":
            this.addEffect(duck, "🛡️ IMMUNE!", "#00FFFF", 1000);
            break;
          case "bomb":
            this.addEffect(duck, "💣 BOMB!", "#FF4444", 1000);
            if (event.ta) {
              // Compressed: event.target -> event.ta
              this.log(
                `💥 ${event.ta} was stunned by ${duck.name}'s bomb!` // Use duck.name instead of event.duck
              );
              const target = this.ducks.find((d) => d.name === event.ta); // Compressed: event.target -> event.ta
              if (target) {
                this.addEffect(target, "💥 STUNNED!", "#FF0000", 1000);
              }
            }
            break;
          case "splash":
            this.addEffect(duck, "🌊 SPLASH!", "#0066FF", 1000);
            this.log(
              `🌊 ${duck.name} splashed ${event.ac || 0} ducks!` // Use duck.name instead of event.duck
            );
            break;
          case "lightning":
            this.addEffect(duck, "⚡ LIGHTNING!", "#FFFF00", 1000);
            this.log(
              `⚡ ${duck.name} stunned ${
                event.sc || 0 // Compressed: event.stunnedCount -> event.sc
              } ducks with lightning!`
            );
            // Add stunned effects to other ducks
            this.ducks.forEach((otherDuck) => {
              if (otherDuck !== duck && !otherDuck.finished) {
                this.addEffect(otherDuck, "⚡ ZAP!", "#FFFF00", 1000);
              }
            });
            break;
          case "magnet":
            this.addEffect(
              duck,
              `🧲 MAGNET ${Math.round((event.bp || 0) * 100)}%!`, // Compressed: event.boostPercent -> event.bp
              "#FF00FF",
              1000
            );

            // If magnet attached to a different duck, show effect on target too
            if (event.targetDuck && event.targetDuck !== duck.name) {
              const targetDuck = this.ducks.find(
                (d) => d.name === event.targetDuck
              );
              if (targetDuck) {
                this.addEffect(
                  targetDuck,
                  `🧲 BOOSTED ${Math.round(
                    (event.bp || 0) * 100 // Compressed: event.boostPercent -> event.bp
                  )}%!`,
                  "#FF00FF",
                  1000
                );
              }
              this.log(
                `🧲 ${duck.name} attached magnet to ${event.targetDuck}!` // Use duck.name instead of event.duck
              );
            } else {
              this.log(`🧲 ${duck.name} activated magnet boost!`); // Use duck.name instead of event.duck
              break;
            }
        }
      }
    }
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

  loadCustomRacerNames() {
    const saved = localStorage.getItem("customRacerNames");
    if (saved) {
      return JSON.parse(saved);
    }

    const customRacerNames = [];
    for (let i = 0; i < 5; i++) {
      const randomIndex = Math.floor(Math.random() * window.duckNames.length);
      customRacerNames.push(window.duckNames[randomIndex]);
    }

    localStorage.setItem("customRacerNames", JSON.stringify(customRacerNames));
    return customRacerNames;
  }

  loadCustomRacerProfilePictures() {
    const saved = localStorage.getItem("customRacerProfilePictures");
    if (saved) {
      return JSON.parse(saved);
    }

    // Initialize with null values for 5 custom racers
    const customRacerProfilePictures = [null, null, null, null, null];
    localStorage.setItem(
      "customRacerProfilePictures",
      JSON.stringify(customRacerProfilePictures)
    );
    return customRacerProfilePictures;
  }

  saveDefaultRacerProfilePictures() {
    localStorage.setItem(
      "customRacerProfilePictures",
      JSON.stringify(this.customRacerProfilePictures)
    );
  }

  getRandomDuckName() {
    if (window.duckNames.length === 0) {
      return "Duck";
    }
    const randomIndex = Math.floor(Math.random() * window.duckNames.length);
    return window.duckNames[randomIndex];
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
    if (this.isRankedMode()) {
      // Ranked mode: Use only ranked racer data
      this.duckNames = [window.rankedRacerName || "Ranked Duck"];
      this.duckColors = [window.rankedRacerColor || "#FFD700"]; // Gold color for ranked racer
      this.duckProfilePictures = [window.rankedRacerProfilePicture || null];

      this.initializeRankedDuck();
      this.updateLeaderboard();
      this.draw();
      return;
    }

    // Casual mode: Always show default racers, plus any custom racers
    this.duckNames = [];
    this.duckColors = [];
    this.duckProfilePictures = [];

    // Always start with the 5 default racers in casual mode
    const customRacers = [
      {
        name: this.customRacerNames[0] || "Duck1",
        color: "#FFD700",
        profilePicture: this.customRacerProfilePictures[0] || null,
      },
      {
        name: this.customRacerNames[1] || "Duck2",
        color: "#FF6347",
        profilePicture: this.customRacerProfilePictures[1] || null,
      },
      {
        name: this.customRacerNames[2] || "Duck3",
        color: "#32CD32",
        profilePicture: this.customRacerProfilePictures[2] || null,
      },
      {
        name: this.customRacerNames[3] || "Duck4",
        color: "#1E90FF",
        profilePicture: this.customRacerProfilePictures[3] || null,
      },
      {
        name: this.customRacerNames[4] || "Duck5",
        color: "#DA70D6",
        profilePicture: this.customRacerProfilePictures[4] || null,
      },
    ];

    // Add default racers
    customRacers.forEach((racer) => {
      this.duckNames.push(racer.name);
      this.duckColors.push(racer.color);
      this.duckProfilePictures.push(racer.profilePicture);
    });

    // Add custom racers (if any) after the default ones
    this.customRacers.forEach((racer) => {
      this.duckNames.push(racer.name);
      this.duckColors.push(racer.color);
      this.duckProfilePictures.push(racer.profilePicture || null);
    });

    this.initializeDucks();
    this.updateLeaderboard();

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

        // Smooth movement tracking
        velocity: 0, // Current velocity for smooth acceleration/deceleration
        lastX: 50, // Previous position for velocity calculation
        lastUpdateTime: Date.now(), // Last update timestamp

        // Enhanced smooth speed tracking
        currentVisualSpeed: 100, // Current visual speed for smooth transitions
        lastSimulationPosition: 0, // Last known simulation position
        lastSimulationTime: 0, // When we last got simulation data
        smoothVelocity: 0, // Smoothed velocity for natural movement

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

  initializeRankedDuck() {
    // Use ranked racer data
    const racerName = window.rankedRacerName || "Ranked Duck";
    const racerId = window.rankedRacerId || 1;
    const racerProfile = window.rankedRacerProfilePicture || null;
    const racerColor = window.rankedRacerColor || "#FFD700"; // Gold color for ranked racer

    // Calculate center lane position
    const bottomMargin = 50;
    const usableHeight = this.canvas.height - 80 - bottomMargin;
    const centerY = 80 + usableHeight / 2;

    // Create single ranked duck
    this.ducks = [
      {
        id: racerId,
        name: racerName,
        color: racerColor,
        profilePicture: racerProfile,
        x: 50, // Start position
        y: centerY, // Center lane
        speed: this.baseSpeed,
        baseSpeed: this.baseSpeed,
        finished: false,
        finishTime: 0,
        position: 1,

        // Smooth movement tracking
        velocity: 0,
        lastX: 50,
        lastUpdateTime: Date.now(),

        // Enhanced smooth speed tracking
        currentVisualSpeed: 100,
        lastSimulationPosition: 0,
        lastSimulationTime: 0,
        smoothVelocity: 0,

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
        nextSkillTime: Date.now() + Math.random() * 5000 + 5000,

        // Visual effects
        effects: [],

        // Multipliers
        speedMultiplier: 1.0,
      },
    ];

    // Update duck data arrays for consistency
    this.duckNames = [racerName];
    this.duckColors = [racerColor];
    this.duckProfilePictures = [racerProfile];
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
    const dialog = document.getElementById("addRacerDialog");
    if (!dialog) {
      console.error("Add racer dialog element not found in DOM");
      return;
    }

    // Generate a random unique color and reset dialog state
    const randomColor = this.generateUniqueColor();
    dialog.currentColor = randomColor;
    dialog.uploadedImage = null;

    // Set initial color picker value
    const colorPicker = document.getElementById("addDialogColorPicker");
    if (colorPicker) {
      colorPicker.value = window.rgbToHex(randomColor);
    }

    // Add event listener for color picker if not already added
    if (colorPicker && !colorPicker.dataset.listenerAdded) {
      colorPicker.onchange = (e) => {
        const selectedColor = e.target.value;
        dialog.currentColor = selectedColor;
      };
      colorPicker.dataset.listenerAdded = "true";
    }

    // Reset fields
    const nameInput = document.getElementById("addDialogRacerName");
    if (nameInput) {
      nameInput.value = "";
    }
    const preview = document.getElementById("addDialogImagePreview");
    if (preview) {
      preview.innerHTML = "";
    }
    const fileInput = document.getElementById("addDialogImageFile");
    if (fileInput) {
      fileInput.value = "";
    }

    // Open dialog
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.style.display = "block";
    }

    if (nameInput) nameInput.focus();
  }

  addRacerFromDialog() {
    const name = document.getElementById("addDialogRacerName").value;
    const dialog = document.getElementById("addRacerDialog");
    const colorPicker = document.getElementById("addDialogColorPicker");
    const color = colorPicker
      ? colorPicker.value
      : dialog
      ? dialog.currentColor
      : this.generateUniqueColor();
    const imageData = dialog ? dialog.uploadedImage : null;

    if (name.trim()) {
      this.addRacer(name, color, imageData);
      if (dialog && typeof dialog.close === "function") {
        dialog.close();
      } else if (dialog) {
        dialog.style.display = "none";
      }
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
        const dialog =
          dialogType === "add"
            ? document.getElementById("addRacerDialog")
            : document.getElementById("editRacerDialog");
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
    this.log("⚙️ Settings saved successfully!", "skill");
  }

  autoSaveSettings() {
    const discordWebhookUrl =
      document.getElementById("discordWebhookUrl").value;

    this.settings.discordWebhookUrl = discordWebhookUrl;
    this.saveSettings();
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

    // Reset game state
    this.customRacers = [];
    this.duckNames = [];
    this.duckColors = [];
    this.duckProfilePictures = [];
    this.settings = {};
    this.customRacerNames = this.loadCustomRacerNames();
    this.customRacerProfilePictures = this.loadCustomRacerProfilePictures();

    // Close dialog
    const dialog = document.getElementById("settingsDialog");
    if (dialog && typeof dialog.close === "function") {
      dialog.close();
    } else if (dialog) {
      dialog.style.display = "none";
    }

    // Reinitialize
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

    // First try to find in customRacers (casual mode custom racers)
    let racer = this.customRacers.find((r) => String(r.id) === racerId);
    let isRankedModeRacer = false;
    let isCustomRacer = false;

    // If not found in customRacers, check if it's a default racer in casual mode
    if (!racer && !this.isRankedMode()) {
      // In casual mode, check if this is a default racer (ID 0-4)
      const duckIndex = parseInt(racerId);
      if (
        duckIndex >= 0 &&
        duckIndex < 5 &&
        this.ducks &&
        this.ducks[duckIndex]
      ) {
        const duck = this.ducks[duckIndex];
        racer = {
          id: duck.id,
          name: duck.name,
          color: duck.color,
          profilePicture: duck.profilePicture,
        };
        isCustomRacer = true;
      }
    }

    // If still not found, try to find in ducks array (ranked mode)
    if (!racer && this.ducks) {
      const duck = this.ducks.find((d) => String(d.id) === racerId);
      if (duck) {
        racer = {
          id: duck.id,
          name: duck.name,
          color: duck.color,
          profilePicture: duck.profilePicture,
        };
        isRankedModeRacer = true;
      }
    }

    if (!racer) {
      console.error("Racer not found:", racerId);
      return;
    }

    // Ensure Add dialog is closed if it is open
    const addDlg = document.getElementById("addRacerDialog");
    if (addDlg) {
      if (typeof addDlg.close === "function") {
        addDlg.close();
      } else {
        addDlg.style.display = "none";
      }
    }

    const dialog = document.getElementById("editRacerDialog");
    if (!dialog) {
      console.error("Edit racer dialog element not found in DOM");
      return;
    }

    // Persist state on dialog element
    dialog.uploadedImage = racer.profilePicture; // Start with existing image
    dialog.isRankedModeRacer = isRankedModeRacer; // Store for later use
    dialog.isCustomRacer = isCustomRacer; // Store for later use

    // Update title with mode suffix
    const titleEl = document.getElementById("editRacerTitle");
    if (titleEl) {
      titleEl.textContent = `Edit Racer${
        isRankedModeRacer ? " (Ranked)" : isCustomRacer ? " (Default)" : ""
      }`;
    }

    // Set initial color picker value
    const colorPicker = document.getElementById("editDialogColorPicker");
    if (colorPicker) {
      colorPicker.value = racer.color;
    }

    // Add event listener for color picker if not already added
    if (colorPicker && !colorPicker.dataset.listenerAdded) {
      colorPicker.onchange = (e) => {
        const selectedColor = e.target.value;
        dialog.currentColor = selectedColor;
      };
      colorPicker.dataset.listenerAdded = "true";
    }

    // Populate form fields
    const form = document.getElementById("editRacerForm");
    const nameInput = document.getElementById("editDialogRacerName");
    const nameError = document.getElementById("nameError");
    if (nameInput) {
      nameInput.value = racer.name || "";
      nameInput.style.borderColor = "";
    }
    if (nameError) {
      nameError.style.display = "none";
      nameError.textContent = "Name must be 2-16 alphanumeric characters only";
    }

    // Set image preview
    const preview = document.getElementById("editDialogImagePreview");
    if (preview) {
      preview.innerHTML =
        racer.profilePicture && racer.profilePicture.trim() !== ""
          ? `<img src="${racer.profilePicture}" class="preview-image" alt="Current" />`
          : "";
    }

    // Real-time validation (overwrite previous handlers to avoid duplicates)
    if (nameInput) {
      nameInput.oninput = () => {
        const value = nameInput.value;
        const isValid = /^[A-Za-z0-9]{2,16}$/.test(value);

        if (value && !isValid) {
          if (nameError) nameError.style.display = "block";
          nameInput.style.borderColor = "#e74c3c";
        } else {
          if (nameError) nameError.style.display = "none";
          nameInput.style.borderColor = "";
        }
      };
    }

    // Form submission handler (overwrite to avoid duplicate listeners)
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const name = nameInput ? nameInput.value.trim() : "";

        if (!name) {
          if (nameError) nameError.textContent = "Name is required";
          if (nameError) nameError.style.display = "block";
          if (nameInput) {
            nameInput.style.borderColor = "#e74c3c";
            nameInput.focus();
          }
          return;
        }

        if (!/^[A-Za-z0-9]{2,16}$/.test(name)) {
          if (nameError)
            nameError.textContent =
              "Name must be 2-16 alphanumeric characters only";
          if (nameError) nameError.style.display = "block";
          if (nameInput) {
            nameInput.style.borderColor = "#e74c3c";
            nameInput.focus();
          }
          return;
        }

        this.updateRacerFromDialog(id);
      };
    }

    // Focus and open the dialog
    const nameField = document.getElementById("editDialogRacerName");
    if (nameField) nameField.focus();
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.style.display = "block";
    }
  }

  async updateRacerFromDialog(id) {
    const name = document.getElementById("editDialogRacerName").value.trim();
    const dialog = document.getElementById("editRacerDialog");
    const colorPicker = document.getElementById("editDialogColorPicker");
    const color = colorPicker
      ? colorPicker.value
      : dialog
      ? dialog.currentColor
      : "#FFD700";
    const imageData = dialog ? dialog.uploadedImage : null;
    const isRankedModeRacer = dialog ? dialog.isRankedModeRacer : false;
    const isCustomRacer = dialog ? dialog.isCustomRacer : false;

    // Validate name
    if (!name) {
      const nameError = document.getElementById("nameError");
      const nameInput = document.getElementById("editDialogRacerName");
      nameError.textContent = "Name is required";
      nameError.style.display = "block";
      nameInput.style.borderColor = "#e74c3c";
      nameInput.focus();
      return;
    }

    if (!/^[A-Za-z0-9]{2,16}$/.test(name)) {
      const nameError = document.getElementById("nameError");
      const nameInput = document.getElementById("editDialogRacerName");
      nameError.textContent = "Name must be 2-16 alphanumeric characters only";
      nameError.style.display = "block";
      nameInput.style.borderColor = "#e74c3c";
      nameInput.focus();
      return;
    }

    if (this.isRankedMode() && id === window.rankedRacerId) {
      const updateRacerUrl = `https://waddle-waddle.vercel.app/api/v1/update-racer?okey=${window.okey}`;
      const corsProxyUpdateRacerUrl = `https://corsproxy.io/?${encodeURIComponent(
        updateRacerUrl
      )}`;

      try {
        await fetch(corsProxyUpdateRacerUrl, {
          method: "PUT", // Specify the HTTP method as POST
          headers: {
            "Content-Type": "application/json", // Inform the server about the data format
          },
          body: JSON.stringify({
            id: window.rankedRacerId,
            name: name,
            profilePicture: imageData,
            okey: window.okey,
            color: color,
          }),
        });
      } catch (reason) {
        console.error(reason);
        return;
      }

      window.localStorage.setItem("rankedRacerName", name);
      window.localStorage.setItem("rankedRacerProfilePicture", imageData);
      window.localStorage.setItem("rankedRacerColor", color);
      this.setWindowRacerData();
    }

    // Convert id to string for comparison
    const racerId = String(id);

    if (isCustomRacer) {
      // Handle default racer (update ducks array and duck data arrays)
      const duckIndex = parseInt(racerId);

      if (duckIndex < 0 || duckIndex >= 5 || !this.ducks[duckIndex]) {
        const dlg = document.getElementById("editRacerDialog");
        if (dlg && typeof dlg.close === "function") {
          dlg.close();
        } else {
          const el = document.querySelector(".racer-dialog");
          if (el) el.remove();
        }
        return;
      }

      // Ensure unique name (exclude current duck from check)
      let uniqueName = name;
      let counter = 1;
      while (
        this.ducks.some(
          (duck, index) => index !== duckIndex && duck.name === uniqueName
        )
      ) {
        uniqueName = `${name} (${counter})`;
        counter++;
      }

      // Update the duck
      this.ducks[duckIndex].name = uniqueName;
      this.ducks[duckIndex].profilePicture = imageData;
      this.ducks[duckIndex].color = color;

      // Update the duck data arrays for consistency
      this.duckNames[duckIndex] = uniqueName;
      this.duckColors[duckIndex] = color;
      this.duckProfilePictures[duckIndex] = imageData;

      // Update default racer names and profile pictures in localStorage to persist changes
      if (this.customRacerNames && this.customRacerNames[duckIndex]) {
        this.customRacerNames[duckIndex] = uniqueName;
        localStorage.setItem(
          "customRacerNames",
          JSON.stringify(this.customRacerNames)
        );
      }

      if (this.customRacerProfilePictures) {
        this.customRacerProfilePictures[duckIndex] = imageData;
        this.saveDefaultRacerProfilePictures();
      }

      // Update the leaderboard to reflect changes
      this.updateLeaderboard();
      this.draw();

      console.log("Updated custom racer:", uniqueName);

      const dlg2 = document.getElementById("editRacerDialog");
      if (dlg2 && typeof dlg2.close === "function") {
        dlg2.close();
      } else if (dlg2) {
        dlg2.style.display = "none";
      }

      return;
    }

    if (isRankedModeRacer) {
      // Handle ranked mode racer (update ducks array and duck data arrays)
      const duckIndex = this.ducks.findIndex((d) => String(d.id) === racerId);

      if (-1 === duckIndex) {
        const dlg = document.getElementById("editRacerDialog");
        if (dlg && typeof dlg.close === "function") {
          dlg.close();
        } else {
          const el = document.querySelector(".racer-dialog");
          if (el) el.remove();
        }
        return;
      }

      // Update the duck
      this.ducks[duckIndex].name = name;
      this.ducks[duckIndex].profilePicture = imageData;
      this.ducks[duckIndex].color = color;

      // Update the duck data arrays for consistency
      this.duckNames[duckIndex] = name;
      this.duckColors[duckIndex] = color;
      this.duckProfilePictures[duckIndex] = imageData;

      // Update the leaderboard to reflect changes
      this.updateLeaderboard();
      this.draw();

      console.log("Updated ranked mode racer:", name);

      const dlg = document.getElementById("editRacerDialog");
      if (dlg && typeof dlg.close === "function") {
        dlg.close();
      } else {
        const el = document.querySelector(".racer-dialog");
        if (el) el.remove();
      }

      return;
    }

    // Handle custom racer (original logic)
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
      this.customRacers[racerIndex].color = color;
      this.saveCustomRacers();
      this.updateRacersList();

      // Update active duck's profile picture if race is running
      if (this.raceActive && this.ducks[racerIndex]) {
        this.ducks[racerIndex].name = uniqueName;
        this.ducks[racerIndex].profilePicture = imageData;
        this.ducks[racerIndex].color = color;
      }
    }

    const dlg = document.getElementById("editRacerDialog");
    if (dlg && typeof dlg.close === "function") {
      dlg.close();
    } else {
      const el = document.querySelector(".racer-dialog");
      if (el) el.remove();
    }
  }

  async createOnlineRankedRace() {
    const rankedRaceUrl = `https://waddle-waddle.vercel.app/api/v1/ranked-race?okey=${window.okey}&wrc=${window.rankedRacerId}`;
    const corsProxyRankedRaceUrl = `https://corsproxy.io/?${encodeURIComponent(
      rankedRaceUrl
    )}`;

    try {
      const response = await fetch(corsProxyRankedRaceUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("🏆 Online ranked race response:", data);
      return data;
    } catch (error) {
      console.error("❌ Error creating online ranked race:", error);
      throw error;
    }
  }

  // Initialize ducks from online ranked race response
  initializeRankedDucksFromResponse(raceData) {
    this.ducks = [];

    if (!raceData.standings || !Array.isArray(raceData.standings)) {
      console.error("❌ Invalid race data: missing standings");
      return false;
    }

    // Reserve 50px from bottom for progress bar
    const bottomMargin = 50;
    const usableHeight = this.canvas.height - 80 - bottomMargin;
    const racerCount = raceData.standings.length;

    // Create ducks from the standings data
    [...raceData.standings]
      .sort(() => Math.random() - 0.5)
      .forEach((racer, index) => {
        // Calculate lane positioning - evenly distribute all racers across usable height
        const laneY =
          80 +
          (index * usableHeight) / racerCount +
          usableHeight / racerCount / 2;

        this.ducks.push({
          id: racer.id,
          name: racer.name || `Racer ${racer.id}`,
          color: racer.color || this.generateRandomColor(),
          profilePicture: racer.profilePicture || null,
          x: 50, // Start position
          y: laneY, // Calculated lane positioning
          speed: this.baseSpeed,
          baseSpeed: this.baseSpeed,
          finished: false,
          finishTime: 0,
          position: index + 1,

          // Smooth movement tracking
          velocity: 0,
          lastX: 50,
          lastUpdateTime: Date.now(),

          // Enhanced smooth speed tracking
          currentVisualSpeed: 100,
          lastSimulationPosition: 0,
          lastSimulationTime: 0,
          smoothVelocity: 0,

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
          nextSkillTime: Date.now() + Math.random() * 5000 + 5000,

          // Visual effects
          effects: [],

          // Multipliers
          speedMultiplier: 1.0,
        });
      });

    // Update duck data arrays for consistency
    this.duckNames = this.ducks.map((duck) => duck.name);
    this.duckColors = this.ducks.map((duck) => duck.color);
    this.duckProfilePictures = this.ducks.map((duck) => duck.profilePicture);

    // Update leaderboard and draw the new racers
    this.updateLeaderboard();
    this.draw();

    console.log(
      `🏆 Initialized ${this.ducks.length} ranked racers:`,
      this.ducks.map((d) => ({ id: d.id, name: d.name }))
    );
    return true;
  }

  async startRace() {
    if (this.raceActive) return;

    this.toggleStartBtn(false);

    this.onlineRaceData = null;

    if (this.isRankedMode()) {
      // Ranked mode: Check if ranked racer data is available
      if (!window.rankedRacerId || !window.rankedRacerName) {
        alert("Ranked racer data is not available. Please refresh the page.");
        this.toggleStartBtn(true);
        return;
      }

      try {
        // Step 1: Use createOnlineRankedRace to get race data
        this.log("🌐 Creating online ranked race...");
        this.onlineRaceData = await this.createOnlineRankedRace();

        if (!this.onlineRaceData || !this.onlineRaceData.standings) {
          throw new Error("Invalid response from online ranked race API");
        }

        // Step 2: Populate racers from the standings response field
        this.log(
          `🏆 Loading ${this.onlineRaceData.standings.length} ranked racers...`
        );
        const initSuccess = this.initializeRankedDucksFromResponse(
          this.onlineRaceData
        );

        if (!initSuccess) {
          throw new Error("Failed to initialize racers from online race data");
        }
      } catch (error) {
        console.error("❌ Failed to create online ranked race:", error);
        this.log(`❌ Failed to start ranked race: ${error.message}`);
        alert(`Failed to start ranked race: ${error.message}`);
        this.toggleStartBtn(true);
        return;
      }
    } else {
      // Casual mode: Check if there are any custom racers
      if (this.duckNames.length === 0) {
        alert("Cannot start race! Please add at least one racer.");
        return;
      }

      // Ensure we have the latest racer data before initializing ducks
      this.updateRacersList();
      this.initializeDucks();
    }
    this.clearLog();

    // For ranked mode with online race data, use the simulation from the API response
    if (this.isRankedMode() && this.onlineRaceData) {
      // Step 3: Use the simulation from the online race response
      this.log("🚦 Starting online ranked race...");

      // Apply the online simulation results directly
      this.applySimulationResults(this.onlineRaceData);

      this.log("✅ Online ranked race loaded successfully!");
    } else {
      // Use local race simulator for casual mode or fallback
      this.log("🎮 Using local race simulator...");
      const usingSimulator = this.useRaceSimulator();

      if (!usingSimulator) {
        console.error("❌ Race failed to start: Simulator is required");
        this.log("❌ Race failed to start: Simulator is required");
        this.toggleStartBtn(true);
        return; // Exit early if simulator fails
      }
    }

    // Only proceed if simulator was successful
    this.raceActive = true;
    this.raceStartTime = Date.now();
    this.previousLeaderId = null; // Initialize for lead change detection
    const startBtn = document.getElementById("startBtn");
    startBtn.innerHTML = "🛑 <span class='startBtn-text'>Stop</span>";
    startBtn.disabled = false;

    // Re-enable the start button
    this.toggleStartBtn(true);

    // Hide Add Racer button during race
    const addBtn = document.getElementById("addRacerBtn");
    addBtn.classList.add("hidden");

    // Disable race mode toggle during race
    if (window.updateRaceModeToggleState) {
      window.updateRaceModeToggleState(true);
    }

    // Disable race title editing during race
    this.raceTitleInput.disabled = true;

    this.log("🟩 Race Started!", "", true);

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
  }

  update() {
    if (!this.raceActive) return;

    // MANDATORY: Only simulation mode is allowed
    if (this.usingSimulation) {
      this.updateFromSimulation();
      return;
    }

    // Traditional mode should NEVER run - this is a safety fallback that logs an error
    console.error(
      "❌ CRITICAL ERROR: Traditional race mode attempted to run! This should never happen."
    );
    console.error("❌ Race will be stopped to prevent inconsistent results.");
    this.log("❌ ERROR: Race stopped due to simulation failure");
    this.stopRace();
    return;
  }

  addEffect(duck, text, color, duration) {
    const now = Date.now();

    // Ensure effects array exists
    if (!duck.effects) {
      duck.effects = [];
    }

    duck.effects.push({
      text: text,
      color: color,
      startTime: now,
      endTime: now + duration,
      // Remove random Y offset for consistent positioning
    });
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
    // Find winner using the same logic as endRace
    let winner;

    if (this.usingSimulation && this.simulationStandings) {
      // Use simulation results for winner (same as in endRace)
      const winnerData = this.simulationStandings[0];
      winner = this.ducks.find((d) => d.id === winnerData.id) || this.ducks[0];
    } else {
      // Use traditional logic for winner
      winner = this.ducks.reduce((prev, curr) =>
        curr.finished && (!prev.finished || curr.finishTime < prev.finishTime)
          ? curr
          : prev
      );
    }

    if (!winner || !winner.finished) return;

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

    // Draw enhanced status effects with duration progress bar only
    if (duck.statusEffects && duck.effectDurations) {
      let progressBarColor = null;
      let remainingTime = 0;
      let maxDuration = 1;

      // Determine primary effect (prioritize debuffs over buffs)
      if (duck.statusEffects.includes("stunned")) {
        progressBarColor = "#FF4444";
        remainingTime = duck.effectDurations.stunned;
        maxDuration = 3000; // Typical stun duration
      } else if (duck.statusEffects.includes("splash")) {
        progressBarColor = "#6464FF";
        remainingTime = duck.effectDurations.splash;
        maxDuration = 3000;
      } else if (duck.statusEffects.includes("boosted")) {
        progressBarColor = "#FFD700";
        remainingTime = duck.effectDurations.boosted;
        maxDuration = 4000; // Typical boost duration
      } else if (duck.statusEffects.includes("immune")) {
        progressBarColor = "#00FFFF";
        remainingTime = duck.effectDurations.immune;
        maxDuration = 5000;
      } else if (duck.statusEffects.includes("magnet")) {
        progressBarColor = "#FF64FF";
        remainingTime = duck.effectDurations.magnet;
        maxDuration = 4000;
      }

      if (progressBarColor && remainingTime > 0) {
        // Draw duration progress bar at bottom of racer tag area
        const barWidth = duckWidth * 1.6;
        const barHeight = 3;
        const barX = screenX - 18;
        const barY = screenY + duckHeight + 4; // Position below the racer tag

        // Background bar
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // Progress bar
        const progressWidth = (remainingTime / maxDuration) * barWidth;
        this.ctx.fillStyle = progressBarColor;
        this.ctx.fillRect(barX, barY, progressWidth, barHeight);
      }
    }

    // Draw black outline first (rubber duck style)
    this.ctx.strokeStyle = "#000";
    this.ctx.lineWidth = 3;

    // Draw tail feathers FIRST (behind the body) - moved to upper right of duck's body
    this.ctx.fillStyle = duck.color;
    this.ctx.strokeStyle = "#000";
    this.ctx.lineWidth = 3;

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
    this.ctx.strokeStyle = "#000";
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
    this.ctx.lineWidth = 3;
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
    if (
      this.isRankedMode() &&
      duck.id === window.rankedRacerId &&
      this.raceActive
    ) {
      this.ctx.strokeStyle =
        Date.now() % 1000 < 500 ? "#000000CC" : "#000000FF";
      this.ctx.lineWidth = 4;
    }

    this.ctx.fill();
    this.ctx.stroke();

    // Draw orange beak (rubber duck style)
    this.ctx.fillStyle = "#FF8C00";
    this.ctx.beginPath();
    this.ctx.ellipse(screenX + 35, screenY - 6, 10, 5, 0, 0, 2 * Math.PI); // Adjusted position and size
    this.ctx.fill();
    this.ctx.strokeStyle = "#000";
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

    this.ctx.strokeStyle = "#000";
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

    // Calculate text width for proper background sizing
    this.ctx.font = "bold 12px Arial";
    const textWidth = this.ctx.measureText(duck.name).width;
    const paddingX = 10;
    const nameTagWidth = Math.max(textWidth + paddingX, 70); // Minimum width of 70px

    this.ctx.fillRect(
      screenX - 25 - Math.max(0, (nameTagWidth - 70) / 2),
      screenY + 20,
      nameTagWidth,
      18
    );

    this.ctx.fillStyle =
      this.isRankedMode() && duck.id === window.rankedRacerId
        ? "#FFD700"
        : "#FFFFFF";
    this.ctx.font = "bold 12px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText(duck.name, screenX + 10, screenY + 32);
    this.ctx.textAlign = "left"; // Reset alignment

    // Draw position (bigger) - moved to right of the name tag
    // Only show position when race is active (hide when race is finished)
    if (this.raceActive) {
      this.ctx.fillStyle = "#fff";
      this.ctx.font = "bold 12px Arial";
      this.ctx.fillText(
        `#${duck.position}`,
        screenX + 50 + Math.max(0, (nameTagWidth - 70) / 2),
        screenY + 32
      );

      // Draw single status effect emoji closer to position
      let statusX = screenX + 65; // Start closer to position number

      // Get current status effects from simulation data if available
      if (this.usingSimulation && this.simulationProgress) {
        const raceTimeMs = Date.now() - this.simulationStartTime;
        const currentTimeStep = Math.floor(raceTimeMs / 100) * 100;
        const currentData = this.simulationProgress.find(
          (p) => p.time === currentTimeStep
        );

        if (currentData) {
          const duckData = currentData.positions.find((p) => p.id === duck.id);
          if (duckData) {
            // Calculate current effects from events for this duck at current time
            const currentEffects = this.calculateEffectsFromEvents(
              duck,
              raceTimeMs
            );
            this.ctx.font = "14px Arial";

            // Show only the most important effect (priority order)
            if (currentEffects.stunned) {
              this.ctx.fillText("😵", statusX, screenY + 32);
            } else if (currentEffects.boosted) {
              this.ctx.fillText("�", statusX, screenY + 32);
            } else if (currentEffects.splashAffected) {
              this.ctx.fillText("🌊", statusX, screenY + 32);
            } else if (currentEffects.immune) {
              this.ctx.fillText("🛡️", statusX, screenY + 32);
            } else if (currentEffects.magnetBoosted) {
              this.ctx.fillText("🧲", statusX, screenY + 32);
            }
          }
        }
      }
    }

    // Draw floating effects
    duck.effects.forEach((effect) => {
      const progress =
        (now - effect.startTime) / (effect.endTime - effect.startTime);
      const alpha = Math.max(0, 1 - progress);

      // Calculate consistent positioning above duck head
      // Head is at: screenX + 22, screenY - 6 with radius headSize (31)
      // Position text above the head with some padding
      const headCenterX = screenX + 22;
      const headTop = screenY - 6 - headSize; // Top of head
      const textY = headTop - 5; // 10px above head

      this.ctx.fillStyle = effect.color;
      this.ctx.globalAlpha = alpha;
      this.ctx.font = "bold 14px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText(effect.text, headCenterX, textY);
      this.ctx.globalAlpha = 1;
      this.ctx.textAlign = "left";
    });
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

    // Reset simulation state
    this.usingSimulation = false;
    this.simulatedDucks = null;
    this.simulationStandings = null;
    this.lastSimulationUpdate = 0;

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

    // Re-enable race mode toggle after race
    if (window.updateRaceModeToggleState) {
      window.updateRaceModeToggleState(false);
    }

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
      let winner;

      // if (this.usingSimulation && this.simulationStandings) {
      // Use simulation results for winner
      const winnerData = this.simulationStandings[0];
      winner = this.ducks.find((d) => d.id === winnerData.id) || this.ducks[0];

      this.log(`🎉 WINNER: ${winner.name}! 🎉`, "winner");
      this.log(
        `Final time: ${(winnerData.finishTime / 1000).toFixed(2)} seconds`,
        "winner"
      );

      // Log simulation statistics
      this.log("📊 Final Standings (Simulated):");
      this.simulationStandings.forEach((standing) => {
        let mmrChangeString = "";
        if (this.onlineRaceData && this.onlineRaceData.mmrChanges) {
          const mmrEntry = this.onlineRaceData.mmrChanges.find(
            (m) => m.id === standing.id
          );
          mmrChangeString = ` (MMR: ${mmrEntry.oldValue} → ${mmrEntry.newValue})`;

          if (mmrEntry.id === window.rankedRacerId) {
            window.localStorage.setItem("rankedRacerMmr", mmrEntry.newValue);
            window.rankedRacerMmr = mmrEntry.newValue;
          }
        }

        this.log(
          `${standing.position}. ${standing.name} - ${(
            standing.finishTime / 1000
          ).toFixed(2)}s${mmrChangeString}`
        );
      });
    }

    // Publish results to Discord webhook if configured
    const finalStandings =
      this.usingSimulation && this.simulationStandings
        ? this.simulationStandings
        : [...this.ducks].sort((a, b) => a.finishTime - b.finishTime);
    this.publishToDiscord(finalStandings);

    window.updateRaceModeToggleState(false);
    this.fetchOnlineLeaderboard();
  }

  publishToDiscord(standings) {
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

      // Use promise-based fetch instead of await
      fetch(this.settings.discordWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (response.ok) {
            this.log("📤 Results published to Discord!", "skill");
          } else {
            this.log("❌ Failed to publish to Discord", "skill");
          }
        })
        .catch((error) => {
          console.error("Discord webhook error:", error);
          this.log("❌ Error publishing to Discord", "skill");
        });
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
      sidebarHeader.textContent = `${racerCount} Racers`;
    }

    // During race: show sorted by position
    // Before/after race: show all racers with management buttons
    this.leaderboardElement.innerHTML = "";

    if (this.raceActive) {
      this.updateLeaderboardRaceIsActive();
      return;
    }

    // Show all racers with edit/delete buttons when not racing
    this.ducks.forEach((duck, index) => {
      const name = duck.name || this.duckNames[index];
      // this.duckNames.forEach((name, index) => {
      const entry = document.createElement("div");
      entry.className = "racer-config";

      // Find the custom racer that matches this name and position
      let racerId = duck.id || index;
      let profilePicture = duck.profilePicture || null;
      let isOwnedByUser = this.isRankedMode()
        ? duck.id === window.rankedRacerId
        : true; // Default to true for non-ranked mode

      // Add gradient background style
      const racerColor = this.duckColors[index];
      const gradientStyle = `background: linear-gradient(to left, ${racerColor}, transparent);`;
      entry.style.cssText = gradientStyle;

      // Only show edit/remove buttons for racers owned by the current user
      const editButton = isOwnedByUser
        ? `<button onclick="window.game.editRacer('${racerId}')" class="edit-btn-small">✏️</button>`
        : "";

      console.debug("editButton", editButton);

      // Show remove button only for custom racers (not for ranked mode racers)
      const removeButton = !this.isRankedMode()
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
  }

  updateLeaderboardRaceIsActive() {
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

  generateRankedRacerId() {
    // Disable start button while generating ranked racer ID
    this.toggleStartBtn(false);

    if (null !== window.localStorage.getItem("rankedRacerId")) {
      this.setWindowRacerData();
      this.toggleStartBtn(true);
      return;
    }

    const okey = `OKEY-${this.nanoid(16)}`;
    window.localStorage.setItem("okey", okey);
    window.okey = okey;

    const generateProfileUrl = `https://waddle-waddle.vercel.app/api/v1/generate-profile?okey=${window.okey}`;
    const corsProxyGenerateProfileUrl = `https://corsproxy.io/?${encodeURIComponent(
      generateProfileUrl
    )}`;
    fetch(corsProxyGenerateProfileUrl)
      .then((response) => response.json())
      .then((data) => {
        window.localStorage.setItem("rankedRacerId", data.id);
        window.localStorage.setItem("rankedRacerName", data.name);
        window.localStorage.setItem(
          "rankedRacerProfilePicture",
          data.profilePicture || ""
        );
        window.localStorage.setItem("rankedRacerMmr", data.mmr || 0);
        this.setWindowRacerData();
        this.toggleStartBtn(true);
      })
      .catch((error) => {
        console.error("Error racer id:", error);
      });
  }

  async fetchOnlineLeaderboard() {
    const leaderboardUrl = `https://waddle-waddle.vercel.app/api/v1/leaderboard?okey=${window.okey}&wrc=${window.rankedRacerId}`;
    const corsProxyLeaderboardUrl = `https://corsproxy.io/?${encodeURIComponent(
      leaderboardUrl
    )}`;
    fetch(corsProxyLeaderboardUrl)
      .then((response) => response.json())
      .then((data) => {
        window.leaderboard = data.leaderboard || [];
        this.updateOnlineLeaderboard();
      })
      .catch((error) => {
        console.error("Error racer id:", error);
      });
  }

  updateOnlineLeaderboard() {
    const leaderboardSection = document.getElementById("leaderboardSection");
    const globalLeaderboard = document.getElementById("globalLeaderboard");

    if (!leaderboardSection || !globalLeaderboard) {
      return; // Elements not ready yet
    }

    if (!this.isRankedMode()) {
      leaderboardSection.style.display = "none";
      return;
    }

    leaderboardSection.style.display = "block";

    if (
      !window.leaderboard ||
      !Array.isArray(window.leaderboard) ||
      window.leaderboard.length === 0
    ) {
      globalLeaderboard.innerHTML =
        '<div class="leaderboard-entry">Loading leaderboard...</div>';
      return;
    }

    globalLeaderboard.innerHTML = "";

    window.leaderboard.forEach((entry, index) => {
      const rank = entry.rank;
      const isUserEntry = entry.id === window.rankedRacerId;

      // Add divider before user entry if it's the 11th entry
      if (index === 10 && isUserEntry) {
        const divider = document.createElement("hr");
        divider.className = "leaderboard-divider";
        globalLeaderboard.appendChild(divider);
      }

      const entryElement = document.createElement("div");
      entryElement.className = `leaderboard-entry${
        isUserEntry ? " user-entry" : ""
      }`;

      const profilePictureStyle = entry.profilePicture
        ? `background-image: url('${entry.profilePicture}'); background-size: cover; background-position: center;`
        : `background-color: #666; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;`;

      const profilePictureInitial = entry.profilePicture
        ? ""
        : entry.name.charAt(0).toUpperCase();

      entryElement.innerHTML = `
        <span class="rank">#${rank}</span>
        <div class="online-leaderboard-profile-picture" style="${profilePictureStyle}">
          ${profilePictureInitial}
        </div>
        <span class="name">${entry.name}</span>
        <span class="mmr">${entry.mmr || 0}</span>
      `;

      globalLeaderboard.appendChild(entryElement);
    });
  }

  setWindowRacerData() {
    window.rankedRacerId = window.localStorage.getItem("rankedRacerId");
    window.rankedRacerName = window.localStorage.getItem("rankedRacerName");
    window.rankedRacerProfilePicture = window.localStorage.getItem(
      "rankedRacerProfilePicture"
    );
    window.rankedRacerColor = window.localStorage.getItem("rankedRacerColor");
    window.rankedRacerMmr = window.localStorage.getItem("rankedRacerMmr");
    window.okey = window.localStorage.getItem("okey");
  }

  nanoid(t = 21) {
    return crypto
      .getRandomValues(new Uint8Array(t))
      .reduce(
        (t, e) =>
          (t +=
            (e &= 63) < 36
              ? e.toString(36)
              : e < 62
              ? (e - 26).toString(36).toUpperCase()
              : e > 62
              ? "-"
              : "_"),
        ""
      );
  }

  toggleStartBtn(toggleFlag) {
    const startBtn = document.getElementById("startBtn");
    startBtn.disabled = !toggleFlag;
  }

  isRankedMode() {
    const raceModeToggle = document.getElementById("raceModeToggle");
    return raceModeToggle && raceModeToggle.checked;
  }

  speakImmediately(message) {
    const utterance = this.assembleUtterance(message);
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  assembleUtterance(message) {
    const cleanMessage = message.replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ""
    );
    const speechSynthesisUtterance = new SpeechSynthesisUtterance(cleanMessage);
    speechSynthesisUtterance.lang = "en-US";
    speechSynthesisUtterance.rate = 1.5;
    speechSynthesisUtterance.pitch = 2;

    const voices = speechSynthesis
      .getVoices()
      .filter((voice) => voice.lang === "en-US");
    speechSynthesisUtterance.voice = voices[0];

    return speechSynthesisUtterance;
  }

  takesTheLead(duckName) {
    if (!this.raceActive) {
      return;
    }

    const randomTakesTheLead = window.pickRandom([
      `And ${duckName}, takes the lead!`,
      `It's ${duckName}, in the lead!`,
      `${duckName}, surges ahead!`,
      `${duckName}, is now leading!`,
      `What a move by ${duckName}, taking the lead!`,
      `${duckName}, leads the pack!`,
      `Now it's ${duckName}, in front!`,
      `${duckName}, grabs the lead!`,
      `Look at ${duckName}, taking charge!`,
      `${duckName}, is out in front!`,
      `It's ${duckName}, leading the way!`,
      `The lead changes to ${duckName}!`,
      `${duckName}, takes over the lead!`,
      `It's ${duckName}, at the front!`,
      `${duckName}, moves into the lead!`,
    ]);
    clearTimeout(this.randomRemarkTimeout);
    this.speakImmediately(randomTakesTheLead);

    0 === Math.floor(Math.random() * 2) && this.randomRemark(duckName);
  }

  randomRemark(duckName) {
    if (!this.raceActive) {
      return;
    }

    const randomRemark = window.pickRandom([
      `What a performance by ${duckName}!`,
      `${duckName} is really showing their stuff!`,
      `Keep an eye on ${duckName}, they're on fire!`,
      `${duckName} is making waves out there!`,
      `Look at ${duckName}, what a racer!`,
      `${duckName} is in the zone!`,
      `This is exciting, the ducks are showing their skills!`,
      `It really comes down through all the years of hard work for these racers!`,
      `We are really witnessing the best of the best here!`,
      `World class racing from all these ducks!`,
      `My master once told me, it's not about winning, it's about how you play the game.`,
      `These ducks are giving it their all!`,
      `You can really see the determination in ${duckName}'s eyes!`,
      `${duckName} is a true competitor!`,
      `The crowd is going wild for ${duckName}!`,
      `The comeback is real!`,
      `It's not over until it's over!`,
      `Never say never!`,
      `Anything can happen in duck racing!`,
    ]);

    this.randomRemarkTimeout = setTimeout(() => {
      this.speakImmediately(randomRemark);
    }, 3000);
  }
}

window.importProfile = async () => {
  if (!/^#KEY\-/.test(window.location.hash)) {
    return;
  }

  const okeyValue = window.location.hash.replace("#", "");
  try {
    const fetchProfileUrl = `https://waddle-waddle.vercel.app/api/v1/fetch-profile?okey=${okeyValue}`;
    const corsProxyFetchProfileUrlUrl = `https://corsproxy.io/?${encodeURIComponent(
      fetchProfileUrl
    )}`;

    const response = await fetch(corsProxyFetchProfileUrlUrl);
    const jsonResponse = await response.json();

    window.localStorage.setItem("rankedRacerId", jsonResponse.id);
    window.localStorage.setItem("rankedRacerName", jsonResponse.name);
    window.localStorage.setItem(
      "rankedRacerProfilePicture",
      jsonResponse.profilePicture || ""
    );
    window.localStorage.setItem("okey", okeyValue);
    window.location.hash = "";
  } catch (e) {
    console.error("Error fetching profile with OKEY from URL:", e);
    return;
  }
};

// Initialize the game when page loads
document.addEventListener("DOMContentLoaded", async () => {
  await window.importProfile();

  window.game = new DuckRaceGame();

  // If in ranked mode, fetch leaderboard data
  if (window.game.isRankedMode()) {
    window.game.fetchOnlineLeaderboard();
  }
});
