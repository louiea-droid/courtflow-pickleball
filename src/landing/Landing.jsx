import { CalendarCheck, ChevronDown, Download, Globe, Megaphone, MonitorPlay, Shuffle, Smartphone, Users, Wallet } from "lucide-react";
import { useEffect, useRef } from "react";
import "./landing.css";

// The public front page at "/" for visitors who aren't signed in. Get started and Sign in open the
// sign-in screen (/signup, /signin); after that they land on Home like any signed-in person.
const FEATURES = [
  {
    icon: Shuffle, title: "A fair queue that runs itself",
    body: "Whoever has waited longest plays next. CourtWave mixes up partners and opponents so the same four don't keep meeting.",
    points: ["Balanced, Skill Separated, Winners / Losers, Mixed Doubles or Custom", "Lock partners, call or skip players, per-court levels", "Up Next shows the coming match before the court frees up"],
    shot: { src: "/help/game-dashboard.png", w: 1280, h: 900, alt: "The game dashboard with courts in play and Up Next below." },
  },
  {
    icon: Wallet, title: "Bookings and payments in one place",
    body: "Post a session, share the link or QR code, and players book a seat. Full games get a waitlist.",
    points: ["Cash or GCash, with a receipt photo for online payments", "Paid / Unpaid at a glance and Mark all as paid", "Export the night's payments to Excel"],
    shot: { src: "/help/payment.png", w: 1280, h: 900, alt: "The payment page with each player's method and paid status." },
  },
  {
    icon: Megaphone, title: "Volunteer umpires on their own phones",
    body: "Share a link and anyone can keep score for one court. No account, no app to install.",
    points: ["Side-out or rally scoring, to 11, 15 or 21", "The score is called for them, server included", "Results land in the match log by themselves"],
    shot: { src: "/help/scorekeeper.png", w: 510, h: 573, alt: "The score screen: Team 1 on the left, Team 2 on the right, the called score and Undo." },
  },
  {
    icon: MonitorPlay, title: "A Live Board for the venue",
    body: "Put the courts on a TV or tablet: who is playing, the live score and who is up next.",
    points: ["Its own link and QR code for each game", "Keeps the screen awake", "Choose what shows: stars, queue position, wins"],
    shot: { src: "/help/live-board.png", w: 1280, h: 900, alt: "The Live Board with courts, scores and the queue." },
  },
];

const STEPS = [
  { title: "Post your open play", body: "Set the date, fee and seats, then share the booking link or QR code." },
  { title: "Players book and pay", body: "They pick a seat, pay by cash or GCash, and you see who's paid." },
  { title: "Start the game", body: "The queue rotates fairly, umpires keep score, and everyone sees their turn." },
];

const FAQ = [
  { q: "How much does it cost?", a: "CourtWave is free while in early access. Players will always be free." },
  { q: "Is it only for pickleball?", a: "For now, yes: CourtWave is built around pickleball open play, from the queue to side-out scoring. More sports are on the way." },
  { q: "Do players need an account?", a: "No. Anyone can book from your link without one. With an account, players also see their place in the queue, get notified when it's their turn, and can chat with the club." },
  { q: "Can I use it for one night without making a club?", a: "Yes. Start a quick session: no sign-up, the queue runs in your browser." },
  { q: "Does it work on any phone?", a: "Yes, in the browser on any phone, tablet or computer. Nothing to install." },
];

// The Android app isn't built yet. Set `apk` to the download link (and `version`) when it is, and the button turns on.
const ANDROID = { apk: null, version: null };
const APP_EXTRAS = ["Opens from your home screen like any app", "Volunteer umpires keep score over your phone's hotspot, even with no internet", "Keeps the screen awake for the Live Board"];

const QUEUE = [
  { who: "Ana, Ben, Cal, Dee", tag: "Court 1" },
  { who: "You're up next", tag: "~2 min", me: true },
  { who: "Eli", tag: "#3" },
  { who: "Fay", tag: "#4" },
];

function Wave({ className, fills }) {
  return (
    <svg className={className} viewBox="0 0 1440 260" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 150 C290 70 530 220 830 120 S1290 30 1440 80 L1440 260 L0 260Z" fill={fills[0]} />
      <path d="M0 190 C300 120 580 255 900 160 S1300 90 1440 125 L1440 260 L0 260Z" fill={fills[1]} />
    </svg>
  );
}

// Scroll effects, all opt-in: nothing is hidden until this runs, and reduced motion skips it.
// Sets --lp-y (px scrolled, for the hero depth) and --lp-p (0..1, the progress bar) on the page, marks the
// header once scrolled, and adds "in" to each [data-reveal] element as it enters the screen.
function useScrollFx(ref) {
  useEffect(() => {
    const root = ref.current;
    const html = document.documentElement;
    html.classList.add("lp-html");
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => html.classList.remove("lp-html");
    root.classList.add("lp-anim");
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const max = html.scrollHeight - window.innerHeight;
      root.style.setProperty("--lp-y", Math.min(y, 900));
      root.style.setProperty("--lp-p", max > 0 ? Math.min(y / max, 1) : 0);
      root.classList.toggle("lp-scrolled", y > 8);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    root.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => {
      html.classList.remove("lp-html");
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
      io.disconnect();
    };
  }, [ref]);
}

// --d staggers items that reveal together (seconds).
const d = (i) => ({ "--d": `${i * 0.09}s` });

export default function Landing({ navigate }) {
  const ref = useRef(null);
  useScrollFx(ref);
  const go = (to) => (e) => { e.preventDefault(); navigate(to); window.scrollTo({ top: 0, behavior: "instant" }); };
  const start = { href: "/signup", onClick: go("/signup") };
  const signIn = { href: "/signin", onClick: go("/signin") };

  return (
    <div className="landing" ref={ref}>
      <div className="lp-progress" aria-hidden="true" />
      <div className="lp-topbar">
        <header className="lp-top">
          <a className="lp-brand" href="/"><img src="/images/courtwave.png" alt="" /><span>CourtWave</span></a>
          <nav className="lp-nav" aria-label="Page">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#faq">Questions</a>
            <a href="#app">Get the app</a>
          </nav>
          <a className="lp-signin" {...signIn}>Sign in</a>
        </header>
      </div>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <h1>Catch your <span>wave.</span></h1>
          <p>One app for the whole pickleball game night. A fair queue, payments, umpires and live scores, so everyone knows when they're up.</p>
          <div className="lp-cta">
            <a className="lp-btn" {...start}>Get started</a>
            <a className="lp-link" {...signIn}>Sign in</a>
          </div>
          <p className="lp-sport"><span aria-hidden="true" />Made for pickleball. More sports are on the way.</p>
        </div>
        <div className="lp-phone" aria-label="Example: the queue on a player's phone">
          <b>Queue · Pub Club</b>
          {QUEUE.map((r) => (
            <div className={`lp-row${r.me ? " me" : ""}`} key={r.who}><span>{r.who}</span><span>{r.tag}</span></div>
          ))}
        </div>
        <Wave className="lp-hero-wave" fills={["var(--lp-lime)", "var(--lp-deep)"]} />
      </section>

      <section className="lp-dark lp-ways" aria-labelledby="lp-ways-title">
        <h2 id="lp-ways-title" data-reveal>Made for both sides of the net</h2>
        <div className="lp-ways-grid">
          <article data-reveal style={d(1)}>
            <CalendarCheck size={22} />
            <h3>For hosts</h3>
            <p>Run open play without a clipboard.</p>
            <ul>
              <li>Post sessions and take bookings</li>
              <li>Track payments, cash or GCash</li>
              <li>Let the queue and umpires run the courts</li>
            </ul>
            <a className="lp-btn lime" {...start}>Start hosting</a>
          </article>
          <article data-reveal style={d(2)}>
            <Users size={22} />
            <h3>For players</h3>
            <p>Find a game and stop guessing when you're on.</p>
            <ul>
              <li>Find open play from public clubs</li>
              <li>See your place in line, live</li>
              <li>Get notified when it's your turn</li>
            </ul>
            <a className="lp-btn lime" {...start}>Find a game</a>
          </article>
        </div>
      </section>

      <section className="lp-features" id="features" aria-label="Features">
        {FEATURES.map(({ icon: Icon, title, body, points, shot }, i) => (
          <div className="lp-feature" key={title}>
            <div className="lp-feature-text" data-reveal>
              <Icon size={22} />
              <h2>{title}</h2>
              <p>{body}</p>
              <ul>{points.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
            <figure className={`lp-shot${shot.w < 800 ? " narrow" : ""}`} data-reveal={i % 2 ? "left" : "right"} style={d(1)}>
              <img src={shot.src} width={shot.w} height={shot.h} alt={shot.alt} loading="lazy" />
            </figure>
          </div>
        ))}
      </section>

      <section className="lp-how" id="how" aria-labelledby="lp-how-title">
        <h2 id="lp-how-title" data-reveal>How a game night goes</h2>
        <ol>
          {STEPS.map((s, i) => <li key={s.title} data-reveal style={d(i + 1)}><h3>{s.title}</h3><p>{s.body}</p></li>)}
        </ol>
      </section>

      <section className="lp-faq" id="faq" aria-labelledby="lp-faq-title">
        <h2 id="lp-faq-title" data-reveal>Questions</h2>
        {FAQ.map((f, i) => (
          <details key={f.q} data-reveal style={d(i)}>
            <summary>{f.q}<ChevronDown size={18} /></summary>
            <p>{f.a}{f.q.startsWith("Can I use") && <> <a href="/club">Start a quick session</a></>}</p>
          </details>
        ))}
      </section>

      <section className="lp-app" id="app" aria-labelledby="lp-app-title">
        <h2 id="lp-app-title" data-reveal>Get the app</h2>
        <div className="lp-app-grid">
          <article className="lp-app-card" data-reveal style={d(1)}>
            <Smartphone size={22} />
            <h3>Android app {!ANDROID.apk && <span className="lp-soon">Coming soon</span>}</h3>
            <ul>{APP_EXTRAS.map((x) => <li key={x}>{x}</li>)}</ul>
            {ANDROID.apk
              ? <a className="lp-btn" href={ANDROID.apk} download><Download size={17} /> Download for Android{ANDROID.version && ` (v${ANDROID.version})`}</a>
              : <span className="lp-btn off" aria-disabled="true"><Download size={17} /> Download for Android</span>}
          </article>
          <article className="lp-app-card" data-reveal style={d(2)}>
            <Globe size={22} />
            <h3>Use it now in your browser</h3>
            <p>No download needed: CourtWave works on any phone, tablet or computer today.</p>
            <a className="lp-btn" {...start}>Get started</a>
          </article>
        </div>
      </section>

      <section className="lp-end">
        <Wave className="lp-end-wave" fills={["var(--lp-lime)", "var(--lp-deep)"]} />
        <div className="lp-end-body">
          <div data-reveal>
            <h2>Catch your <span>wave.</span></h2>
            <p>Set up your first open play in a few minutes.</p>
            <div className="lp-cta">
              <a className="lp-btn lime" {...start}>Get started</a>
              <a className="lp-link light" {...signIn}>Sign in</a>
            </div>
          </div>
          <footer>
            <span>CourtWave</span>
            <a href="/club">Quick session</a>
          </footer>
        </div>
      </section>
    </div>
  );
}
