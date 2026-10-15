import { Menu, Plus, Share2 } from "lucide-react";
import { TITLES } from "../data/constants";
import PhClock from "./PhClock";

export default function Topbar({ tab, onOpenMenu, onShare, onAddPlayer, eyebrow, showShare = true }) {
  const [title, subtitle] = TITLES[tab];
  return (
    <header className="topbar">
      <button className="icon hamburger" onClick={onOpenMenu} aria-label="Open menu"><Menu /></button>
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="actions">
        <button className="primary" data-tour="add-player" onClick={onAddPlayer}><Plus /> Add Player</button>
        <PhClock />
        {showShare && (
          <button className="outline" data-tour="share" onClick={onShare}><Share2 /> Share<span className="share-btn-full"> Live Board</span></button>
        )}
      </div>
      <button className="fab-add" data-tour="add-player" onClick={onAddPlayer} aria-label="Add player"><Plus /></button>
    </header>
  );
}
