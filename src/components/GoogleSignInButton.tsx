import { useEffect, useRef, useState } from "react";
import { useTheme } from "../hooks/useTheme";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
/** Google renders standard buttons at most 400px wide. */
const MAX_WIDTH = 400;
const LOAD_POLL_MS = 100;
const LOAD_TIMEOUT_MS = 15_000;

type GoogleSignInButtonProps = {
  text: "signin_with" | "signup_with";
  onCredential: (credential: string) => void;
  /** Shows an "or" rule under the button once it has rendered. */
  divider?: boolean;
};

/** `initialize` is page-global, so one callback serves whichever button is mounted. */
let currentCallback: ((credential: string) => void) | null = null;
let initialized = false;

function gisId(): typeof google.accounts.id | null {
  return (window as { google?: typeof google }).google?.accounts?.id ?? null;
}

function ensureInitialized(id: typeof google.accounts.id) {
  if (initialized || !CLIENT_ID) return;
  id.initialize({
    client_id: CLIENT_ID,
    callback: (response) => {
      if (response.credential) currentCallback?.(response.credential);
    },
    auto_select: false,
  });
  initialized = true;
}

/**
 * The Google-rendered Sign in with Google button (Google does not allow
 * custom-drawn ones). Renders nothing when no client id is configured or the
 * Google script never loads, so the email-code flow keeps working on its own.
 */
function GoogleSignInButton({ text, onCredential, divider = false }: GoogleSignInButtonProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(() => Boolean(CLIENT_ID && gisId()));
  const [width, setWidth] = useState(0);

  useEffect(() => {
    currentCallback = onCredential;
    return () => {
      if (currentCallback === onCredential) currentCallback = null;
    };
  }, [onCredential]);

  useEffect(() => {
    if (ready || !CLIENT_ID) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (gisId()) {
        setReady(true);
        window.clearInterval(timer);
      } else if (Date.now() - started > LOAD_TIMEOUT_MS) {
        window.clearInterval(timer);
      }
    }, LOAD_POLL_MS);
    return () => window.clearInterval(timer);
  }, [ready]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () =>
      setWidth(Math.min(MAX_WIDTH, Math.floor(el.getBoundingClientRect().width)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const id = gisId();
    const target = buttonRef.current;
    if (!ready || !id || !target || width <= 0) return;
    ensureInitialized(id);
    target.replaceChildren();
    id.renderButton(target, {
      type: "standard",
      theme: theme === "dark" ? "filled_black" : "outline",
      size: "large",
      shape: "pill",
      text,
      logo_alignment: "left",
      width,
    });
  }, [ready, width, theme, text]);

  if (!CLIENT_ID) return null;

  return (
    <div ref={containerRef} className="w-full max-w-[400px]">
      <div ref={buttonRef} className={ready ? "min-h-10" : undefined} />
      {ready && divider && (
        <div className="mt-4 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs font-medium text-ink-muted">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>
      )}
    </div>
  );
}

export default GoogleSignInButton;
