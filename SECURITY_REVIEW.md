# ChessWake security review — 2026-11-09

This is a source and local build review, not a guarantee against every vulnerability. It covers the repository source, npm dependencies, Electron boundary, local data, network use, and GitHub settings checked on 2026-11-09.

## Fixed in this review

- Updated Electron from 39 to 45.2.3. The old dependency tree had two high severity npm advisories; the current tree has zero high or critical advisories. One Electron advisory concerns untrusted sandboxed iframes, which ChessWake does not use, so the audit severity should not be read as proof that the app was exploitable through that path.
- Enabled the renderer sandbox, added a restrictive production Content Security Policy, blocked page navigation and permission requests, and checked the sender and page URL for every IPC request. Packaged builds ignore development URLs. These changes limit what a compromised renderer can reach.
- Set the local settings file to owner only permissions (`0600`), including when loading an existing file. The file contains alarm times, labels, wake history, and cached puzzles.

## Remaining risks and limits

1. `npm audit` reports **six moderate** findings in `minimatch` and the `electron-builder` dependency chain. They affect local build tooling, not code loaded by the packaged app. `npm audit --omit=dev` reports zero. Keep the lockfile and builder updated; review future advisories before rebuilding.
2. The DMG is **unsigned and not notarized**. Friends must obtain it or build it from the intended repository and should verify the repo owner and commit before running `npm ci`. Installing dependencies runs package scripts on their Mac. Do not run the build as root. Signing and notarization would improve identity and distribution checks if this becomes a wider release.
3. GitHub secret scanning and push protection were enabled when checked. Dependabot security updates were disabled and `main` had no branch protection. Carlos should enable security updates and protect `main` if the project will be maintained or shared widely. These settings were not changed in this review.
4. Puzzle refresh sends HTTPS requests from the main process to Chess.com's public API. Chess.com can see the requesting IP. Opening a puzzle's original page opens `www.chess.com` in the default browser. No Chess.com credentials are needed or stored. Cached puzzles allow offline alarm use.
5. The alarm cannot be treated as a safety critical wake-up device: macOS sleep, a closed lid, muted sound, a quit app, and power loss can prevent it from ringing on time. The fullscreen puzzle and two minute emergency stop are interaction controls, not security boundaries.

## Checks performed

- Reviewed tracked files for embedded credentials and personal paths; none found. This does not prove a token was never present in an older commit or in a private local file.
- Ran the test suite and macOS package build, then launched the packaged app. The preload bridge worked in sandbox mode, the production CSP was present, and a navigation attempt to an external URL was blocked.
- Checked `npm audit`, the GitHub repository security settings, and the absence of `main` branch protection.

For the basis of the Electron controls, see the [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security/). For distribution requirements, see [Apple's distribution overview](https://developer.apple.com/documentation/technologyoverviews/distribution).
