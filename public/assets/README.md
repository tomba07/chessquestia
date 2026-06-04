# Asset Layout

Use stable public paths under `/assets` because the app references these files at runtime.

- `app-icons/`: favicon, PWA, and platform install icons.
- `backgrounds/`: game, UI, and opponent background art. Deprecated variants live in `backgrounds/archive/`.
- `bots/<character>/`: opponent portrait art grouped by character. Use `default.png`, `talk.png`, `thinking.png`, `angry.png`, `surprised.png`, `laughing.png`, `sad.png`, and `win.png` when available.
- `buttons/`: bitmap button frames.
- `cards/`: opponent selection and unlock cards.
- `icons/`: small UI icons.
- `misc/`: temporary or uncategorized art that should be promoted to a dedicated folder once it is used by the app.
- `splash/desktop/`: desktop opponent splash backgrounds.
- `splash/mobile/`: mobile opponent splash backgrounds.
- `splash/ui/`: shared splash UI overlays and icons.
