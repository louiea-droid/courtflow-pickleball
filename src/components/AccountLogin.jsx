import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, LogIn, Moon, Sun, UserPlus } from "lucide-react";
import { isDarkTheme, setDeviceTheme } from "../utils/theme";

const COPY = {
  signin: { title: "Sign in", blurb: "Pick up where you left off: your clubs, open play and games.", action: "Sign in", icon: LogIn },
  signup: { title: "Create your account", blurb: "One account for the clubs you host and the clubs you join.", action: "Create account", icon: UserPlus },
  reset: { title: "Reset your password", blurb: "Enter your email and we'll send you a link to choose a new password.", action: "Send reset link", icon: LogIn },
};

const TRAIL = 32; // points in the cursor's wave line
const DIVE_AFTER = 120; // ms without pointer movement before the line sets off on its own
const DIVE_FRAMES = 75; // frames it takes to glide away and fade out

// A swoosh path that swells through its shapes and back, forever; still under reduced motion. Every
// shape of one path must have the same make-up (same commands, same number of points).
const STILL = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function Swell({ shapes, dur, className }) {
  const values = [...shapes, shapes[0]];
  return (
    <path className={className} d={shapes[0]}>
      {!STILL && (
        <animate
          attributeName="d" values={values.join(";")} dur={dur} repeatCount="indefinite" calcMode="spline"
          keyTimes={values.map((_, i) => (i / (values.length - 1)).toFixed(3)).join(";")}
          keySplines={Array(values.length - 1).fill(".45 0 .55 1").join(";")}
        />
      )}
    </path>
  );
}

// The lime crest and the green body share one curve per moment ([y0, c1x, c1y, c2x, c2y, y1]), so the
// lime always rides the green however far the swell moves.
const CRESTS = [[288, 150, 186, 362, 252, 112], [266, 190, 236, 330, 214, 146], [300, 130, 162, 392, 274, 92]];
const lime = ([y0, c1x, c1y, c2x, c2y, y1]) =>
  `M-20 ${y0} C${c1x} ${c1y} ${c2x} ${c2y} 620 ${y1} C${c2x} ${c2y + 16} ${c1x} ${c1y + 13} -20 ${y0 + 7}Z`;
const green = ([y0, c1x, c1y, c2x, c2y, y1]) =>
  `M-20 ${y0 + 12} C${c1x} ${c1y + 19} ${c2x} ${c2y + 23} 620 ${y1 + 23} C440 ${y1 + 165} 220 ${y0 + 52} -20 ${y0 + 12}Z`;

// Smooth line through points: a quadratic curve to each midpoint, so there are no corners.
const smooth = (p, start) => {
  let d = `${start}${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
    d += `Q${p[i][0].toFixed(1)} ${p[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = p[p.length - 1];
  return `${d}L${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
};

export default function AccountLogin({ onSignIn, onSignUp, onGoogle, onReset, initialMode = "signin", onHome }) {
  const [mode, setMode] = useState(initialMode);
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
  const trail = useRef(null);

  // A lit wave line trails the pointer like a rope: the head eases toward the pointer and each point
  // eases toward the one before it, so the line bends smoothly. It is drawn as one tapered ribbon with
  // a gentle travelling ripple, fading toward the tail (a gradient laid from head to tail). When the
  // pointer stops, the line glides on past it the way it was going, sinks a little, slips behind the
  // waves (.dive) and thins away; the next move starts a fresh line. Off with reduced motion.
  useEffect(() => {
    const svg = trail.current;
    if (!svg || STILL) return undefined;
    const ribbon = svg.querySelector("path");
    const fade = svg.querySelector("linearGradient");
    const goal = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    let pts = null;
    let raf = 0;
    let t = 0;
    let lastMove = 0;
    let dived = 0; // frames since the line set off on its own; 0 while it follows the pointer
    const reset = () => {
      pts = null;
      dived = 0;
      svg.classList.remove("dive");
      svg.style.opacity = "";
      ribbon.setAttribute("d", "");
    };
    const tick = () => {
      t += 1;
      if (!dived && performance.now() - lastMove > DIVE_AFTER) {
        // Set off at the speed it was moving, or at an easy pace along its own direction.
        const speed = Math.hypot(vel.x, vel.y);
        if (speed < 4) {
          const from = pts[6], dx = pts[0].x - from.x, dy = pts[0].y - from.y, len = Math.hypot(dx, dy);
          vel.x = len > 1 ? (dx / len) * 4 : 4;
          vel.y = len > 1 ? (dy / len) * 4 : 0;
        }
        dived = 1;
        svg.classList.add("dive");
      }
      if (dived) {
        goal.x += vel.x;
        goal.y += vel.y;
        vel.x *= 0.97;
        vel.y = vel.y * 0.97 + 0.12; // sinks as it goes
        dived += 1;
      }
      const depth = dived ? Math.min(1, dived / DIVE_FRAMES) : 0;
      if (depth >= 1) {
        reset();
        raf = 0;
        return;
      }
      const hx = pts[0].x, hy = pts[0].y;
      pts[0].x += (goal.x - pts[0].x) * 0.3;
      pts[0].y += (goal.y - pts[0].y) * 0.3;
      if (!dived) {
        vel.x += (pts[0].x - hx - vel.x) * 0.3;
        vel.y += (pts[0].y - hy - vel.y) * 0.3;
      }
      for (let i = 1; i < TRAIL; i++) {
        pts[i].x += (pts[i - 1].x - pts[i].x) * 0.45;
        pts[i].y += (pts[i - 1].y - pts[i].y) * 0.45;
      }
      const head = pts[0], tail = pts[TRAIL - 1];
      const left = [], right = [];
      pts.forEach((p, i) => {
        const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, TRAIL - 1)];
        const dx = a.x - b.x, dy = a.y - b.y, len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const ripple = Math.sin(i * 0.42 - t * 0.16) * 5 * Math.min(1, i / 6) * Math.min(1, len / 6);
        const half = (3.4 * (1 - i / (TRAIL - 1)) + 0.2) * (1 - depth * 0.8);
        const cx = p.x + nx * ripple, cy = p.y + ny * ripple;
        left.push([cx + nx * half, cy + ny * half]);
        right.push([cx - nx * half, cy - ny * half]);
      });
      ribbon.setAttribute("d", `${smooth(left, "M")}${smooth(right.reverse(), "L")}Z`);
      fade.setAttribute("x1", head.x); fade.setAttribute("y1", head.y);
      fade.setAttribute("x2", tail.x); fade.setAttribute("y2", tail.y);
      svg.style.opacity = dived ? String(1 - depth) : "";
      raf = requestAnimationFrame(tick);
    };
    const move = (e) => {
      if (dived) reset(); // the last line swims on out of reach; a new one starts at the pointer
      goal.x = e.clientX;
      goal.y = e.clientY;
      lastMove = performance.now();
      if (!pts) pts = Array.from({ length: TRAIL }, () => ({ ...goal }));
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", move);
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
      <svg className="clublogin-trail" ref={trail} aria-hidden="true">
        <defs>
          <linearGradient id="clublogin-trail-fade" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopOpacity="1" />
            <stop offset="1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path fill="url(#clublogin-trail-fade)" />
      </svg>
      <aside className="clublogin-art">
        <a className="clublogin-brand" href="/" onClick={onHome && ((e) => { e.preventDefault(); onHome(); })}>
          <img src="/images/courtwave-light.png" alt="" />
          <b>CourtWave</b>
        </a>
        <div className="clublogin-pitch">
          <h2>Catch your wave.</h2>
          <p>A fair queue, payments, umpires and live scores, so everyone knows when they're up.</p>
        </div>
        {/* The logo's swoosh, drawn big: faint swell lines behind, then the deep, green and lime bands. */}
        <svg className="clublogin-swoosh" viewBox="0 0 600 320" preserveAspectRatio="none" aria-hidden="true">
          <g className="s0">
            <Swell dur="7s" shapes={["M-20 170 C140 90 340 170 620 60", "M-20 150 C170 140 310 120 620 84", "M-20 184 C120 70 370 196 620 44"]} />
            <Swell dur="8.5s" shapes={["M-20 200 C150 120 350 200 620 92", "M-20 182 C180 170 320 152 620 116", "M-20 214 C130 100 380 226 620 76"]} />
            <Swell dur="10s" shapes={["M-20 140 C130 62 330 140 620 30", "M-20 122 C160 112 300 92 620 54", "M-20 154 C110 40 360 166 620 14"]} />
          </g>
          <Swell className="s1" dur="9s" shapes={["M-20 330 C170 240 380 300 620 170 L620 340 L-20 340Z", "M-20 312 C200 278 350 262 620 200 L620 340 L-20 340Z", "M-20 336 C150 222 400 318 620 150 L620 340 L-20 340Z"]} />
          {/* Green and lime come from the same crest, so the lime always rides the green. */}
          <Swell className="s2" dur="7s" shapes={CRESTS.map(green)} />
          <Swell className="s3" dur="7s" shapes={CRESTS.map(lime)} />
        </svg>
      </aside>
      <div className="clublogin-wrap">

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
            <a href="/club" className="clublogin-quick-link">
              <span>Start a quick session</span>
              <span className="clublogin-quick-note">No account needed</span>
            </a>
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
