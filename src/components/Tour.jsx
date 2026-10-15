import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEscape } from "../hooks/useEscape";

const PAD = 6;
const GAP = 12;

// A step's selector may list fallbacks ("a, b"): the first one with a visible match wins, in the order written
// (querySelectorAll on the whole list would return page order instead).
const findTarget = (selector) => {
  for (const one of (selector || "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const el = [...document.querySelectorAll(one)].find((e) => e.getBoundingClientRect().width > 0);
    if (el) return el;
  }
  return null;
};

// A spotlight tour over the real screen: the page dims, the step's target is cut out and a card explains it.
// `onStep(step)` lets the app show the step's tab (and open the sidebar drawer on a phone) before the target is measured.
// The page under the tour can't be clicked; Esc or Skip ends it.
export default function Tour({ steps, onStep, onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [cardH, setCardH] = useState(200);
  const cardRef = useRef(null);
  const nextRef = useRef(null);
  const step = steps[i];
  const last = i === steps.length - 1;
  useEscape(onClose);

  // The spotlight keeps the last step's place until the new target is measured, so it glides from one to the next.
  // With no target it shrinks to a point in the middle of the screen (the page stays dimmed, the card is centered).
  useEffect(() => {
    onStep(step);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let el = null;
    const measure = () => {
      const r = el?.getBoundingClientRect();
      setRect(r && r.width > 0
        ? { top: r.top, left: r.left, width: r.width, height: r.height }
        : { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0, empty: true });
    };
    // Wait for the tab to render and a phone's drawer to slide in (0.3s) before finding the target.
    const t = setTimeout(() => {
      el = findTarget(step.target);
      el?.scrollIntoView({ block: el.offsetHeight > window.innerHeight * 0.45 ? "start" : "center", behavior: reduce ? "auto" : "smooth" });
      measure();
    }, step.side || step.open ? 340 : 80); // a drawer or a window the app just opened animates in first
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => { if (cardRef.current) setCardH(cardRef.current.offsetHeight); });
  useEffect(() => { nextRef.current?.focus({ preventScroll: true }); }, [i]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(step.image ? 420 : 360, vw - 32);
  let cardStyle;
  if (!rect || rect.empty) {
    cardStyle = { left: (vw - cardW) / 2, top: Math.max(16, (vh - cardH) / 2) };
  } else {
    const left = Math.min(Math.max(16, rect.left), vw - cardW - 16);
    const below = rect.top + rect.height + PAD + GAP;
    const above = rect.top - PAD - GAP - cardH;
    cardStyle = below + cardH < vh - 16 ? { left, top: below }
      : above > 16 ? { left, top: above }
      : { left: (vw - cardW) / 2, top: vh - cardH - 16 }; // a tall target: dock at the bottom
  }

  return createPortal(
    <div className="tour" role="presentation">
      {rect ? (
        <div className={`tour-spot${rect.empty ? " is-empty" : ""}`} style={rect.empty ? { top: rect.top, left: rect.left, width: 0, height: 0 } : {
          top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2,
        }} />
      ) : <div className="tour-dim" />}
      <div className="tour-card" ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body"
        style={{ ...cardStyle, width: cardW }}>
        <div className="tour-card-top">
          <span className="tour-count">{i + 1} of {steps.length}</span>
          <button type="button" className="icon" onClick={onClose} aria-label="End tour"><X size={16} /></button>
        </div>
        <div className="tour-copy" key={i}>
          <h3 id="tour-title">{step.title}</h3>
          <p id="tour-body" aria-live="polite">{step.body}</p>
          {step.image && <img className="tour-image" src={step.image.src} alt={step.image.alt} width={step.image.w} height={step.image.h} />}
        </div>
        <div className="tour-bar" aria-hidden="true"><i style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
        <div className="tour-actions">
          {!last && <button type="button" className="text tour-skip" onClick={onClose}>Skip tour</button>}
          {i > 0 && <button type="button" className="outline" onClick={() => setI(i - 1)}>Back</button>}
          <button type="button" className="primary" ref={nextRef} onClick={() => (last ? onClose() : setI(i + 1))}>
            {last ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// The once-per-device offer, shown the first time someone opens a quick session or an open play game.
export function TourOffer({ title, onStart, onDismiss }) {
  return (
    <div className="tour-offer" role="dialog" aria-labelledby="tour-offer-title">
      <div>
        <b id="tour-offer-title">{title}</b>
        <span>A short tour of the courts, the queue, umpires and payments.</span>
      </div>
      <div className="tour-offer-actions">
        <button type="button" className="outline" onClick={onDismiss}>Not now</button>
        <button type="button" className="primary" onClick={onStart}>Take the tour</button>
      </div>
    </div>
  );
}
