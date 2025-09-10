// Race Simulator - Advanced Duck Racing Engine
// Logs every skill use and every time step with meters traveled

const RACE_CONFIG = {
  distance: 4000, // Total race distance in meters
  baseSpeed: 100, // Base speed: 100 meters per second
  duration: 40000, // Expected race duration: 40 seconds in milliseconds
  timeStep: 100, // Simulation time step in milliseconds (0.1 second)
  skills: {
    boost: {
      name: "Boost",
      speedMultiplier: 1.3, // 30% speed increase
      duration: [2, 4], // 2-4 seconds
      cooldown: [5, 8], // 5-8 seconds cooldown
    },
    bomb: {
      name: "Bomb",
      stunDuration: [2, 3], // 2-3 seconds stun
      cooldown: [5, 8], // 5-8 seconds cooldown
    },
    splash: {
      name: "Splash",
      speedReduction: 0.2, // 20% speed reduction to others
      duration: [2, 3], // 2-3 seconds
      cooldown: [5, 8], // 5-8 seconds cooldown
    },
    immune: {
      name: "Immune",
      duration: [3, 5], // 3-5 seconds immunity
      cooldown: [5, 8], // 5-8 seconds cooldown
    },
    lightning: {
      name: "Lightning",
      stunDuration: 1.5, // 1.5 seconds stun to all
      cooldown: [5, 8], // 5-8 seconds cooldown
    },
    magnet: {
      name: "Magnet",
      maxBoost: 0.8, // Up to 80% speed increase
      duration: [3, 4], // 3-4 seconds
      cooldown: [5, 8], // 5-8 seconds cooldown
    },
  },
};

class RaceDuck {
  // eslint-disable-next-line no-unused-vars
  constructor(participant, index, _mode = "casual") {
    this.id = participant.id;
    this.name = participant.name || `Duck ${index + 1}`;
    this.profilePicture = participant.profile || null;

    // Race state
    this.metersTraveled = 0;
    this.position = index + 1;
    this.finished = false;
    this.finishTime = null;
    this.baseSpeed = RACE_CONFIG.baseSpeed; // All racers start at same speed (100 m/s)
    this.currentSpeed = this.baseSpeed;

    // Status effects (in seconds remaining)
    this.stunned = 0;
    this.boosted = 0;
    this.immune = 0;
    this.splashAffected = 0;
    this.magnetBoosted = 0;

    // Skill cooldowns (in seconds remaining)
    this.cooldowns = {
      boost: 2 + Math.random() * 2, // Initial delay of 2-4 seconds
      bomb: 2 + Math.random() * 2,
      splash: 2 + Math.random() * 2,
      immune: 2 + Math.random() * 2,
      lightning: 2 + Math.random() * 2,
      magnet: 2 + Math.random() * 2,
    };

    // Next time this duck can attempt to use any skill (in milliseconds)
    this.nextSkillTime = (2 + Math.random() * 2) * 1000; // 2-4 seconds initial delay

    // this.skillsUsed = [];
  }

  // Update duck state for one time step
  updateTimeStep(currentTime, allDucks, eventLog) {
    if (this.finished) return;

    const timeStepSeconds = RACE_CONFIG.timeStep / 1000; // Convert to seconds for calculations

    // Update status effects (decrease by time step)
    this.updateStatusEffects(timeStepSeconds);

    // Calculate current speed
    this.calculateSpeed();

    // Try to use a skill (reduced probability to maintain original rates)
    this.tryUseSkill(currentTime, allDucks, eventLog);

    // Move duck if not stunned
    if (this.stunned <= 0) {
      this.metersTraveled += this.currentSpeed * timeStepSeconds;

      // Check if finished
      if (this.metersTraveled >= RACE_CONFIG.distance && !this.finished) {
        this.finished = true;
        this.finishTime =
          currentTime + // Keep time in milliseconds
          ((RACE_CONFIG.distance -
            (this.metersTraveled - this.currentSpeed * timeStepSeconds)) /
            this.currentSpeed) *
            1000; // Convert remaining time to milliseconds

        eventLog.push({
          t: currentTime, // Time in milliseconds (compressed: time -> t)
          id: this.id, // Duck ID (compressed: duck -> id, using duck.id instead of duck.name)
          ft: Math.floor(this.finishTime), // Floored integer finish time (compressed: finishTime -> ft)
          // Note: Removed 'type' field - can determine finish by presence of 'ft' field
          // Note: Removed 'meters' field - unnecessary as track length is always 4000m
        });
      }
    }

    // Update skill cooldowns
    this.updateCooldowns(timeStepSeconds);
  }

  updateStatusEffects(timeStepSeconds) {
    this.stunned = Math.max(0, this.stunned - timeStepSeconds);
    this.boosted = Math.max(0, this.boosted - timeStepSeconds);
    this.immune = Math.max(0, this.immune - timeStepSeconds);
    this.splashAffected = Math.max(0, this.splashAffected - timeStepSeconds);
    this.magnetBoosted = Math.max(0, this.magnetBoosted - timeStepSeconds);
  }

  calculateSpeed() {
    this.currentSpeed = this.baseSpeed;

    // Apply boost
    if (this.boosted > 0) {
      this.currentSpeed *= RACE_CONFIG.skills.boost.speedMultiplier;
    }

    // Apply splash effect (speed reduction)
    if (this.splashAffected > 0) {
      this.currentSpeed *= 1 - RACE_CONFIG.skills.splash.speedReduction;
    }

    // Apply magnet boost
    if (this.magnetBoosted > 0) {
      this.currentSpeed *= 1 + this.magnetBoostAmount;
    }
  }

  updateCooldowns(timeStepSeconds) {
    Object.keys(this.cooldowns).forEach((skill) => {
      this.cooldowns[skill] = Math.max(
        0,
        this.cooldowns[skill] - timeStepSeconds
      );
    });
  }

  tryUseSkill(currentTime, allDucks, eventLog) {
    // Stunned racers cannot use skills
    if (this.stunned > 0) return;

    // Check if enough time has passed since last skill attempt
    if (currentTime < this.nextSkillTime) return;

    // Get available skills with position restrictions
    const availableSkills = this.getAvailableSkills(allDucks);

    if (availableSkills.length === 0) {
      // No skills available, try again in 1 second
      this.nextSkillTime = currentTime + 1000;
      return;
    }

    const selectedSkill =
      availableSkills[Math.floor(Math.random() * availableSkills.length)];
    this.useSkill(selectedSkill, currentTime, allDucks, eventLog);

    // Set next skill time: 5-8 seconds from now
    this.nextSkillTime = currentTime + (5 + Math.random() * 3) * 1000;
  }

  getAvailableSkills(allDucks) {
    const skills = [];

    // All ducks can use these skills if not on cooldown
    if (this.cooldowns.boost <= 0) skills.push("boost");
    if (this.cooldowns.bomb <= 0) skills.push("bomb");
    if (this.cooldowns.splash <= 0) skills.push("splash");
    if (this.cooldowns.immune <= 0) skills.push("immune");

    // Lightning and Magnet can only be used by last place (among unfinished ducks)
    const unfinishedDucks = allDucks.filter((duck) => !duck.finished);
    const isLastPlace =
      unfinishedDucks.length > 0 && this.position === unfinishedDucks.length;

    if (isLastPlace) {
      if (this.cooldowns.lightning <= 0) skills.push("lightning");
      if (this.cooldowns.magnet <= 0) skills.push("magnet");
    }

    return skills;
  }

  useSkill(skillName, currentTime, allDucks, eventLog) {
    const skill = RACE_CONFIG.skills[skillName];
    if (!skill || this.cooldowns[skillName] > 0) return;

    // Set cooldown (now with random range)
    this.cooldowns[skillName] = this.randomInRange(skill.cooldown);
    // this.skillsUsed.push(skillName);

    const event = {
      t: currentTime, // Time in milliseconds (compressed: time -> t)
      id: this.id, // Duck ID (compressed: duck -> id, using duck.id instead of duck.name)
      s: skillName, // Skill name (compressed: skill -> s)
      // Note: Removed 'type' field - can determine skill vs finish by presence of 's' field
    };

    switch (skillName) {
      case "boost":
        // Clear other buffs (only latest buff active)
        this.immune = 0;
        this.magnetBoosted = 0;
        this.magnetBoostAmount = 0;

        const boostDuration = this.randomInRange(skill.duration);
        this.boosted = boostDuration;
        event.d = Math.floor(boostDuration * 1000); // Convert to floored milliseconds (compressed: duration -> d)
        break;

      case "immune":
        // Clear other buffs (only latest buff active)
        this.boosted = 0;
        this.magnetBoosted = 0;
        this.magnetBoostAmount = 0;

        const immuneDuration = this.randomInRange(skill.duration);
        this.immune = immuneDuration;
        event.d = Math.floor(immuneDuration * 1000); // Convert to floored milliseconds (compressed: duration -> d)
        break;

      case "bomb":
        // Target logic: if leader finished, target leading unfinished duck, otherwise nearest ahead
        let vulnerableAheadUnfinishedThatIsNotMeDucks = allDucks.filter(
          (duck) =>
            duck !== this &&
            !duck.finished &&
            duck.immune <= 0 &&
            duck.metersTraveled > this.metersTraveled
        );

        if (vulnerableAheadUnfinishedThatIsNotMeDucks.length > 0) {
          let target = vulnerableAheadUnfinishedThatIsNotMeDucks.reduce(
            (leader, duck) =>
              duck.metersTraveled > leader.metersTraveled ? duck : leader
          );

          if (target) {
            // Clear other debuffs (only latest debuff active)
            target.splashAffected = 0;

            const stunDuration = this.randomInRange(skill.stunDuration);
            target.stunned = stunDuration;
            event.ta = target.name; // Compressed: target -> ta
            event.sd = Math.floor(stunDuration * 1000); // Convert to floored milliseconds (compressed: stunDuration -> sd)
          }
        }
        break;

      case "splash":
        // Affect ducks within range (behind and ahead)
        let affectedCount = 0;
        allDucks.forEach((duck) => {
          if (
            duck !== this &&
            Math.abs(duck.metersTraveled - this.metersTraveled) <= 200 &&
            duck.immune <= 0 &&
            !duck.finished
          ) {
            // Clear other debuffs (only latest debuff active)
            duck.stunned = 0;

            const splashDuration = this.randomInRange(skill.duration);
            duck.splashAffected = splashDuration;
            affectedCount++;
          }
        });
        event.ac = affectedCount; // Compressed: affectedCount -> ac
        event.d = Math.floor(this.randomInRange(skill.duration) * 1000); // Convert to floored milliseconds (compressed: duration -> d)
        break;

      case "lightning":
        // Stun all other ducks
        let stunnedCount = 0;
        allDucks.forEach((duck) => {
          if (duck !== this && duck.immune <= 0 && !duck.finished) {
            // Clear other debuffs (only latest debuff active)
            duck.splashAffected = 0;

            duck.stunned = skill.stunDuration;
            stunnedCount++;
          }
        });
        event.sc = stunnedCount; // Compressed: stunnedCount -> sc
        event.sd = Math.floor(skill.stunDuration * 1000); // Convert to floored milliseconds (compressed: stunDuration -> sd)
        break;

      case "magnet":
        // Magnet logic: always attach to the current leader
        const aheadUnfinishedThatIsNotMeDucks = allDucks.filter(
          (duck) =>
            duck !== this &&
            !duck.finished &&
            duck.metersTraveled > this.metersTraveled
        );

        if (0 === aheadUnfinishedThatIsNotMeDucks.length) {
          // Magnet had no effect (targeting self or no valid target) - don't clear buffs
          event.bp = 0; // No boost applied
          event.d = 0; // No duration
          event.targetDuck = this.name; // Show it targeted self (no effect)
          break;
        }

        const targetDuck = aheadUnfinishedThatIsNotMeDucks.reduce(
          (leader, duck) =>
            duck.metersTraveled > leader.metersTraveled ? duck : leader
        );

        // Clear other buffs only when magnet actually works (only latest buff active)
        this.boosted = 0;
        this.immune = 0;

        // Boost based on caster's position relative to target (better boost if further behind)
        const myPosition =
          aheadUnfinishedThatIsNotMeDucks.filter(
            (duck) => duck.metersTraveled > this.metersTraveled
          ).length + 1;
        const totalDucks = aheadUnfinishedThatIsNotMeDucks.length;
        const positionFactor = myPosition / totalDucks; // 0.2 to 1.0 (worse position = higher boost)
        const boostPercent = skill.maxBoost * positionFactor;

        this.magnetBoostAmount = boostPercent;
        const magnetDuration = this.randomInRange(skill.duration);
        this.magnetBoosted = magnetDuration;

        event.bp = boostPercent; // Compressed: boostPercent -> bp
        event.d = Math.floor(magnetDuration * 1000); // Convert to floored milliseconds (compressed: duration -> d)
        event.targetDuck = this.name; // Track who got the boost (the caster)

        break;
    }

    eventLog.push(event);
  }

  randomInRange(range) {
    if (Array.isArray(range)) {
      return range[0] + Math.random() * (range[1] - range[0]);
    }
    return range;
  }
}

function simulateRace({ participants, mode }) {
  console.log(
    `🏁 Starting ${mode} race simulation with ${participants.length} ducks`
  );

  // Create duck instances
  const ducks = participants.map((p, i) => new RaceDuck(p, i, mode));

  // Race tracking
  const eventLog = [];
  const secondlyProgress = [];

  // Log initial state
  secondlyProgress.push({
    time: 0, // Time in milliseconds
    positions: ducks.map((duck) => ({
      id: duck.id,
      metersTraveled: 0,
    })),
  });

  // Race simulation loop - one iteration per 100ms (0.1 second)
  let currentTime = 0; // Time in milliseconds
  let lastProgressLog = 0; // Track when we last logged progress
  const maxTime = 60000; // Maximum 60 seconds in milliseconds

  while (currentTime < maxTime && ducks.some((duck) => !duck.finished)) {
    currentTime += RACE_CONFIG.timeStep;

    // Update all ducks for this time step
    ducks.forEach((duck) => {
      duck.updateTimeStep(currentTime, ducks, eventLog);
    });

    // Update positions
    const activeDucks = ducks.filter((d) => !d.finished);
    activeDucks.sort((a, b) => b.metersTraveled - a.metersTraveled);
    activeDucks.forEach((duck, index) => {
      duck.position = index + 1;
    });

    // Log progress every 500ms (0.5 seconds) for smoother animation
    if (currentTime - lastProgressLog >= 500) {
      const timeData = {
        t: currentTime, // Time in milliseconds (compressed: time -> t)
        p: ducks.map((duck) => ({
          // Positions (compressed: positions -> p)
          i: duck.id, // ID (compressed: id -> i)
          mt: Math.round(duck.metersTraveled * 10) / 10, // Meters traveled (compressed: metersTraveled -> mt)
        })),
      };

      secondlyProgress.push(timeData);
      lastProgressLog = currentTime;
    }
  }

  // Final standings
  const allDucksSorted = [...ducks].sort((a, b) => {
    if (a.finished && b.finished) {
      return a.finishTime - b.finishTime;
    }
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.metersTraveled - a.metersTraveled;
  });

  const standings = allDucksSorted.map((duck, index) => ({
    position: index + 1,
    id: duck.id,
    name: duck.name,
    profilePicture: duck.profilePicture,
    metersTraveled: Math.round(duck.metersTraveled),
    finished: duck.finished,
    finishTime: duck.finishTime,
    // skillsUsed: duck.skillsUsed,
  }));

  const raceResults = {
    standings,
    events: eventLog,
    secondlyProgress,
    duration: currentTime, // Keep duration in milliseconds
    config: RACE_CONFIG,
  };

  console.log(
    `🏆 Race completed in ${raceResults.duration.toFixed(1)} seconds`
  );
  console.log(`📊 ${eventLog.length} events logged`);
  console.log("🥇 Winner:", standings[0].name);

  return raceResults;
}

// Export for browser/Node.js compatibility
if (typeof module !== "undefined" && module.exports) {
  module.exports = { simulateRace, RaceDuck, RACE_CONFIG };
} else if (typeof window !== "undefined") {
  window.simulateRace = simulateRace;
  window.RaceDuck = RaceDuck;
  window.RACE_CONFIG = RACE_CONFIG;
}
