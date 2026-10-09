import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, LogIn, Moon, Sun, UserPlus } from "lucide-react";
import { isDarkTheme, setDeviceTheme } from "../utils/theme";

const COPY = {
  signin: { title: "Sign in", blurb: "Pick up where you left off: your clubs, open play and games.", action: "Sign in", icon: LogIn },
  signup: { title: "Create your account", blurb: "One account for the clubs you host and the clubs you join.", action: "Create account", icon: UserPlus },
  reset: { title: "Reset your password", blurb: "Enter your email and we'll send you a link to choose a new password.", action: "Send reset link", icon: LogIn },
};

export default function AccountLogin({ onSignIn, onSignUp, onGoogle, onReset }) {
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [dark, setDark] = useState(isDarkTheme);
  const toggleTheme = () => { setDeviceTheme(dark ? "light" : "dark"); setDark(!dark); };
  const { title, blurb, action, icon: Icon } = COPY[mode];
  const ball = useRef(null);

  // A soft ball chases the pointer (eased, so it trails a little); with reduced motion it stays put.
  useEffect(() => {
    const el = ball.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const goal = { x: window.innerWidth / 2, y: window.innerHeight / 3 };
    const pos = { ...goal };
    let raf = 0;
    const tick = () => {
      pos.x += (goal.x - pos.x) * 0.12;
      pos.y += (goal.y - pos.y) * 0.12;
      el.style.transform = `translate3d(${pos.x}px,${pos.y}px,0) translate(-50%,-50%)`;
      raf = requestAnimationFrame(tick);
    };
    const move = (e) => { goal.x = e.clientX; goal.y = e.clientY; };
    window.addEventListener("pointermove", move);
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, []);


  const go = (next) => { setMode(next); setError(""); setInfo(""); setShowPassword(false); };

  // Every action resolves to "" or a message; busy blocks double submits.
  const attempt = async (fn, done) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setInfo("");
    const message = await fn();
    setBusy(false);
    if (message) setError(message);
    else done?.();
  };

  const submit = (e) => {
    e.preventDefault();
    if (mode === "signin") attempt(() => onSignIn(email, password));
    else if (mode === "signup") attempt(() => onSignUp(name, email, password));
    else attempt(() => onReset(email), () => setInfo("If an account exists for that email, we've sent a link to reset the password."));
  };

  const ready = email.trim() && (mode === "reset" || password) && (mode !== "signup" || name.trim());

  return (
    <div className="clublogin clublogin-fx">
      <div className="clublogin-ball" ref={ball} aria-hidden="true" />
      <div className="clublogin-wrap">
        <div className="clublogin-brand">
          <img src="/images/courtflow.png" alt="" />
          <b>CourtFlow</b>
        </div>

        <form className="clublogin-card" onSubmit={submit}>
          {mode === "reset" ? (
            <button type="button" className="clublogin-back" onClick={() => go("signin")}><ArrowLeft size={15} /> Back to sign in</button>
          ) : (
            <div className="clublogin-tabs" role="group" aria-label="Sign in or create an account">
              <button type="button" aria-pressed={mode === "signin"} onClick={() => go("signin")}>Sign in</button>
              <button type="button" aria-pressed={mode === "signup"} onClick={() => go("signup")}>Create account</button>
            </div>
          )}

          <div className="clublogin-head">
            <h1>{title}</h1>
            <p>{blurb}</p>
          </div>

          {mode === "signup" && (
            <label>
              Your name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Santos" autoComplete="name" autoFocus />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus={mode !== "signup"} />
          </label>
          {mode !== "reset" && (
            <div className="clublogin-field">
              <label htmlFor="login-password">Password</label>
              <div className="clublogin-pw">
                <input
                  id="login-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
                <button
                  type="button" className="clublogin-eye" onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
          )}
          {mode === "signin" && (
            <button type="button" className="clublogin-link clublogin-forgot" onClick={() => go("reset")}>Forgot password?</button>
          )}

          {error && <p className="clublogin-alert" role="alert"><AlertCircle size={16} /> {error}</p>}
          {info && <p className="clublogin-note" role="status"><CheckCircle2 size={16} /> {info}</p>}

          <button className="primary" disabled={busy || !ready}>
            <Icon size={16} /> {busy ? "Please wait…" : action}
          </button>

          {mode !== "reset" && (
            <>
              <div className="clublogin-divider"><span>or</span></div>
              <button type="button" className="outline clublogin-google" disabled={busy} onClick={() => attempt(onGoogle)}>
                <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.4-4.8 7.1l7.6 5.9c4.4-4.1 7-10.1 7-17.5z" />
                  <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
                  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
                </svg>
                Continue with Google
              </button>
            </>
          )}
        </form>

        {mode !== "reset" && (
          <p className="clublogin-foot">
            Just trying it out? <a href="/club">Start a quick session</a>. No account needed.
          </p>
        )}
      </div>
      <button
        type="button" className="icon theme-toggle" onClick={toggleTheme}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  );
}
