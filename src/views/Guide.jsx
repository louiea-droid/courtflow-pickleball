import {
  LogIn, LayoutDashboard, ListOrdered, Users, Receipt, Trophy, MonitorPlay, CalendarCheck,
} from "lucide-react";
import StarDisplay from "../components/StarDisplay";
import { MODE_DESCRIPTIONS, COMING_SOON_MODES } from "../data/constants";
import { SKILL_LEVELS } from "../utils/courtLevels";

const FEATURES = [
  {
    icon: LogIn, title: "Quick session",
    body: "No account needed. Open the app and your session is ready, saved in this browser. When play is done, End Session in the sidebar archives the stats and resets game counts (see Stats, Past Sessions).",
  },
  {
    icon: CalendarCheck, title: "Open play game",
    body: "Signed-in hosts run a game from an event: Proceed to game adds the people who booked, and the same queue app runs the courts. End game keeps everything; Reopen game picks it back up.",
  },
  {
    icon: LayoutDashboard, title: "Dashboard",
    body: "Every court at a glance. Record a winner and the court rotates by your mode. Up Next previews who goes on each court; Auto-fill seats all open courts at once, and Undo on the toast fixes a mis-tap.",
  },
  {
    icon: ListOrdered, title: "Queue",
    body: "Who is waiting, fewest games first, then longest wait. Send someone straight to an open court, skip them to the back, or check people in the moment they arrive.",
  },
  {
    icon: Users, title: "Players",
    body: "Add players, set their skill stars and gender, lock two players as a pair, or edit and remove them. Each card shows games, wins and win percentage.",
  },
  {
    icon: Receipt, title: "Payment",
    body: "Log a court rental and split it across everyone who played. Mark who has paid, and optionally show the split on the Live Board.",
  },
  {
    icon: Trophy, title: "Stats",
    body: "The leaderboard by win percentage, with games won. Export to CSV, or open Past Sessions for earlier results.",
  },
  {
    icon: MonitorPlay, title: "Live Board",
    body: "A read-only screen for a TV or phone: live courts, the queue and recent matches. Open it from Share Live Board in the top bar.",
  },
];

const MODE_NOTES = {
  "Balanced": "Next in the queue.",
  "Skill Separated": "Same level first.",
  "Custom": "You decide.",
  "Winners / Losers": "Winners stay on.",
  "Mixed Doubles": "One man and one woman per team.",
};

const RULES = [
  { title: "Scoring", body: "Games are usually to 11, win by 2, and only the serving side scores. CourtFlow records who won each match, not the points." },
  { title: "Serving", body: "Serve underhand, diagonally into the opponent's box. In doubles, both partners usually serve before the serve passes to the other team." },
  { title: "Double bounce", body: "The serve and its return must each bounce once before anyone volleys. After that, either side may hit the ball out of the air." },
  { title: "The kitchen", body: "The 7-foot zone at the net. You can't volley while standing in it, even if your momentum carries you in after the hit." },
  { title: "Faults", body: "A rally ends when the ball goes out, hits the net, is volleyed from the kitchen, or bounces twice. A fault by the serving side ends their serve." },
];

const SKILL_BLURBS = {
  "Beginner": "New to the game: still learning the rules, serve and basic shot control.",
  "Advanced Beginner": "Comfortable in a rally: working on consistency, positioning and the kitchen line.",
  "Intermediate": "Reliable shot placement and some dinking control; starting to play with strategy.",
  "Advanced Intermediate": "Strong all-around game: consistent net play, third-shot drops, good court awareness.",
  "Advanced": "Competitive, tournament-capable play with wide shot variety and sharp strategy.",
  "Expert": "Tournament-caliber: exceptional consistency, control and reading of the game.",
};

const SECTIONS = [
  ["how", "How it works"],
  ["modes", "Rotation modes"],
  ["skill", "Skill levels"],
  ["rules", "Pickleball rules"],
];

function jump(e, id) {
  e.preventDefault();
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

function Section({ id, title, sub, children }) {
  return (
    <section className="guide-block" id={`guide-${id}`} aria-labelledby={`guide-${id}-h`}>
      <header><h3 id={`guide-${id}-h`}>{title}</h3><p>{sub}</p></header>
      {children}
    </section>
  );
}

export default function Guide() {
  return (
    <div className="guide">
      <nav className="guide-jump" aria-label="Guide sections">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#guide-${id}`} onClick={(e) => jump(e, id)}>{label}</a>
        ))}
      </nav>

      <Section id="how" title="How CourtFlow works" sub="What each part of the app does.">
        <div className="guide-cards">
          {FEATURES.map((f) => (
            <article className="guide-card" key={f.title}>
              <span className="guide-ico"><f.icon size={16} /></span>
              <div><strong>{f.title}</strong><p>{f.body}</p></div>
            </article>
          ))}
        </div>
      </Section>

      <Section id="modes" title="Rotation modes" sub="How the queue decides who plays next. Change it from the mode picker or in Settings.">
        <p className="guide-intro">
          Two things hold in every mode: players with fewer games go first, and a court's level badge
          only lets matching players onto it. The mode decides how each match is formed.
        </p>
        <div className="guide-cards">
          {Object.entries(MODE_DESCRIPTIONS).map(([mode, desc]) => (
            <article className="guide-card guide-mode" key={mode}>
              <div>
                <strong>
                  {mode}
                  {COMING_SOON_MODES.includes(mode) && <span className="soon-tag guide-soon">Soon</span>}
                </strong>
                {MODE_NOTES[mode] && <em>{MODE_NOTES[mode]}</em>}
                <p>{desc}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section id="skill" title="Skill levels" sub="What the star rating means, and how court levels use it.">
        <p className="guide-intro">
          Every player has a 1 to 6 star rating. Set a court's level on the Dashboard and only players of
          that level fill its open seats. Unrated players can play on Any Level courts.
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
      </Section>

      <Section id="rules" title="Pickleball rules" sub="A quick primer on the game itself.">
        <div className="guide-cards">
          {RULES.map((r) => (
            <article className="guide-card" key={r.title}>
              <div><strong>{r.title}</strong><p>{r.body}</p></div>
            </article>
          ))}
        </div>
      </Section>
    </div>
  );
}
