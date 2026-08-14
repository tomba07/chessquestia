# Asset Layout

Use stable public paths under `/assets` because the app references these files at runtime.

- `app-icons/`: favicon, PWA, and platform install icons.
- `backgrounds/`: current lobby/game backgrounds and opponent splash art, named by opponent theme.
- `bots/<character>/`: opponent portrait art grouped by character. Use `default.png`, `talk.png`, `thinking.png`, `angry.png`, `surprised.png`, `laughing.png`, `sad.png`, and `win.png` when available.
- `misc/`: shared mode art such as the Solo and Co-op home card illustrations.
