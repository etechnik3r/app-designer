/* Verbindung zum Player im iframe.
   Bewusst schmal gehalten: der Editor schickt ganze Zustaende,
   der Player schickt Absichten zurueck. Deltas in beide Richtungen
   waeren sparsamer, aber die haeufigste Fehlerklasse solcher
   Werkzeuge sind auseinanderlaufende Zustaende.                    */

export function createBridge(iframe, handlers = {}) {
  let ready = false;
  const queue = [];

  function post(message) {
    if (!ready) { queue.push(message); return; }
    iframe.contentWindow?.postMessage({ __party: true, ...message }, "*");
  }

  function onMessage(event) {
    if (event.source !== iframe.contentWindow) return;
    const msg = event.data;
    if (!msg || msg.__party !== true) return;

    switch (msg.type) {
      case "ready":
        ready = true;
        while (queue.length) {
          iframe.contentWindow?.postMessage({ __party: true, ...queue.shift() }, "*");
        }
        handlers.onReady?.();
        break;
      case "patch":
        handlers.onPatch?.(msg.path, msg.value, msg.editId);
        break;
      case "click":
        handlers.onClick?.(msg.path);
        break;
      case "view":
        handlers.onView?.(msg.view);
        break;
      case "hint":
        handlers.onHint?.(msg.text);
        break;
      case "error":
        handlers.onError?.(msg);
        break;
      default:
        break;
    }
  }

  window.addEventListener("message", onMessage);

  /* Beim Neuladen des iframes ist der alte Player weg. */
  iframe.addEventListener("load", () => { ready = false; });

  return {
    sendState: (config, echo) => post({ type: "state", config, echo }),
    goto: (view) => post({ type: "goto", view }),
    select: (path) => post({ type: "select", path }),
    setMode: (mode) => post({ type: "mode", mode }),
    rerender: () => post({ type: "rerender" }),
    destroy: () => window.removeEventListener("message", onMessage),
    get isReady() { return ready; },
  };
}
