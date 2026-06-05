export function createAppRuntimeController({
  boardSelector = "#board svg",
  devReloadPath = "/dev-reload",
  serviceWorkerPath = "./sw.js",
} = {}) {
  let devReloadSource = null;

  function cancelBoardInput() {
    document.querySelector(boardSelector)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
  }

  function handleKeydown(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    cancelBoardInput();
  }

  function requestPortraitOrientation() {
    screen.orientation?.lock?.("portrait").catch(() => {});
  }

  function bind() {
    window.addEventListener("keydown", handleKeydown, { capture: true });
    requestPortraitOrientation();
    window.addEventListener("orientationchange", requestPortraitOrientation);

    if ("serviceWorker" in navigator) navigator.serviceWorker.register(serviceWorkerPath).catch(() => {});
    if (["localhost", "127.0.0.1"].includes(location.hostname)) {
      devReloadSource = new EventSource(devReloadPath);
      devReloadSource.onmessage = (event) => {
        if (event.data === "reload") location.reload();
      };
    }
  }

  function dispose() {
    window.removeEventListener("keydown", handleKeydown, { capture: true });
    window.removeEventListener("orientationchange", requestPortraitOrientation);
    devReloadSource?.close();
    devReloadSource = null;
  }

  return {
    bind,
    dispose,
  };
}
