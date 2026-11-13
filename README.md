# ChessWake

Security findings and distribution risks are documented in [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

ChessWake is a local macOS chess puzzle alarm. Daily alarms and wake-up history are saved on this Mac. A test alarm rings 10 seconds after you arm it. When an alarm rings, ChessWake brings its window forward, enters fullscreen, stays on top, and repeats a chime. Drag a piece, or click it and then its destination. Correct moves advance the puzzle and ChessWake plays the opponent's reply and highlights it. A legal checkmate stops the alarm and shows a finish screen with your solve time; a legal but wrong move flashes red and resets the puzzle. Clicks on squares a piece cannot reach are ignored.

The main window is a scoreboard built from real alarms: current and best streak of solved mornings, average and fastest solve time, a month calendar, and recent mornings. Test alarms are never counted. Alarm setup and the puzzle library sit behind **Manage alarms**.

ChessWake includes one credited Chess.com mate-in-two puzzle so it works offline immediately. When online, it checks Chess.com's documented daily and random daily puzzle API on launch and every 20 minutes. It saves up to 30 distinct puzzles locally. Only puzzles that end in checkmate within three player moves are accepted; `chess.js` checks each move and the final position. Chess.com does not provide a difficulty filter through this API, so saved puzzles may be harder than a 300–500 rating. The original beginner mate-in-one puzzles remain as a fallback if the local Chess.com cache is missing or invalid. No Chess.com account is required.

The board uses an independent color palette and open licensed Chessnut pieces. ChessWake is not affiliated with Chess.com. See [ATTRIBUTIONS.md](ATTRIBUTIONS.md).

## Launch locally

You need macOS and Node.js 20.19+ or 22.12+.

```bash
git clone https://github.com/carlosrgutierrez/chesswake.git
cd chesswake
npm ci
npm run dev
```

Keep the terminal and ChessWake process running. Closing its window hides it; use the menu bar chess icon to reopen or quit. To run a built copy instead:

```bash
npm run build
npm start
```

If your shell has `ELECTRON_RUN_AS_NODE=1` set, unset it first with `unset ELECTRON_RUN_AS_NODE`.

## Set an alarm from the terminal or an AI agent

The command uses your Mac's local time and saves a daily recurring alarm. For 4:00 AM:

```bash
npm run alarm:set -- --time 04:00 --label "Wake up"
npm run alarm:list
```

Set the alarm while ChessWake is closed, then launch the app. If it is already running, quit and relaunch it so the new setting is loaded. The command does not launch the app for you. To run without keeping Terminal open, build the macOS app and open it from Finder:

```bash
npm run package:mac
```

Open `release/mac-arm64/ChessWake.app` on Apple Silicon, or the equivalent app folder created for your Mac. Keep ChessWake running for alarms to fire. The app does not automatically start at login. Run the Test Alarm and confirm you can hear it before relying on a scheduled alarm.

## Tests

```bash
npm test
npm run build
```

The tests verify daily scheduling, Chess.com puzzle parsing, legal checkmates, automatic replies, wrong-move resets, and the emergency-stop threshold.

## Package for macOS

```bash
npm run package:mac
```

The unsigned DMG is written to `release/`. On a different Mac, macOS Gatekeeper may require an explicit **Open** from Finder. This build is not notarized. Packaging does not install a login item; start ChessWake yourself and leave it running.

## Safety and reliability

After an alarm has rung for two minutes, an emergency stop appears. You must press and hold its button for three seconds. There is no snooze button. The menu bar Quit action and normal app Quit command are disabled during an active alarm, though macOS can always force quit an app.

**Alarms are not reliable while the Mac sleeps or the laptop lid is closed. ChessWake does not bypass macOS sleep restrictions.** Keep the Mac awake, powered, with its lid open, sound enabled, and ChessWake running when you need an alarm. It is not a substitute for a separate reliable wake-up alarm.

Settings, history, and cached Chess.com puzzles live in Electron's local user data folder, normally `~/Library/Application Support/chesswake/chesswake.json`. The alarm works without internet after installation. Internet is used only to refresh the optional puzzle cache.
