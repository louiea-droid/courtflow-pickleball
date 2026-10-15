// The guided tour of the queue app (components/Tour.jsx), started from the Guide and offered once per device.
// Each step: the tab to show, a CSS selector for the thing to point at (the first visible match; none or no match =
// a centered card), whether it lives in the sidebar (opened as a drawer on a phone), `open` (a window the app opens
// for that step, e.g. "umpires"), `image` (a picture shown in the card), and the words; a { quick, event } pair
// differs by kind, and `only` keeps a step to one kind. A target list ("a, b") is tried in the order written. Checked by src/utils/tour.check.mjs.
const STEPS = [
  {
    tab: "dashboard",
    title: { quick: "Welcome to your quick session", event: "Welcome to your open play game" },
    body: {
      quick: "No account needed: this session is saved in this browser. Here is how to run the courts.",
      event: "This is the queue for this game. Here is how to run it, from check-in to collecting fees.",
    },
  },
  {
    tab: "dashboard", target: '[data-tour="add-player"]',
    title: "Add players",
    body: {
      quick: "Add everyone who is playing, with a skill level (stars) so games stay even.",
      event: "Everyone who booked was brought in from the event. Add walk-ins here, with a skill level so games stay even.",
    },
  },
  {
    tab: "queue", target: '[data-tour="checkin"]',
    title: "Check people in",
    body: "Only checked-in players join the queue. Open this list and tap Check in as each person arrives.",
  },
  {
    tab: "queue", target: ".lock-btn.active, .lock-btn",
    title: "Lock in partners",
    body: "Lock In pairs two players so they always play on the same team: tap Lock In (the link icon on a phone) on one, then on the other. A locked player shows their partner under their name; tap it again to unlock.",
  },
  {
    tab: "queue", target: '[data-tour="mode"]', side: true,
    title: "Pick how the queue works",
    body: "Balanced mixes skill levels evenly, Skill Separated keeps levels together, Winners / Losers keeps winners on, Mixed Doubles pairs a man and a woman, Custom is all manual.",
  },
  {
    tab: "dashboard", target: '[data-tour="autofill"]',
    title: "Fill the courts, record winners",
    body: "Auto-fill seats the next players on every empty court. When a game ends, tap the winning team on its court: the players rotate and the next match comes on.",
  },
  {
    tab: "dashboard", target: ".court.preview",
    title: "Up Next",
    body: "Up Next shows who goes on each court next, so players can get ready. Swap or remove someone before the court frees up.",
  },
  {
    tab: "dashboard", target: '[data-tour="match-log"]',
    title: "Match log",
    body: "Every result you record lands here: who played, who won, and the score when one was kept.",
  },
  {
    tab: "dashboard", target: '[data-tour="umpires"]',
    title: "Volunteer umpires",
    body: "No time to keep score? Volunteers can do it from their own phones, one court each, with no account.",
  },
  {
    tab: "dashboard", target: ".modal", open: "umpires",
    title: "The Umpires window",
    body: {
      quick: "Turn on Allow volunteer umpires, then share the link or let volunteers scan the QR code. You see who holds each court, and New link stops old links.",
      event: "Create the link, then share it or let volunteers scan the QR code. You see who holds each court, and New link stops old links.",
    },
  },
  {
    tab: "dashboard", image: { src: "/help/scorekeeper.png", w: 510, h: 573, alt: "The score screen: Team 1 on the left, Team 2 on the right, the called score and Undo." },
    title: "What the umpire sees",
    body: "They tap the team that won each rally. The score is called for them, and when the game ends you tap Confirm on the court card.",
  },
  {
    tab: "dashboard", target: '[data-tour="share"]',
    title: "Show the Live Board",
    body: "Put the courts, scores and the queue on a TV or share the link, so players can see when they are up next.",
  },
  {
    tab: "cost", target: ".open-play-fees .fee-progress, .open-play-fees", only: "event",
    title: "Collect fees",
    body: "Payment shows how much of the booking fee is collected and what is still owed, for everyone in the game.",
  },
  {
    tab: "cost", target: ".fee-list .fee-row, .fee-list", only: "event",
    title: "Mark who paid",
    body: "Tap a player's pill to switch Paid and Unpaid, and pick Cash or GCash. Mark all as paid does everyone at once, and Export to Excel saves the list.",
  },
  {
    tab: "cost", target: ".rental-fold", only: "event",
    title: "Split a court rental",
    body: "Paid for the courts yourself? Open this to split the rental between the players and track who still owes.",
  },
  {
    tab: "cost", target: ".cost-form .cost-calc-grid, .cost-form", only: "quick",
    title: "Split the court rental",
    body: "Enter the rate per hour, the hours and the courts, and pick who is splitting.",
  },
  {
    tab: "cost", target: ".rental-total", only: "quick",
    title: "Everyone's share",
    body: "The total and each person's share are worked out as you type. Save Entry keeps it.",
  },
  {
    tab: "cost", target: ".history-panel", only: "quick",
    title: "Who still owes",
    body: "Each saved split lists who has paid. Tick people off as they pay, and show it on the Live Board if you like.",
  },
  {
    tab: "guide", target: '[data-tour="tour-start"]',
    title: "That's it",
    body: {
      quick: "Press End Session in the sidebar when play is over. Tap any card in this Guide for the details, with pictures.",
      event: "Press End game in the sidebar when play is over. Tap any card in this Guide for the details, with pictures.",
    },
  },
];

const pick = (v, kind) => (typeof v === "string" ? v : v[kind]);

export function tourSteps(kind) {
  return STEPS.filter((s) => !s.only || s.only === kind)
    .map((s) => ({ ...s, title: pick(s.title, kind), body: pick(s.body, kind) }));
}

export const tourSeenKey = (kind) => `courtflow.tourOffered.${kind}`;
