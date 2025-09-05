# Duck Race Game 🦆

A real-time duck racing game with skills, profile pictures, and server-side race simulation.

## Features

- **Interactive Racing**: Real-time duck racing with customizable racers
- **Skills System**: Boost, Bomb, Splash, Immune, Lightning, and Magnet skills
- **Profile Pictures**: Upload and display custom profile pictures for racers
- **Winner Overlay**: Celebration overlay when race finishes
- **Server API**: Node.js Express server for race simulation
- **Discord Integration**: Optional webhook support for race results
- **Social Media Ready**: Open Graph meta tags for sharing

## Quick Start

### Running the Game

1. Open `index.html` in a web browser
2. Add racers with names and optional profile pictures
3. Click "Start Race" to begin

### Running the Server

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server:

   ```bash
   npm start
   ```

3. Server will run on `http://localhost:3000`

## API Endpoints

### POST `/api/race`

Simulate a race with given participants.

**Request Body:**

```json
{
  "title": "Race Title",
  "participants": [
    {
      "id": "1",
      "name": "Duck 1",
      "profile": "base64_image_or_url",
      "color": "#ffcc00"
    }
  ],
  "discordWebhookUrl": "https://discord.com/api/webhooks/..." // Optional
}
```

**Response:**

```json
{
  "success": true,
  "race": {
    "title": "Race Title",
    "duration": 45000,
    "winner": { "name": "Duck 1", "finishTime": 45000 },
    "standings": [...],
    "events": [...],
    "config": {...}
  }
}
```

### GET `/health`

Health check endpoint.

## File Structure

- `index.html` - Main game interface
- `duck-race.js` - Client-side game engine
- `styles.css` - Game styling
- `server.js` - Express API server
- `race-simulator.js` - Race simulation engine
- `package.json` - Dependencies and scripts
- `favicon.svg` - Yellow duck favicon

## Skills System

- **Boost** 🚀: Temporary speed increase
- **Bomb** 💣: Stun the leading duck
- **Splash** 💧: Slow all ducks, boost self based on affected count
- **Immune** 🛡️: Protection from other skills
- **Lightning** ⚡: Stun all other ducks (last place only)
- **Magnet** 🧲: Speed boost based on distance from leader (last place only)

## Development

The codebase is modular:

- Game logic is in `duck-race.js`
- Race simulation is extracted to `race-simulator.js`
- Server provides API endpoints in `server.js`

## Discord Integration

Set the `discordWebhookUrl` in race requests to automatically post results to Discord with formatted embeds showing winner and standings.
