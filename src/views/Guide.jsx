import { useState } from "react";
import {
  LogIn, LayoutDashboard, ListOrdered, Users, Receipt, Trophy, MonitorPlay, CalendarCheck, Compass, UserCheck, ChevronRight,
} from "lucide-react";
import Modal from "../components/Modal";
import StarDisplay from "../components/StarDisplay";
import { MODE_DESCRIPTIONS, COMING_SOON_MODES } from "../data/constants";
import { GUIDE_FEATURES } from "../data/guide";
import { SKILL_LEVELS } from "../utils/courtLevels";

const ICONS = {
  quick: LogIn, "open-play": CalendarCheck, dashboard: LayoutDashboard, umpires: UserCheck, queue: ListOrdered,
  players: Users, payment: Receipt, stats: Trophy, "live-board": MonitorPlay,
};

const MODE_NOTES = {
  "Balanced": "Next in the queue.",
  "Skill Separated": "Same level first.",
  "Custom": "You decide.",
  "Winners / Losers": "Winners stay on.",
  "Mixed Doubles": "One man and one woman per team.",
};

const RULES = [
  { title: "Scoring", body: "Games are usually to 11, win by 2, and only the serving side scores. CourtWave can keep the score for you (side-out or rally, to 11, 15 or 21) from the Score button on a court, or just record who won each match." },
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

// A screenshot from public/help/; a missing file shows only its caption. Tapping it opens the full size.
function Shot({ shot }) {
  const [broken, setBroken] = useState(false);
  return (
    <figure className="guide-shot">
      {!broken && (
        <a href={shot.src} target="_blank" rel="noopener noreferrer" title="Open full size" style={{ maxWidth: shot.w }}>
          <img src={shot.src} alt={shot.alt} width={shot.w} height={shot.h} loading="lazy" onError={() => setBroken(true)} />
        </a>
      )}
      <figcaption>{shot.caption}</figcaption>
    </figure>
  );
}

// One feature in full: what it is, pictures, the steps, then the finer points.
function FeatureDetail({ feature, close }) {
  return (
    <Modal title={feature.title} label="Guide" close={close} className="guide-modal">
      <div className="guide-detail">
        <p className="guide-detail-summary">{feature.summary}</p>
        <Shot shot={feature.shots[0]} />
        <h4>How it works</h4>
        <ol className="guide-steps">
          {feature.steps.map((step) => <li key={step}><p>{step}</p></li>)}
        </ol>
        {feature.shots.slice(1).map((s) => <Shot key={s.src} shot={s} />)}
        {feature.notes.length > 0 && (
          <>
            <h4>Good to know</h4>
            <div className="guide-cards guide-notes">
              {feature.notes.map((n) => (
                <article className="guide-card" key={n.title}>
                  <div><strong>{n.title}</strong><p>{n.body}</p></div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function Guide({ onStartTour }) {
  const [open, setOpen] = useState(null); // the feature whose details are showing
  return (
    <div className="guide">
      {onStartTour && (
        <div className="panel guide-tour">
          <span className="guide-ico"><Compass size={18} /></span>
          <div>
            <strong>New here? Take the quick tour</strong>
            <p>A short walk through the real screens: players, check-in, courts, umpires, the Live Board and payments.</p>
          </div>
          <button type="button" className="primary" data-tour="tour-start" onClick={onStartTour}>Start tour</button>
        </div>
      )}
      <nav className="guide-jump" aria-label="Guide sections">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#guide-${id}`} onClick={(e) => jump(e, id)}>{label}</a>
        ))}
      </nav>

      <Section id="how" title="How CourtWave works" sub="Tap a card for the details, with pictures.">
        <div className="guide-cards">
          {GUIDE_FEATURES.map((f) => {
            const Icon = ICONS[f.id] || Compass;
            return (
              <button type="button" className="guide-card guide-card-link" key={f.id} onClick={() => setOpen(f)} aria-haspopup="dialog">
                <span className="guide-ico"><Icon size={16} /></span>
                <div><strong>{f.title}</strong><p>{f.card}</p><span className="guide-more">See how it works <ChevronRight size={14} /></span></div>
              </button>
            );
          })}
        </div>
      </Section>
      {open && <FeatureDetail feature={open} close={() => setOpen(null)} />}

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
