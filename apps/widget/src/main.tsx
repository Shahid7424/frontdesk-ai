/**
 * Embed:
 *   <script src="https://swagat-ai.vercel.app/widget.js" data-business-id="sunrise-clinic" defer></script>
 *
 * Optional attributes: data-api (API origin, defaults to the script's
 * origin), data-position="left", data-open="true".
 * Host pages can call window.SwagatAI.open() / .ask("text"). The older
 * window.FrontDesk name keeps working for sites that already use it.
 */
import type { WidgetConfig } from "@frontdesk/core";
import { render } from "preact";
import { App } from "./App";
import { styles } from "./styles";

type HostApi = { open: () => void; close: () => void; ask: (text: string) => void };

declare global {
  interface Window {
    SwagatAI?: HostApi & { _queue?: Array<[keyof HostApi, string?]> };
    FrontDesk?: HostApi & { _queue?: Array<[keyof HostApi, string?]> };
    __frontdeskLoaded?: boolean;
  }
}

async function boot(script: HTMLScriptElement) {
  const businessId = script.dataset.businessId;
  if (!businessId) {
    console.warn("[Swagat AI] Missing data-business-id on the widget script tag.");
    return;
  }
  const apiBase = (script.dataset.api ?? new URL(script.src).origin).replace(/\/$/, "");

  let config: WidgetConfig;
  try {
    const res = await fetch(`${apiBase}/api/widget-config?businessId=${encodeURIComponent(businessId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    config = (await res.json()) as WidgetConfig;
  } catch (err) {
    // Fail closed and quietly: a broken widget must never break the host site.
    console.warn("[Swagat AI] Could not load widget config.", err);
    return;
  }

  const host = document.createElement("div");
  host.id = "frontdesk-widget";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = styles;
  shadow.appendChild(style);
  const mount = document.createElement("div");
  shadow.appendChild(mount);

  // Calls made before the widget finished loading are queued, then replayed.
  const queued = [...(window.FrontDesk?._queue ?? []), ...(window.SwagatAI?._queue ?? [])];

  render(
    <App
      apiBase={apiBase}
      config={config}
      position={script.dataset.position === "left" ? "left" : "right"}
      startOpen={script.dataset.open === "true"}
      register={(api) => {
        window.SwagatAI = api;
        window.FrontDesk = api;
        for (const [method, arg] of queued.splice(0)) api[method](arg ?? "");
      }}
    />,
    mount,
  );
}

// currentScript is null when a tag manager or site builder injects the tag
// in a way that runs it later, so fall back to finding our own tag.
const script =
  (document.currentScript as HTMLScriptElement | null) ??
  document.querySelector<HTMLScriptElement>('script[src*="widget.js"][data-business-id]');
// The tag pasted twice (header and footer) must not open two chat bubbles.
if (script && !window.__frontdeskLoaded) {
  window.__frontdeskLoaded = true;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void boot(script));
  } else {
    void boot(script);
  }
}
