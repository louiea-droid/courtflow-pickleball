import { Menu, Share2 } from "lucide-react";
import { TITLES } from "../data/constants";
import PhClock from "./PhClock";

export default function Topbar({ tab, onOpenMenu, onShare }) {
  const [title, subtitle] = TITLES[tab];
  return (
    <header className="topbar">
      <button className="icon hamburger" onClick={onOpenMenu} aria-label="Open menu"><Menu /></button>
      <div>
        <div className="eyebrow">OPEN PLAY SESSION</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="actions">
        <PhClock />
        <button className="outline" onClick={onShare}><Share2 /> Share Live Board</button>
      </div>
    </header>
  );
}
