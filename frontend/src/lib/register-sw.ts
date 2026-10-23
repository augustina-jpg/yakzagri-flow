export const SW_UPDATE_AVAILABLE_EVENT = "amana:sw-update-available";

export function registerServiceWorker(onUpdateAvailable?: (waiting: ServiceWorker) => void) {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const notifyWaiting = (worker: ServiceWorker) => {
    onUpdateAvailable?.(worker);
    window.dispatchEvent(
      new CustomEvent(SW_UPDATE_AVAILABLE_EVENT, { detail: { waiting: worker } }),
    );
  };

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[SW] Service worker registered");

        if (registration.waiting) {
          notifyWaiting(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              notifyWaiting(installing);
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[SW] Service worker registration failed:", err);
      });

    // Reload once the new SW takes control so the page is served by it.
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
