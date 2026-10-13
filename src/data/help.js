// The Help page's content. Sections are data so a new feature is one entry. Screenshots live in public/help/ (see
// docs/help-screenshots.md for what each one shows and how to refresh it). The queue section's numbers are checked
// against the code by src/utils/help.check.mjs, so if a rule changes the check says which sentence to update.

export const MAJOR = [
  {
    id: "home",
    title: "Home",
    summary: "Where you land after signing in: what to do next, the session you are in, and what is coming up.",
    steps: [
      "Use Find session to look for open play, or Quick session to start a game with no setup.",
      "Your active session shows a live game you are checked in to: whether you are playing, up next, or your place in line. It appears when you belong to that club and the host has linked your account (you booked while signed in, or the host picked you). Use View queue on the card to see the live list.",
      "Coming up lists the next open play from public clubs by date, with your own clubs first within a day. Tap one to open that club's booking page.",
      "The Friends and Inbox tiles show how many friends and chats you have, with a badge when something is waiting.",
      "My clubs lists the clubs you belong to. Create a club from there if you host.",
    ],
    shots: [{ src: "/help/home.png", w: 1280, h: 900, alt: "The Home screen: a Ready to play bar, your active session, a Coming up list of sessions by date, Friends and Inbox tiles and your clubs.", caption: "Home, with the sessions coming up by date." }],
    go: { to: "/", label: "Go to Home" },
  },
  {
    id: "clubs",
    title: "Clubs",
    summary: "A club holds open play, games, members and settings. Anyone can find a public club; private clubs use an invite link.",
    steps: [
      "Open Clubs in the sidebar to see every public club. Search by name or place.",
      "Open a club and choose Ask to join. A manager approves your request. If you have an invite link, open it to join straight away.",
      "To start your own, choose Create a club on Home or My clubs, then pick public or private. You become its owner.",
      "In the Members tab, managers approve requests and share the invite link; only the owner makes managers (by role, or with the manager link).",
      "Roles: an owner runs everything, a manager runs open play, games and requests, a member can read and chat.",
    ],
    shots: [
      { src: "/help/clubs-directory.png", w: 1280, h: 900, alt: "The Clubs page listing public clubs with a search box.", caption: "Clubs: every public club, searchable." },
      { src: "/help/club-members.png", w: 1280, h: 900, alt: "A club's Members tab with the club chat, the invite link and the list of members with their roles.", caption: "A club's Members tab: chat, invite link and roles." },
    ],
    go: { to: "/clubs/find", label: "Browse clubs" },
  },
  {
    id: "open-play",
    title: "Open play",
    summary: "A manager schedules a session, players ask for a seat, and the host approves them. Seats beyond the limit join a waitlist.",
    steps: [
      "In a club, open the Open play tab and choose New open play: title, date, start time, length, how many players, fee, level, notes and how to pay.",
      "Share the booking link or its QR code. Anyone can open it, signed in or not, when the club is public.",
      "A player sends a request with their name and contact. Their page then shows pending, confirmed, waitlist or paid.",
      "The host approves requests. The first players up to the limit are confirmed, the rest wait in the order they joined, and removing someone promotes the next person.",
      "The host marks each player unpaid, paid or refunded, and sees how much has been collected.",
    ],
    shots: [
      { src: "/help/host-events.png", w: 1280, h: 900, alt: "The Open play tab listing a club's sessions with spots and a New open play button.", caption: "The host's list of open play." },
      { src: "/help/booking-page.png", w: 620, h: 709, alt: "The public booking page showing upcoming open play with fee, level, spots left and a Join button.", caption: "What a player sees on the booking page." },
    ],
    go: { to: "/clubs", label: "Open your clubs" },
  },
  {
    id: "find-session",
    title: "Find session",
    summary: "Look through open play from every public club, including clubs you have not joined.",
    steps: [
      "Open Find session. The strip at the top shows seven days from today; a dot marks days that have sessions.",
      "Tap a day to see only that day, tap it again (or All) to see everything. Use the arrows to move week by week.",
      "Search by club, place, session name or level.",
      "Each card shows the time, the club, the place, the spots left and the fee. Tap it to open the club's booking page.",
    ],
    shots: [{ src: "/help/find-session.png", w: 1280, h: 900, alt: "Find session with a week strip, a search box and session cards grouped by date.", caption: "Find session: pick a day, then a session." }],
    go: { to: "/sessions", label: "Find a session" },
  },
  {
    id: "game",
    title: "Running a game",
    summary: "A manager turns a booking into a live game: check players in, run the courts and record every result.",
    steps: [
      "On an event, choose Proceed to game and tick the players who came (nothing is ticked for you). The event goes live, the courts come from the club's defaults, and a booking-fee entry is added to Cost when the session has a fee.",
      "Check players in as they arrive and ask them to choose the skill level that best fits their game. You can adjust a self-rating later from Players. Only checked-in players can be picked for a court.",
      "Start the next match for a free court, or let Auto-fill seat open courts from the queue. With Auto-rotation on, a court refills by itself after each result; turn it off to place every match yourself.",
      "When a match ends, record the winner. Everyone rotates back through the queue. If you tap the wrong team, Undo is offered for 10 seconds.",
      "Late arrival? Use Add players to game. Walk-ins with no booking: use Play now, which makes a four-hour game with no seats.",
      "End game keeps everything (players, matches, costs). You can reopen it later.",
    ],
    shots: [
      { src: "/help/game-dashboard.png", w: 1280, h: 900, alt: "The game dashboard with two courts in play and the next players shown below.", caption: "The dashboard: courts, who is playing and who is next." },
      { src: "/help/game-queue.png", w: 1280, h: 900, alt: "The Queue tab listing checked-in players in priority order with their games and waiting time.", caption: "The Queue tab, in priority order." },
    ],
    go: { to: "/clubs", label: "Open your clubs" },
  },
  {
    id: "queue",
    featured: true,
    title: "Quick session and the queue",
    summary: "Start a game with no account, and understand exactly how the queue decides who plays next, so you always know where you stand.",
    steps: [
      "Quick session: open it from Home or the sign-in page. No account is needed. Your session lives in this browser, so it is still there when you come back, and clearing the browser's site data starts a fresh one. (If you are signed in, it follows your account instead.)",
      "Add players and set their skill level, check them in as they arrive, and start matches from the dashboard.",
      "End Session archives the day's stats and resets everyone's game count for next time.",
      "Playing in a club's game as a member of the club? Your active session on Home shows your place, and View queue opens the live list for the club's members. Back to game appears in the top header while your live game is active.",
      "On the Queue tab, search Not Checked In by player name to find someone quickly. Clear the search to show everyone again.",
    ],
    shots: [
      { src: "/help/quick-session.png", w: 1280, h: 900, alt: "The Quick session dashboard with two courts and a waiting queue.", caption: "Quick session: courts and the waiting queue." },
      { src: "/help/active-queue.png", w: 921, h: 86, alt: "Home's active session card reading You're number 3 in line, 2 players ahead, about 10 minutes.", caption: "Your place in line, on Home." },
      { src: "/help/queue-page.png", w: 1280, h: 900, alt: "The read-only queue page listing who is on court and who is waiting, in order.", caption: "View queue: the live list for everyone in the game." },
      { src: "/help/modes.png", w: 1280, h: 900, alt: "The mode picker listing Balanced, Skill Separated, Custom, Winners / Losers and Mixed Doubles.", caption: "The rotation modes." },
    ],
    go: { to: "/club", label: "Start a quick session" },
    extra: [
      {
        title: "How you get in",
        body: "The host checks you in when you arrive, and only checked-in players are in the queue. Booking a seat alone does not put you in line. A player who is checked in but not on a court is waiting.",
      },
      {
        title: "Who is picked next",
        body: "Players with the fewest games go first. Players with the same number of games are ordered by who has waited longer: since they checked in, or since their last game ended. So someone who has just played drops to the back, and a late arrival with no games moves ahead of players who have played more. The host can also send a player to the back or swap two places. Every mode starts from this order.",
      },
      {
        title: "Seeing where you stand",
        body: "On Home, Your active session says you are playing on a court, that you are up next, or \"You're #3 in line\" with how many players are ahead and about how many minutes to wait. The wait assumes a game lasts about 15 minutes and that games on the busy courts end around halfway through; it says \"about\" because some modes pick by other rules. Back to game in the top header opens your live game from any screen; View queue on the Home card shows the live list for the club's members, and in a Quick session the Live Board shows it on a TV.",
      },
      {
        title: "The modes",
        body: "Balanced rotates turns fairly and evens out each match by star rating: the strongest player teams with the weakest, and when the balance is equal it avoids repeat partners and opponents and evens out win records (never over the star rating). Every automatic mode also mixes up who plays with and against whom: the player who has waited longest always plays next, and the other seats go to people they have not met lately when the wait is about the same. Skill Separated keeps each match to one skill level; a court takes the first level in the queue that has enough players waiting, and anyone whose level is short keeps their place. Custom means the host builds every match, and nothing is picked automatically. Winners / Losers has winners play winners and losers play losers; winners stay on, challengers are recent winners first. New arrivals with no result yet are grouped together, so you may wait until enough other new players are in that group, or until a challenger spot opens. Mixed Doubles makes every team one man and one woman; a player with no gender set is skipped and shows an alert mark until the host fills it in.",
      },
      {
        title: "Winners stay on",
        body: "With the winners-stay rule on (always on in Winners / Losers), a winning side stays on the court until it reaches 2 wins in a row. Then it steps off and goes to the back of the queue, and a fresh group comes on (with Auto-rotation off, the host places the next match). The host sets the number in Settings.",
      },
      {
        title: "Partner locks",
        body: "The host can lock two players as partners. A lock keeps them together (and the pair is picked as one unit, so many locks leave fewer partners to mix) whenever the queue picks automatically in doubles, on courts without a level limit. Mixed Doubles only accepts a lock between a man and a woman. In Skill Separated, partners one star apart (say 2 and 3 stars) still play together: against one player from each of their levels (or another pair like them), or against two of the higher level when nobody like that is waiting; partners further apart are left to their own levels. A Custom game places nobody by itself.",
      },
      {
        title: "Levels",
        body: "Players have a star rating from Beginner to Expert (or none, which shows as Unrated), and a court can be limited to one level, so only players of that level are picked for it. In Skill Separated mode the level decides who plays together.",
      },
      {
        title: "Game alerts and repeat partners",
        body: "The club can switch on a game-length alert, which warns the host when a match runs long. Mix up partners and opponents starts on for Skill Separated and Winners / Losers; Balanced always does it.",
      },
      {
        title: "The Live Board",
        body: "Part of the Quick session: a read-only screen for a TV or a phone (Share Live Board in the top bar) with live courts, who is next and the match log. In the Quick session's Settings the host chooses whether it shows skill stars, queue position, and games and wins, and can replace its link to cut off old copies. Club games don't have one yet.",
      },
      {
        title: "Why am I not next?",
        body: "Check these: someone with fewer games is ahead of you; you are not checked in yet; the court is limited to a level that is not yours; Skill Separated is waiting for enough players at your level; Mixed Doubles is waiting for a man or a woman; the host moved you back or swapped places; in Winners / Losers, new arrivals wait for a group of other new players (or a challenger spot); or the host is in Custom mode and has not picked yet.",
      },
    ],
  },
];

export const MINOR = [
  { id: "accounts", title: "Accounts and your profile", body: "Sign up with an email and password or with Google. Your profile has your name, your friend code and a switch that lets people find you by name. Choose a Light or Dark theme, or Match my device, there. Sign out from the account menu at the top right." },
  { id: "friends", title: "Friends", body: "Find people by the start of a name or by their friend code and send a request; they accept or decline. Friends can message each other. Either side can remove the friendship." },
  { id: "inbox", title: "Inbox and messages", body: "Each club has one group chat that a manager starts from the Members tab; every member can read and write it. You can also message a friend, or another member of a club you share. Hide a conversation to take it off your list; a new message brings it back. A dot and a count show unread chats." },
  { id: "settings", title: "Settings", body: "A club's Settings page holds the club's details, session defaults (courts, format, mode), queue rules, cost defaults, the time zone and clock, and the colour theme. (A Quick session's own Settings also has the Live Board options.) Only managers see it, and only the owner changes who is public or private." },
  { id: "sidebar", title: "The sidebar and header", body: "The sidebar stays in place. Collapse it with the button at its bottom or by clicking the logo, and the choice is remembered. The header at the top stays visible and holds your account menu at the right. On a phone the sidebar opens from the menu button." },
  { id: "undo", title: "Undo a result", body: "After you record who won, a message offers Undo for about 10 seconds. It puts back the players, games, wins and the court exactly as they were." },
  { id: "keyboard", title: "Keyboard", body: "Esc closes the top dialog or menu. In a chat, Enter sends a message and Shift+Enter starts a new line." },
  { id: "time", title: "Time zone and clock", body: "A club sets its own time zone and 12-hour or 24-hour clock in Settings, and every time on its screens follows it. Each open play also keeps its own zone, so a session is judged in the place it happens." },
  { id: "export", title: "Export and past sessions", body: "Stats can be exported to CSV. In a Quick session, ending the session archives its stats, and Past sessions on the Stats page shows the earlier ones." },
  { id: "levels", title: "Skill levels", body: "Six levels, from Beginner to Expert, each with a star rating. Hosts set a player's level, and courts can be limited to a level." },
  { id: "delete", title: "Deleting a club or an account", body: "An owner can delete a club in its Settings; this removes its events, games, chat and member list. Deleting your account removes the clubs you own, your friends and your direct messages. Both ask you to confirm first and cannot be undone." },
];
