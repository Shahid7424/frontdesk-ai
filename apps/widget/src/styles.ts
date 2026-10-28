// Styles live inside the widget's Shadow DOM, so the host website's CSS
// can't break the widget and our CSS can't leak into their site.
export const styles = /* css */ `
:host {
  all: initial;
  --fd-accent: #0f766e;
  --fd-accent-soft: color-mix(in srgb, var(--fd-accent) 10%, white);
  --fd-accent-ink: color-mix(in srgb, var(--fd-accent) 70%, black);
  --fd-ink: #0f172a;
  --fd-muted: #64748b;
  --fd-line: #e2e8f0;
  --fd-surface: #ffffff;
  --fd-canvas: #f8fafc;
  --fd-radius: 18px;
  --fd-shadow: 0 24px 60px -12px rgba(15, 23, 42, 0.28), 0 8px 20px -8px rgba(15, 23, 42, 0.18);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif;
  color: var(--fd-ink);
  -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }
button { font: inherit; cursor: pointer; }
button:focus-visible, textarea:focus-visible, a:focus-visible {
  outline: 2px solid var(--fd-accent);
  outline-offset: 2px;
}

.root {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}
.root.left { right: auto; left: 20px; align-items: flex-start; }

/* Launcher */
.launcher {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 20px 0 8px;
  border: 0;
  border-radius: 999px;
  background: var(--fd-accent);
  color: white;
  box-shadow: var(--fd-shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.launcher:hover { transform: translateY(-2px); }
.launcher .avatar { width: 40px; height: 40px; background: rgba(255,255,255,0.18); }
.launcher-label { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.15; }
.launcher-label strong { font-size: 14px; font-weight: 600; }
.launcher-label span { font-size: 12px; opacity: 0.85; }
.launcher.icon-only { width: 56px; padding: 0; justify-content: center; }

.nudge {
  position: relative;
  max-width: 260px;
  padding: 12px 36px 12px 14px;
  background: var(--fd-surface);
  border-radius: 16px 16px 4px 16px;
  box-shadow: var(--fd-shadow);
  font-size: 14px;
  line-height: 1.4;
  animation: fd-pop 0.35s cubic-bezier(.2,.9,.3,1.2);
  color: var(--fd-ink);
}
.nudge-text {
  padding: 0; border: 0; background: none;
  text-align: left; color: inherit; font-size: 14px; line-height: 1.4;
}
.nudge-close {
  position: absolute; top: 6px; right: 6px;
  width: 24px; height: 24px; border-radius: 999px;
  border: 0; background: transparent; color: var(--fd-muted);
  display: grid; place-items: center;
}
.nudge-close:hover { background: var(--fd-canvas); }

/* Panel */
.panel {
  width: 380px;
  height: min(640px, calc(100vh - 110px));
  display: flex;
  flex-direction: column;
  background: var(--fd-surface);
  border-radius: var(--fd-radius);
  box-shadow: var(--fd-shadow);
  overflow: hidden;
  transform-origin: bottom right;
  animation: fd-open 0.28s cubic-bezier(.2,.9,.3,1);
}
.root.left .panel { transform-origin: bottom left; }

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 14px 16px 16px;
  background:
    radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--fd-accent) 70%, white) 0%, transparent 55%),
    var(--fd-accent);
  color: white;
}
.avatar {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  font-weight: 700;
  font-size: 15px;
  color: white;
}
.avatar .dot {
  position: absolute; right: 0; bottom: 1px;
  width: 11px; height: 11px; border-radius: 999px;
  background: #4ade80; border: 2px solid var(--fd-accent);
}
.header-text { flex: 1; min-width: 0; }
.header-text h2 { margin: 0; font-size: 15px; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.header-text p { margin: 2px 0 0; font-size: 12.5px; opacity: 0.88; }
.icon-btn {
  width: 34px; height: 34px; flex: none;
  display: grid; place-items: center;
  border: 0; border-radius: 10px;
  background: transparent; color: inherit;
}
.icon-btn:hover { background: rgba(255, 255, 255, 0.16); }

.lang {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  background: #fff;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  overflow-x: auto;
  scrollbar-width: none;
}
.lang-opt {
  flex: none;
  padding: 5px 11px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 999px;
  background: #fff;
  color: #475569;
  font: inherit;
  font-size: 12.5px;
  font-weight: 550;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.lang-opt:hover { border-color: var(--fd-accent); color: var(--fd-accent); }
.lang-opt.on { background: var(--fd-accent); border-color: var(--fd-accent); color: #fff; }
.lang-opt:focus-visible { outline: 2px solid var(--fd-accent); outline-offset: 2px; }

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 18px 14px 8px;
  background: var(--fd-canvas);
  display: flex;
  flex-direction: column;
  gap: 10px;
  scroll-behavior: smooth;
}
.day-chip {
  align-self: center;
  font-size: 11.5px;
  color: var(--fd-muted);
  background: var(--fd-surface);
  border: 1px solid var(--fd-line);
  padding: 3px 10px;
  border-radius: 999px;
}
.row { display: flex; flex-direction: column; gap: 6px; max-width: 86%; animation: fd-in 0.22s ease-out; }
.row.user { align-self: flex-end; align-items: flex-end; }
.row.assistant { align-self: flex-start; }

.bubble {
  padding: 10px 13px;
  font-size: 14.5px;
  line-height: 1.5;
  border-radius: 16px;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.row.assistant .bubble {
  background: var(--fd-surface);
  border: 1px solid var(--fd-line);
  border-top-left-radius: 6px;
}
.row.user .bubble {
  background: var(--fd-accent);
  color: white;
  border-top-right-radius: 6px;
}
.bubble.error { background: #fef2f2; border-color: #fecaca; color: #991b1b; }

.typing { display: inline-flex; gap: 4px; padding: 4px 2px; }
.typing span {
  width: 6px; height: 6px; border-radius: 999px; background: #94a3b8;
  animation: fd-blink 1.2s infinite ease-in-out;
}
.typing span:nth-child(2) { animation-delay: 0.15s; }
.typing span:nth-child(3) { animation-delay: 0.3s; }
.caret::after {
  content: "";
  display: inline-block;
  width: 2px; height: 1em;
  margin-left: 2px;
  vertical-align: -2px;
  background: var(--fd-accent);
  animation: fd-caret 1s steps(1) infinite;
}

/* Citations */
.sources { display: flex; flex-wrap: wrap; gap: 6px; }
.source {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 9px;
  font-size: 12px;
  color: var(--fd-accent-ink);
  background: var(--fd-accent-soft);
  border: 1px solid color-mix(in srgb, var(--fd-accent) 18%, white);
  border-radius: 999px;
}
.source[aria-expanded="true"] { background: var(--fd-surface); }
.source-detail {
  font-size: 12.5px; line-height: 1.45; color: var(--fd-muted);
  background: var(--fd-surface); border: 1px dashed var(--fd-line);
  border-radius: 12px; padding: 8px 10px;
}

/* Slots */
.slots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; width: 100%; }
.slots-title { font-size: 12px; color: var(--fd-muted); margin: 2px 2px 0; }
.slot {
  padding: 9px 10px;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  color: var(--fd-accent-ink);
  background: var(--fd-surface);
  border: 1.5px solid color-mix(in srgb, var(--fd-accent) 30%, white);
  border-radius: 12px;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.slot:hover:not(:disabled) { background: var(--fd-accent-soft); border-color: var(--fd-accent); }
.slot:active:not(:disabled) { transform: scale(0.97); }
.slot:disabled { cursor: default; opacity: 0.45; }
.slot.chosen { opacity: 1; background: var(--fd-accent); border-color: var(--fd-accent); color: white; }

/* Name + phone before a slot is held */
.details { width: 100%; display: flex; flex-direction: column; gap: 6px; background: var(--fd-surface); border: 1px solid var(--fd-line); border-radius: 16px; padding: 12px; }
.details p { font-size: 12.5px; color: var(--fd-muted); margin: 0 0 2px; }
.details input {
  width: 100%; box-sizing: border-box; height: 40px; padding: 0 12px;
  font: inherit; font-size: 16px; color: var(--fd-ink);
  background: white; border: 1px solid var(--fd-line); border-radius: 10px; outline: none;
}
.details input:focus { border-color: var(--fd-accent); }
.details .field-error { font-size: 12px; color: #b91c1c; }
.details-actions { display: flex; gap: 6px; margin-top: 2px; }
.details-actions button { flex: 1; height: 40px; border-radius: 10px; font-size: 13.5px; font-weight: 600; }
.details-actions .primary { background: var(--fd-accent); color: white; border: 0; }
.details-actions .primary:disabled { opacity: 0.5; }
.details-actions .ghost { background: transparent; color: var(--fd-muted); border: 1px solid var(--fd-line); }
.team-label { font-size: 11px; font-weight: 600; color: var(--fd-muted); margin: 0 2px; }

/* Payment */
.pay {
  width: 100%;
  background: var(--fd-surface);
  border: 1px solid var(--fd-line);
  border-radius: 16px;
  padding: 14px;
  display: flex; flex-direction: column; gap: 10px;
}
.pay-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.pay-top span { font-size: 12.5px; color: var(--fd-muted); }
.pay-top strong { font-size: 20px; letter-spacing: -0.01em; }
.pay-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  height: 42px; border-radius: 12px;
  background: var(--fd-ink); color: white;
  font-size: 14px; font-weight: 600; text-decoration: none;
}
.pay-btn:hover { background: #1e293b; }
.pay-note { font-size: 11.5px; color: var(--fd-muted); text-align: center; }

.handoff {
  display: flex; gap: 8px; align-items: flex-start;
  font-size: 12.5px; line-height: 1.45;
  color: #92400e; background: #fffbeb; border: 1px solid #fde68a;
  border-radius: 12px; padding: 9px 11px;
}

/* Quick replies */
.quick { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0 2px; }
.chip {
  padding: 7px 12px;
  font-size: 13px;
  color: var(--fd-ink);
  background: var(--fd-surface);
  border: 1px solid var(--fd-line);
  border-radius: 999px;
  transition: border-color 0.15s, color 0.15s;
}
.chip:hover { border-color: var(--fd-accent); color: var(--fd-accent-ink); }

/* Composer */
.composer {
  display: flex; align-items: flex-end; gap: 8px;
  padding: 10px 12px 8px;
  border-top: 1px solid var(--fd-line);
  background: var(--fd-surface);
}
.composer textarea {
  flex: 1;
  resize: none;
  max-height: 120px;
  min-height: 44px;
  padding: 11px 14px;
  font: inherit;
  font-size: 14.5px;
  line-height: 1.4;
  color: var(--fd-ink);
  background: var(--fd-canvas);
  border: 1px solid var(--fd-line);
  border-radius: 14px;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
}
.composer textarea:focus { border-color: var(--fd-accent); background: var(--fd-surface); }
.send {
  width: 44px; height: 44px; flex: none;
  display: grid; place-items: center;
  border: 0; border-radius: 14px;
  background: var(--fd-accent); color: white;
  transition: opacity 0.15s, transform 0.1s;
}
.send:disabled { opacity: 0.4; cursor: default; }
.send:active:not(:disabled) { transform: scale(0.94); }
.footer {
  padding: 0 14px 10px;
  background: var(--fd-surface);
  font-size: 11px;
  line-height: 1.4;
  color: var(--fd-muted);
  display: flex; justify-content: space-between; gap: 10px;
}
.footer a { color: inherit; }
.brand { white-space: nowrap; font-weight: 600; }

@keyframes fd-open { from { opacity: 0; transform: translateY(12px) scale(0.96); } to { opacity: 1; transform: none; } }
@keyframes fd-pop { from { opacity: 0; transform: translateY(8px) scale(0.95); } to { opacity: 1; transform: none; } }
@keyframes fd-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes fd-blink { 0%, 80%, 100% { opacity: 0.3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-2px); } }
@keyframes fd-caret { 50% { opacity: 0; } }

@media (max-width: 480px) {
  .root { right: 12px; bottom: 12px; }
  .root.left { left: 12px; }
  .root.open { inset: 0; right: 0; bottom: 0; }
  .root.open .panel { width: 100vw; height: 100dvh; border-radius: 0; }
  .root.open .launcher { display: none; }
  /* iOS zooms into inputs under 16px */
  .composer textarea { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;
