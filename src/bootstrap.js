const isLocalDev = ["localhost", "127.0.0.1"].includes(location.hostname);

if (isLocalDev) {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  }
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith("chessquestia-"))
        .map(name => caches.delete(name)),
    );
  }
}

await import("./main.jsx");
