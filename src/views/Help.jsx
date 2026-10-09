import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import PageTitle from "../components/PageTitle";
import { MAJOR, MINOR } from "../data/help";
import { filterHelp } from "../utils/help";

// Screens that are their own page, so a link to them is a normal page load, not an in-app navigation.
const OWN_PAGE = ["/club"];

// A screenshot in a frame. A missing file hides the image and keeps the caption, so the page never shows a broken icon.
function Shot({ shot }) {
  const [broken, setBroken] = useState(false);
  return (
    <figure className="help-shot">
      {!broken && (
        <a href={shot.src} target="_blank" rel="noopener noreferrer" title="Open full size">
          <img src={shot.src} alt={shot.alt} width={shot.w} height={shot.h} loading="lazy" onError={() => setBroken(true)} />
        </a>
      )}
      <figcaption>{shot.caption}</figcaption>
    </figure>
  );
}

export default function Help({ navigate }) {
  const [text, setText] = useState("");
  const found = filterHelp(text);
  // The featured section (the queue) always comes first, in the list and on the page.
  const major = [...found.major].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  const { minor } = found;
  // Changes whenever the visible sections change (not only their count), so the highlight observer re-attaches.
  const shownKey = major.map((s) => s.id).join() + "|" + minor.map((m) => m.id).join();
  const [active, setActive] = useState((MAJOR.find((s) => s.featured) || MAJOR[0]).id);
  const pageRef = useRef(null);
  const bodyRef = useRef(null);

  // The contents list follows the section in view.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !pageRef.current) return undefined;
    const seen = new Map();
    // On a wide screen the guide scrolls inside its own pane; on a phone the page itself scrolls.
    const root = bodyRef.current && getComputedStyle(bodyRef.current).overflowY === "auto" ? bodyRef.current : null;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
      const top = [...seen.entries()].filter(([, r]) => r > 0).map(([id]) => id)[0];
      if (top) setActive(top);
    }, { root, rootMargin: root ? "-10px 0px -60% 0px" : "-120px 0px -55% 0px", threshold: [0, 0.1] });
    pageRef.current.querySelectorAll("[data-help]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [shownKey]);

  // If a search hides the highlighted section, fall back to the first one still shown.
  const visibleIds = shownKey.split("|").join(",").split(",").filter(Boolean);
  const current = visibleIds.includes(active) ? active : visibleIds[0];

  const jump = (id) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };
  const to = (path) => (e) => {
    if (OWN_PAGE.includes(path) || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return; // let the browser open it (new tab, own page)
    e.preventDefault();
    navigate(path);
  };
  const none = major.length + minor.length === 0;

  return (
    <div className="help-page" ref={pageRef}>
      <div className="help-top">
        <PageTitle title="Help" sub="How CourtFlow works, from finding a session to how the queue picks who plays next." />
        <div className="help-searchbar">
          <label className="find-search">
            <Search size={16} />
            <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search help" aria-label="Search help" />
          </label>
        </div>
      </div>

      {none ? (
        <p className="hub-empty">No help matches that. Try a shorter word, like "queue" or "book".</p>
      ) : (
        <div className="help-layout">
          <nav className="help-toc" aria-label="Contents">
            <select className="help-jump" aria-label="Jump to" value={current} onChange={(e) => jump(e.target.value)}>
              {major.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              {minor.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
            <ul>
              {major.map((s) => (
                <li key={s.id}><a href={`#${s.id}`} className={s.featured ? "help-toc-featured" : undefined} aria-current={current === s.id ? "true" : undefined} onClick={(e) => { e.preventDefault(); jump(s.id); }}>{s.title}</a></li>
              ))}
            </ul>
            {minor.length > 0 && (
              <>
                <p className="help-toc-label">More</p>
                <ul>
                  {minor.map((m) => (
                    <li key={m.id}><a href={`#${m.id}`} aria-current={current === m.id ? "true" : undefined} onClick={(e) => { e.preventDefault(); jump(m.id); }}>{m.title}</a></li>
                  ))}
                </ul>
              </>
            )}
          </nav>

          <div className="help-body" ref={bodyRef}>
            {major.map((s) => (
              <section key={s.id} id={s.id} data-help className={`panel help-section${s.featured ? " help-featured" : ""}`} aria-labelledby={`${s.id}-h`}>
                <h2 id={`${s.id}-h`}>{s.title}{s.featured && <span className="pill">Featured</span>}</h2>
                <p className="help-summary">{s.summary}</p>
                <ol className="help-steps">{s.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                <div className="help-shots">{s.shots.map((shot) => <Shot key={shot.src} shot={shot} />)}</div>
                {s.go && <a className="outline" href={s.go.to} onClick={to(s.go.to)}>{s.go.label}</a>}
                {s.extra && (
                  <div className="help-extra">
                    {s.extra.map((x) => (
                      <article key={x.title}><h3>{x.title}</h3><p>{x.body}</p></article>
                    ))}
                  </div>
                )}
              </section>
            ))}

            {minor.length > 0 && (
              <section className="help-minor" aria-label="More">
                <h2 className="club-section">More</h2>
                {minor.map((m) => (
                  <article key={m.id} id={m.id} data-help><h3>{m.title}</h3><p>{m.body}</p></article>
                ))}
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
