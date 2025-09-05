const express = require("express");
const cors = require("cors");
const { simulateRace } = require("./race-simulator");
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Allow large base64 images

// API endpoint
app.post("/api/race", async (req, res) => {
  try {
    const { title, participants, discordWebhookUrl } = req.body;

    // Validation
    if (!title || typeof title !== "string") {
      return res
        .status(400)
        .json({ error: "Title is required and must be a string" });
    }

    if (
      !participants ||
      !Array.isArray(participants) ||
      participants.length === 0
    ) {
      return res
        .status(400)
        .json({
          error: "Participants array is required and must not be empty",
        });
    }

    // Validate participants
    for (const participant of participants) {
      if (!participant.id || !participant.name) {
        return res
          .status(400)
          .json({ error: "Each participant must have id and name" });
      }
    }

    console.log(
      `🏁 Starting race: "${title}" with ${participants.length} participants`
    );

    // Simulate the race
    const result = simulateRace(title, participants);

    // Send to Discord webhook if provided
    if (discordWebhookUrl) {
      try {
        const fetch = (await import("node-fetch")).default;
        const winner = result.race.winner;
        const embed = {
          title: `🦆 ${title} 🏁`,
          description: `**🏆 Winner: ${winner.name}** - \`${(
            winner.finishTime / 1000
          ).toFixed(2)}s\`\n\n**📊 Final Standings:**\n${result.race.standings
            .slice(0, 10)
            .map((duck, i) => {
              const medal =
                i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
              return `${medal} **${duck.name}** - \`${(
                duck.finishTime / 1000
              ).toFixed(2)}s\``;
            })
            .join("\n")}`,
          color: 0xffd700,
          footer: {
            text: `Race completed in ${(result.race.duration / 1000).toFixed(
              2
            )} seconds`,
          },
          timestamp: new Date().toISOString(),
        };

        await fetch(discordWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ embeds: [embed] }),
        });

        console.log("✅ Discord webhook sent successfully");
      } catch (webhookError) {
        console.error("❌ Discord webhook failed:", webhookError.message);
      }
    }

    console.log(`🎉 Race completed! Winner: ${result.race.winner.name}`);
    res.json(result);
  } catch (error) {
    console.error("❌ Race simulation error:", error);
    res.status(500).json({
      error: "Race simulation failed",
      message: error.message,
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Duck Race Server is running!" });
});

// Start server
app.listen(port, () => {
  console.log(`🦆 Duck Race Server running on http://localhost:${port}`);
  console.log(`📡 Race endpoint: POST http://localhost:${port}/api/race`);
  console.log(`🏥 Health check: GET http://localhost:${port}/health`);
});

module.exports = app;
