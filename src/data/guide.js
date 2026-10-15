// The queue app's Guide (views/Guide.jsx): one card per feature, and a detail window when a card is opened.
// `card` is the short line on the card; `summary`, `steps`, `notes` and `shots` fill the window. Screenshots live in
// public/help/ (shared with the Help page; docs/help-screenshots.md says how to retake them). Checked by
// src/utils/guide.check.mjs (every screenshot file exists, w / h set).
const shot = (file, w, h, alt, caption) => ({ src: `/help/${file}`, w, h, alt, caption });

export const GUIDE_FEATURES = [
  {
    id: "quick", title: "Quick session",
    card: "No account needed: run the courts straight from this browser.",
    summary: "A quick session is the queue app with no setup. It is saved in this browser, so it is ready the moment you open it.",
    steps: [
      "Open Quick session from Home (or open the app without signing in). Your session starts right away.",
      "Add the players who came, with their skill stars, and check them in as they arrive.",
      "Fill the courts with Auto-fill and record each winner. The queue rotates by itself.",
      "When play is over, press End Session in the sidebar: the stats are archived to Stats, Past Sessions, and the courts are cleared for next time.",
    ],
    notes: [
      { title: "Saved in this browser", body: "Clearing this browser's site data starts a fresh session. If you are signed in, the session is kept with your account instead." },
      { title: "Settings", body: "A quick session has its own Settings: queue rules, scoring, cost defaults, the Live Board and your colors. Erase this session starts a blank one." },
    ],
    shots: [shot("quick-session.png", 1280, 900, "The quick session dashboard with two courts in play and the queue.", "A quick session: courts in play and the players waiting.")],
  },
  {
    id: "open-play", title: "Open play game",
    card: "Run a booked open play: bring in who booked, run the courts, collect the fees.",
    summary: "A signed-in host runs a game from an open play event. The people who booked come into the same queue app, and payments are tracked for you.",
    steps: [
      "On the event page, set Court settings first if you like: how many courts, the format, the mode and the team colors.",
      "Press Proceed to game and tick who to bring in. They join the game not checked in, so you check each one in as they arrive.",
      "Run the courts as usual. Back to game in the top bar takes you back from anywhere while the game is live.",
      "Someone booked late? Add players to game on the event page brings them in, and is safe to repeat.",
      "Press End game when play is over. Everything stays saved, the event page shows who paid with Export to Excel, and Reopen game picks it back up.",
    ],
    notes: [
      { title: "Play now", body: "No event planned? Play now in Club tools starts a game for today straight away, with no seats. Type a fee on the Payment page if you charge one." },
      { title: "Settings for the club", body: "Queue rules, scoring and the Live Board for a club are in Settings, in your account menu." },
    ],
    shots: [
      shot("event-page.png", 1280, 900, "An open play event page with the players who booked, their payments, and the game buttons.", "The event page: who booked, who paid, and the game buttons."),
      shot("game-dashboard.png", 1280, 900, "The game dashboard with two courts in play and the next players shown below.", "The game's dashboard."),
    ],
  },
  {
    id: "dashboard", title: "Dashboard",
    card: "Every court at a glance: who is playing, for how long, and who is next.",
    summary: "The Dashboard is where you run the courts: seat players, record winners and see who is up next.",
    steps: [
      "Each court shows both teams and a timer. The timer turns red once a game runs past the game length alert in Settings.",
      "When a game ends, tap Team 1 Wins or Team 2 Wins. The players rotate by your mode, and with Auto-rotation on the next match comes on by itself.",
      "Tapped the wrong team? Undo on the message puts everything back for about 10 seconds.",
      "Up Next shows who goes on each court next. You can change it before the court frees up.",
      "Auto-fill seats every empty court at once. Add Court and the ✕ on a court change how many you run, and a court's level badge keeps it to one skill level.",
    ],
    notes: [
      { title: "Keep score", body: "The score button on a live court keeps the score point by point. See Umpires." },
      { title: "Mode", body: "The mode picker in the sidebar decides how matches are made. See Rotation modes below." },
    ],
    shots: [
      shot("game-dashboard.png", 1280, 900, "The dashboard with two courts in play and the next players shown below.", "Courts in play, with Up Next below."),
      shot("modes.png", 1280, 900, "The mode picker listing Balanced, Skill Separated, Custom, Winners / Losers and Mixed Doubles.", "The mode picker in the sidebar."),
    ],
  },
  {
    id: "umpires", title: "Umpires",
    card: "Volunteers keep score from their own phones, one court each.",
    summary: "Let volunteers keep score on their own phones while you run the queue. No account is needed.",
    steps: [
      "On the Dashboard, press Umpires above the courts. In a quick session, turn on Allow volunteer umpires first (it starts off).",
      "Show the QR code or send the link. A volunteer opens it on their phone, types their name, and needs no account.",
      "Each volunteer claims one free court and scores it from their phone. Two people can't hold the same court.",
      "Tapping a team's half means that team won the rally. The screen calls the score (\"4 - 2 - 1\" in side-out), tracks the server, and has Undo.",
      "A finished game saves itself after a 5 second countdown (Undo in that time keeps it open). You then tap Confirm: Team N wins on the court card, and the match log shows the score.",
    ],
    notes: [
      { title: "Who holds which court", body: "The Umpires window lists each court with its volunteer. Release a court to free it, or assign it to someone." },
      { title: "New link", body: "Makes a new code: old links stop working, and every volunteer and court claim is cleared." },
      { title: "Record results automatically", body: "Turn this on in Settings, under Queue rules, and a saved game is recorded and its court rotates without your Confirm." },
      { title: "Scoring style and target", body: "Side-out (only the serving team scores) or rally, playing to 11, 15 or 21, win by 2. Set in Settings; volunteers' screens follow it live." },
      { title: "Score it yourself", body: "No volunteer? Press the score button on a live court to keep score from your own screen. Stop scoring this match brings back the plain Team 1 / Team 2 Wins buttons." },
      { title: "Live Board", body: "The score shows under each live court on the Live Board while it's kept." },
    ],
    shots: [
      shot("umpires.png", 510, 465, "The Umpires window with the volunteer link, its QR code and each court's umpire.", "The Umpires window: the link, the QR code and who holds each court."),
      shot("scorekeeper.png", 510, 573, "The score screen for a court: Team 1 on the left, Team 2 on the right, the called score and Undo.", "Keeping score: tap the team that won the rally."),
    ],
  },
  {
    id: "queue", title: "Queue",
    card: "Who is waiting, in order. Check people in, call, skip or lock partners.",
    summary: "The Queue lists everyone checked in and waiting, in the order they will play.",
    steps: [
      "Players with fewer games go first, then whoever has waited longest.",
      "Not Checked In opens a list with a search box. Check people in the moment they arrive: someone who already has a skill level is checked in right away, and only an unrated player is asked for theirs.",
      "Call sends someone straight to an open court; skip sends them to the back.",
      "Lock In pairs two players so they always play as partners. Unlock to split them again.",
      "Check Out takes someone out of the queue when they leave or take a break.",
    ],
    notes: [
      { title: "Players can see it", body: "In an open play game, club members can open the live queue from Home to see their place in line." },
    ],
    shots: [
      shot("game-queue.png", 1280, 900, "The Queue tab listing checked-in players in priority order with their games and waiting time.", "The Queue, in the order players will go on."),
      shot("queue-page.png", 1280, 900, "The read-only queue page listing who is on court and who is waiting, in order.", "What a player sees from Home: the live list."),
    ],
  },
  {
    id: "players", title: "Players",
    card: "Everyone in the session: skill stars, gender, games and wins.",
    summary: "Players is the full list for this session, checked in or not.",
    steps: [
      "Add Player at the top: a name, skill stars, and gender (Mixed Doubles needs it).",
      "Tap a player to edit their details or remove them.",
      "Switch between Cards and List. Each shows games, wins, losses and win percentage, and your choice is remembered on this device.",
    ],
    notes: [
      { title: "Skill stars", body: "Stars keep matches even. See Skill levels below for what each level means." },
    ],
    shots: [shot("players.png", 1280, 900, "The Players tab showing player cards with skill stars, games and wins.", "Players, as cards.")],
  },
  {
    id: "payment", title: "Payment",
    card: "Collect booking fees, or split a court rental between players.",
    summary: "In an open play game, Payment tracks the booking fee for everyone in the game. In a quick session it splits a court rental.",
    steps: [
      "Open play: the bar at the top shows what is collected and the remaining balance.",
      "Tap a player's pill to switch Paid and Unpaid, and pick Cash or GCash. Filter by Unpaid or Paid, or search by name.",
      "Mark all as paid when a group pays together, and Export to Excel for a spreadsheet.",
      "Split a court rental: enter the rate per hour, the hours and the courts, pick who is splitting, and save. Everyone's share is worked out for you.",
      "Each saved split lists who still owes. Tick people off as they pay, and show it on the Live Board if you like.",
    ],
    notes: [
      { title: "Play now games", body: "A Play now game has no booking fee: type one on the Payment page if you charge." },
      { title: "Round up", body: "In a quick session, Settings can round each share up and pre-fill your usual court rate." },
    ],
    shots: [
      shot("payment.png", 1280, 900, "The open play Payment page with the fees collected, filters and one row per player.", "Open play fees: collected, remaining, and each player."),
      shot("rental-split.png", 1280, 900, "Splitting a court rental: rate, hours, courts, the players splitting, and each person's share.", "Splitting a court rental."),
    ],
  },
  {
    id: "stats", title: "Stats",
    card: "The leaderboard, win rates and past sessions.",
    summary: "Stats shows how everyone is doing in this session.",
    steps: [
      "The leaderboard ranks players by win percentage, with games played and won.",
      "Export to CSV for a spreadsheet.",
      "In a quick session, Past Sessions shows the stats saved each time you ended a session.",
    ],
    notes: [],
    shots: [shot("stats.png", 1280, 900, "The Stats page with the leaderboard by win percentage.", "The leaderboard.")],
  },
  {
    id: "live-board", title: "Live Board",
    card: "A screen for a TV or phone: courts, scores and the queue.",
    summary: "The Live Board is a read-only screen players can watch: the courts with their scores, the queue and recent matches.",
    steps: [
      "Press Share Live Board in the top bar to get the link and its QR code.",
      "Open it on a TV or a spare tablet at the venue, or let players scan the code on their phones.",
      "It updates by itself and keeps the screen awake.",
      "New link replaces the old one, so an old QR code stops working.",
    ],
    notes: [
      { title: "What it shows", body: "Settings can show or hide skill stars, queue position, and games and wins." },
      { title: "One per game", body: "Each open play game has its own Live Board link." },
    ],
    shots: [shot("live-board.png", 1280, 900, "The Live Board with the courts in play, their scores and the queue.", "The Live Board on a big screen.")],
  },
];
