import {
  BotSplash,
  DevTestingButton,
  FriendAddDialog,
  GameView,
  Lobby,
  NotificationNotice,
} from "./components/AppScreens.jsx";
import { useChessquestiaApp } from "./useChessquestiaApp.js";

export default function App() {
  useChessquestiaApp();

  return (
    <>
      <div className="app">
        <Lobby />
        <GameView />
        <NotificationNotice />
        <DevTestingButton />
        <BotSplash />
        <FriendAddDialog />
      </div>
      <div className="orientation-lock" role="status" aria-live="polite">
        <div>Rotate back to portrait</div>
      </div>
    </>
  );
}
