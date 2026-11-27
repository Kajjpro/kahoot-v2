# Dash, the quiz race

A live quiz game in the style of Kahoot. The host builds a quiz and opens a lobby. Players join from their phones with a 6-digit code and a name, and the fastest right answer earns the most points. Standings are shown as a race, and the game ends with an animated podium.

## Question types

| Type | What players do | How it scores |
| --- | --- | --- |
| Multiple choice | Tap one of 2–6 answers (you can mark several as right) | Right or wrong |
| Poll | Multiple choice with no answer marked right | No points, just shows the votes |
| True or false | Tap True or False | Right or wrong |
| Guess the number | Slide to a number | Closer guesses get more points |
| Put in order | Drag items into order | Partial points per item in the right spot |
| Type it | Type the answer | Forgives case, accents and small typos. Works with Cyrillic |
| Tap the spot | Tap a place on a picture | Full points inside the circle, fewer the farther away |

Every question can also have a picture, a time limit (5 s to 2 min) and normal, double or no points.

**Scoring:** an instant right answer earns 1000 points and one right at the buzzer earns 500, so speed always counts. Getting several right in a row adds a streak bonus of +100 per answer, up to +500.

**A question ends** as soon as every connected player has answered, or when the time runs out, whichever comes first.

## Run it on your computer

You need Node 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. To play with phones on the same Wi-Fi, open `http://<your-mac-ip>:3000` on the phone. You can find the IP in System Settings → Wi-Fi → Details.

Other commands:

```bash
npm test         # scoring checks
npm run sim      # plays a full game with 5 bots (needs the server running)
npm run build    # production build
npm start        # run the production build
```

## Deploy

The game keeps a live Socket.io connection open, so it needs a host that runs a long-lived Node server. **Vercel won't work** for the live part. Render and Railway both work and have free tiers.

### Render (easiest)

1. Push this folder to a GitHub repo.
2. On render.com, choose **New → Blueprint**, pick the repo, and Render reads `render.yaml`.
   Or choose **New → Web Service** and set:
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
3. Open the URL Render gives you. That URL is what players type in.

Free Render services go to sleep when nobody uses them, so the first visit can take about 30 seconds to wake up.

### Railway

New Project → Deploy from GitHub repo. Railway detects Node and runs `npm run build` and `npm start` automatically.

**Important:** game rooms live in the server's memory, so run **one** instance only (don't scale it to several). A server restart ends any game in progress.

## How it's built

```
server.ts                   Next.js and Socket.io in one Node process
src/server/room.ts          game rules: phases, timers, scoring, what each person can see
src/server/game-server.ts   socket events → room actions
src/shared/                 types, scoring and validation used by both sides
src/app/                    pages: / (join), /play, /host, /host/edit, /host/live
src/components/             avatars, start lights, race leaderboard, podium, answer controls
```

The server holds the right answers. Players' phones only get the question until time is up, so nobody can peek at answers in dev tools. Quizzes are saved in the host's browser (localStorage), so they stay on that computer.

**Keyboard:** on the host screen, Space, Enter or → moves to the next step.
