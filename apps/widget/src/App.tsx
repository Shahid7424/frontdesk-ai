import { formatRupees, normalizeIndianMobile, type ChatLanguage, type CustomerDetails, type Slot, type WidgetConfig } from "@frontdesk/core";
import { useEffect, useRef, useState } from "preact/hooks";
import { Icon } from "./icons";
import { LANGUAGE_OPTIONS, UI } from "./i18n";
import { useChat, useLanguage, type UIMessage } from "./useChat";

export interface WidgetProps {
  apiBase: string;
  config: WidgetConfig;
  position: "left" | "right";
  startOpen: boolean;
  /** Lets the host page open the widget or ask a question programmatically. */
  register: (api: { open: () => void; close: () => void; ask: (text: string) => void }) => void;
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

export function App({ apiBase, config, position, startOpen, register }: WidgetProps) {
  const [open, setOpen] = useState(startOpen);
  const [nudge, setNudge] = useState(false);
  const [language, setLanguage] = useLanguage(config.businessId);
  const ui = UI[language] ?? UI.auto;
  const chat = useChat({ apiBase, businessId: config.businessId, language, connectionError: ui.connectionError });
  const pendingAsk = useRef<string | null>(null);

  useEffect(() => {
    register({
      open: () => setOpen(true),
      close: () => setOpen(false),
      ask: (text) => {
        pendingAsk.current = text;
        setOpen(true);
      },
    });
  }, [register]);

  // Send a question queued by the host page once the panel is mounted.
  useEffect(() => {
    if (open && pendingAsk.current && !chat.busy) {
      const text = pendingAsk.current;
      pendingAsk.current = null;
      void chat.send(text);
    }
  }, [open, chat.busy, chat.send]);

  // A gentle nudge after a few seconds converts far better than a silent bubble.
  useEffect(() => {
    if (open || chat.messages.length) return;
    const t = setTimeout(() => setNudge(true), 4000);
    return () => clearTimeout(t);
  }, [open, chat.messages.length]);

  // While the chat is open, pick up replies the clinic's staff send from their inbox.
  const hasChat = chat.messages.length > 0;
  const { pollTeam } = chat;
  useEffect(() => {
    if (!open || !hasChat) return;
    void pollTeam();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void pollTeam();
    }, 8000);
    return () => clearInterval(t);
  }, [open, hasChat, pollTeam]);

  return (
    <div
      class={`root ${position === "left" ? "left" : ""} ${open ? "open" : ""}`}
      style={{ "--fd-accent": config.accentColor }}
    >
      {open && (
        <Panel config={config} chat={chat} language={language} onLanguage={setLanguage} onClose={() => setOpen(false)} />
      )}

      {!open && nudge && (
        <div class="nudge">
          <button
            class="nudge-text"
            onClick={() => {
              setNudge(false);
              setOpen(true);
            }}
          >
            Namaste! 👋 Appointment ya fees ke baare mein kuch puchna hai?
          </button>
          <button class="nudge-close" aria-label="Dismiss" onClick={() => setNudge(false)}>
            <Icon.close size={14} />
          </button>
        </div>
      )}

      <button
        class={`launcher ${open ? "icon-only" : ""}`}
        aria-label={open ? "Close chat" : `Chat with ${config.businessName}`}
        aria-expanded={open}
        onClick={() => {
          setNudge(false);
          setOpen((o) => !o);
        }}
      >
        {open ? (
          <Icon.chevronDown size={24} />
        ) : (
          <>
            <span class="avatar">
              <Icon.chat size={20} />
            </span>
            <span class="launcher-label">
              <strong>Chat with us</strong>
              <span>Usually replies instantly</span>
            </span>
          </>
        )}
      </button>
    </div>
  );
}

function Panel({
  config,
  chat,
  language,
  onLanguage,
  onClose,
}: {
  config: WidgetConfig;
  chat: ReturnType<typeof useChat>;
  language: ChatLanguage;
  onLanguage: (language: ChatLanguage) => void;
  onClose: () => void;
}) {
  const ui = UI[language] ?? UI.auto;
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    if (!draft.trim() || chat.busy) return;
    void chat.send(draft);
    setDraft("");
    if (inputRef.current) inputRef.current.style.height = "";
  };

  return (
    <section class="panel" role="dialog" aria-label={`Chat with ${config.businessName}`}>
      <header class="header">
        <div class="avatar" aria-hidden="true">
          {initials(config.businessName)}
          <span class="dot" />
        </div>
        <div class="header-text">
          <h2>{config.businessName}</h2>
          <p>{config.tagline}</p>
        </div>
        {chat.messages.length > 0 && (
          <button class="icon-btn" aria-label="Start a new chat" title="New chat" onClick={chat.reset}>
            <Icon.refresh size={18} />
          </button>
        )}
        <button class="icon-btn" aria-label="Close chat" onClick={onClose}>
          <Icon.close size={20} />
        </button>
      </header>

      <div class="lang" role="radiogroup" aria-label="Reply language">
        {LANGUAGE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={language === o.value}
            title={o.title}
            class={`lang-opt ${language === o.value ? "on" : ""}`}
            onClick={() => onLanguage(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div class="messages" ref={listRef} aria-live="polite">
        <span class="day-chip">Today</span>
        <div class="row assistant">
          <div class="bubble">{ui.greeting(config.businessName, config.greeting)}</div>
          {chat.messages.length === 0 && (
            <div class="quick">
              {config.quickReplies.map((q) => (
                <button key={q} class="chip" onClick={() => chat.send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        {chat.messages.map((m) => (
          <Message
            key={m.id}
            message={m}
            busy={chat.busy}
            ui={ui}
            onSlot={(slot) => (slot?.rescheduleOf ? chat.moveSlot(m.id, slot) : chat.chooseSlot(m.id, slot))}
            onConfirm={(slot, details) => chat.confirmSlot(m.id, slot, details)}
            savedCustomer={chat.savedCustomer}
          />
        ))}
      </div>

      <form
        class="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          placeholder={ui.placeholder}
          aria-label="Message"
          maxLength={2000}
          onInput={(e) => {
            const el = e.currentTarget;
            setDraft(el.value);
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button class="send" type="submit" aria-label="Send" disabled={!draft.trim() || chat.busy}>
          <Icon.send size={18} />
        </button>
      </form>
      <div class="footer">
        <span>
          {config.consentText}{" "}
          <a href={config.privacyUrl} target="_blank" rel="noreferrer">
            Privacy
          </a>
        </span>
        <span class="brand">⚡ FrontDesk AI</span>
      </div>
    </section>
  );
}

function Message({
  message: m,
  busy,
  ui,
  onSlot,
  onConfirm,
  savedCustomer,
}: {
  message: UIMessage;
  busy: boolean;
  ui: (typeof UI)[ChatLanguage];
  onSlot: (slot: Slot | null) => void;
  onConfirm: (slot: Slot, details: CustomerDetails) => void;
  savedCustomer: () => CustomerDetails | null;
}) {
  const [openSource, setOpenSource] = useState<string | null>(null);
  const waiting = m.streaming && !m.content && !m.error;

  return (
    <div class={`row ${m.role}`}>
      {waiting ? (
        <div class="bubble" aria-label="Typing">
          <span class="typing">
            <span />
            <span />
            <span />
          </span>
        </div>
      ) : (
        m.content && (
          <>
            {m.fromTeam && <span class="team-label">{ui.team}</span>}
            <div class={`bubble ${m.streaming ? "caret" : ""}`}>{m.content}</div>
          </>
        )
      )}

      {m.error && <div class="bubble error">{m.error}</div>}

      {m.citations && m.citations.length > 0 && (
        <>
          <div class="sources">
            {m.citations.map((c) => (
              <button
                key={c.id}
                class="source"
                aria-expanded={openSource === c.id}
                onClick={() => setOpenSource(openSource === c.id ? null : c.id)}
              >
                <Icon.file size={12} />
                {c.title}
              </button>
            ))}
          </div>
          {openSource && (
            <div class="source-detail">{m.citations.find((c) => c.id === openSource)?.snippet}</div>
          )}
        </>
      )}

      {m.slots && m.slots.length > 0 && (
        <>
          <p class="slots-title">
            {m.slots[0]!.serviceName} · {m.slots[0]!.staffName}
          </p>
          <div class="slots">
            {m.slots.map((s) => (
              <button
                key={s.id}
                class={`slot ${m.chosenSlotId === s.id ? "chosen" : ""}`}
                disabled={Boolean(m.chosenSlotId) || busy}
                onClick={() => onSlot(s)}
              >
                {s.label}
              </button>
            ))}
          </div>
          {m.chosenSlotId && !m.slotSent && (
            <DetailsForm
              slot={m.slots.find((s) => s.id === m.chosenSlotId)!}
              ui={ui}
              busy={busy}
              initial={savedCustomer()}
              onConfirm={onConfirm}
              onCancel={() => onSlot(null)}
            />
          )}
        </>
      )}

      {m.payment && (
        <div class="pay">
          <div class="pay-top">
            <span>{ui.payTitle}</span>
            <strong>{formatRupees(m.payment.amountInPaise)}</strong>
          </div>
          <a class="pay-btn" href={m.payment.url} target="_blank" rel="noreferrer">
            <Icon.lock size={15} /> {ui.payButton}
          </a>
          <p class="pay-note">{ui.payNote(m.payment.expiresInMinutes)}</p>
        </div>
      )}

      {m.handoff && (
        <div class="handoff">
          <Icon.user size={15} />
          <span>{ui.handoff}</span>
        </div>
      )}
    </div>
  );
}

/** Name and mobile number before a slot is held: the clinic needs to know who is coming. */
function DetailsForm({
  slot,
  ui,
  busy,
  initial,
  onConfirm,
  onCancel,
}: {
  slot: Slot;
  ui: (typeof UI)[ChatLanguage];
  busy: boolean;
  initial: CustomerDetails | null;
  onConfirm: (slot: Slot, details: CustomerDetails) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone.replace(/^\+91/, "") ?? "");
  const [touched, setTouched] = useState(false);
  const valid = normalizeIndianMobile(phone);
  const ok = name.trim().length >= 2 && valid !== null;

  return (
    <form
      class="details"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (ok && !busy) onConfirm(slot, { name: name.trim(), phone: valid! });
      }}
    >
      <p>{ui.detailsTitle(slot.label)}</p>
      <input value={name} onInput={(e) => setName(e.currentTarget.value)} placeholder={ui.namePlaceholder} aria-label={ui.namePlaceholder} autocomplete="name" maxLength={80} />
      <input
        value={phone}
        onInput={(e) => setPhone(e.currentTarget.value)}
        onBlur={() => setTouched(true)}
        placeholder={ui.phonePlaceholder}
        aria-label={ui.phonePlaceholder}
        type="tel"
        inputMode="numeric"
        autocomplete="tel-national"
        maxLength={16}
      />
      {touched && phone && !valid && <span class="field-error">{ui.phoneError}</span>}
      <div class="details-actions">
        <button type="button" class="ghost" onClick={onCancel}>
          {ui.changeSlot}
        </button>
        <button type="submit" class="primary" disabled={!ok || busy}>
          {ui.holdButton}
        </button>
      </div>
    </form>
  );
}
