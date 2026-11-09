# ChessWake instructions for coding agents

ChessWake is a macOS Electron alarm. A user can ask you to install this repo and set a daily alarm in plain language. Translate times to the Mac's **local 24-hour time**. For example, “4am” means `04:00`.

## Install and set an alarm

1. Verify this is a Mac, check its local time zone, and ensure Node.js 20.19+ or 22.12+ is available.
2. Run `npm ci`, `npm test`, and `npm run package:mac` in this repository.
3. Quit ChessWake if it is already running. Run `npm run alarm:set -- --time 04:00 --label "Wake up"`, substituting the requested time and label.
4. Run `npm run alarm:list` and verify the time and enabled status.
5. Open the built `ChessWake.app` from `release/mac-arm64/` or the matching architecture folder. Confirm the alarm appears in the app.
6. Run Test Alarm, confirm that sound plays, and solve the test puzzle. If you cannot observe or hear it, tell the user the test is unverified.

Do not claim a scheduled alarm will work unless the app remains running, the Mac stays awake, and sound is enabled. A sleeping Mac or closed laptop lid can prevent an alarm from firing on time. ChessWake does not bypass macOS sleep restrictions. It does not start automatically at login.

The app uses Chess.com's documented public puzzle API and a local cache. No Chess.com account or login is needed. Do not ask for credentials.

## Development

- `npm run dev` keeps Terminal occupied; closing that Terminal stops the development app.
- `npm test` runs the domain and alarm command tests.
- `npm run build` checks TypeScript and builds the renderer.
- `npm run package:mac` creates an unsigned DMG and `.app` in `release/`.
- `npm run alarm:set -- --time HH:MM` writes local settings. Quit the app before using it, then relaunch.
- `npm run alarm:list` checks saved alarms.
