import { useState } from "react";
import {
  ChevronDown, LogIn, LayoutDashboard, ListOrdered, Users, Receipt, Trophy, MonitorPlay,
} from "lucide-react";
import StarDisplay from "../components/StarDisplay";
import { MODE_DESCRIPTIONS, COMING_SOON_MODES } from "../data/constants";
import { SKILL_LEVELS } from "../utils/courtLevels";

const FEATURES = [
  {
    icon: LogIn, title: "Club Login",
    body: "Your club name is your session — no password. A new name starts a fresh session; an existing one continues it, keeping your roster but renewing everyone's game count. Whatever was played gets archived first, so nothing is lost — see it under Stats → Past Sessions.",
  },
  {
    icon: LayoutDashboard, title: "Dashboard",
    body: "The live view of every court. Start the next match, record who won to rotate the completed players back into the queue, and preview who's up next. Auto-fill seats open courts from the queue in one click; Auto-rotation controls whether a court refills itself automatically after a win.",
  },
  {
    icon: ListOrdered, title: "Queue",
    body: "Who's waiting, in priority order (fewer games and longer wait go first). Call a player straight to an open court, or check someone out when they leave. The Not Checked In list is a quick way to check someone in the moment they arrive.",
  },
  {
    icon: Users, title: "Players",
    body: "Your roster — add players, set their skill rating, edit details, or remove someone. Each card shows games, wins, and win % for the current session.",
  },
  {
    icon: Receipt, title: "Cost",
    body: "Log a court rental (rate × hours × courts) and split it evenly across whoever played. Track who's paid with a tap, and optionally flip on \"Show on Live Board\" so players can see the split themselves.",
  },
  {
    icon: Trophy, title: "Stats",
    body: "The session leaderboard, sorted by win percentage. Export everything to CSV, or expand Past Sessions to see the results from before the last time this club's games were renewed.",
  },
  {
    icon: MonitorPlay, title: "Live Board",
    body: "A read-only screen you can share or put on a TV — live courts, the waiting queue, and the match log, sized to fit any screen with no scrolling. Open it from Share Live Board in the top bar.",
  },
];

const RULES = [
  {
    title: "Scoring",
    body: "Games are typically played to 11 points, win by 2. Only the serving side can score a point. CourtFlow tracks who won each match, not the point-by-point score — keep that on a scoreboard or by voice.",
  },
  {
    title: "Serving",
    body: "Serve underhand, below the waist, diagonally into the opponent's service box. In doubles, the serve alternates sides of the court as the server's score changes, and both partners typically get a turn to serve before the serve passes to the other team.",
  },
  {
    title: "The double-bounce rule",
    body: "After the serve, the ball must bounce once on the return and once on the serve-return before either side can hit it out of the air. After that, either side may volley.",
  },
  {
    title: "The kitchen (non-volley zone)",
    body: "The 7-foot zone on each side of the net. You can't volley the ball (hit it before it bounces) while standing inside it — or even if your momentum carries you in right after.",
  },
  {
    title: "Faults",
    body: "A rally ends when the ball goes out of bounds, into the net, is volleyed from the kitchen, or bounces twice before it's returned. A fault on the serving side ends their turn to serve (or the game, if it's match point).",
  },
];

const SKILL_BLURBS = {
  "Beginner": "New to the game — still learning the rules, serve, and basic shot control.",
  "Advanced Beginner": "Comfortable in a rally — working on consistency, positioning, and the kitchen line.",
  "Intermediate": "Reliable shot placement and some dinking control; starting to play with strategy.",
  "Advanced Intermediate": "Strong all-around game — consistent net play, third-shot drops, good court awareness.",
  "Advanced": "Competitive, tournament-capable play with a wide shot variety and sharp strategy.",
  "Expert": "Tournament-caliber — exceptional consistency, control, and reading of the game.",
};

function GuideSection({ title, sub, defaultOpen, children }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div className="panel guide-section">
      <button className="guide-section-head" onClick={() => setOpen((o) => !o)}>
        <div><h3>{title}</h3><span>{sub}</span></div>
        <ChevronDown size={18} className={open ? "rot" : ""} />
      </button>
      {open && <div className="guide-section-body">{children}</div>}
    </div>
  );
}

export default function Guide() {
  return (
    <>
      <GuideSection title="How CourtFlow Works" sub="What each part of the app does" defaultOpen>
        <div className="rules guide-features">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <b><f.icon size={14} /></b>
              <div><strong>{f.title}</strong><p>{f.body}</p></div>
            </div>
          ))}
        </div>
      </GuideSection>

      <GuideSection title="Rotation Modes" sub="How the queue decides who plays next">
        <p className="guide-intro">
          Two rules hold no matter which mode is active: players with fewer games get priority in
          the queue, and a court's skill level restricts who can rotate onto it — set it via the
          badge on each court. The mode you pick decides everything else about how teams get formed.
        </p>
        <div className="rules">
          {Object.entries(MODE_DESCRIPTIONS).map(([mode, desc], i) => (
            <div key={mode}>
              <b>{i + 1}</b>
              <div>
                <strong>
                  {mode}
                  {COMING_SOON_MODES.includes(mode) && <span className="soon-tag guide-soon">Soon</span>}
                </strong>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </GuideSection>

      <GuideSection title="Skill Levels" sub="What the star rating means, and how court levels use it">
        <p className="guide-intro">
          Every player has a 1–6 star skill rating. Set a court's level badge on the Dashboard to
          restrict who can rotate onto it — only players matching that rating will fill an open seat there.
        </p>
        <div className="guide-skill-grid">
          {SKILL_LEVELS.map((t) => (
            <div className="guide-skill-row" key={t.key}>
              <StarDisplay value={t.stars} />
              <b>{t.key}</b>
              <span>{SKILL_BLURBS[t.key]}</span>
            </div>
          ))}
        </div>
      </GuideSection>

      <GuideSection title="Pickleball Rules" sub="A quick primer on the game itself">
        <div className="rules">
          {RULES.map((r, i) => (
            <div key={r.title}>
              <b>{i + 1}</b>
              <div><strong>{r.title}</strong><p>{r.body}</p></div>
            </div>
          ))}
        </div>
      </GuideSection>
    </>
  );
}
