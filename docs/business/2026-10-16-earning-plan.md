# CourtWave earning plan

Owner approved the direction on 2026-10-16. This is the plan we'll work through, phase by phase. Prices and numbers marked *(guess)* are starting points to test with real hosts, not decisions.

## The idea in one line

**Players are always free. Hosts and clubs pay** for the tools that save them time and money: a monthly Club plan first, then online payments with a small fee per booking.

Why: players are what make CourtWave valuable to a host (more people booking, checking in, watching their place in line). Charging players would shrink that. Hosts are the ones who save hours of clipboards, chasing payments and arguing about whose turn it is.

## Ways to earn, in order

| # | What | Who pays | When |
|---|------|----------|------|
| 1 | **Club plan (Pro)**, a monthly subscription per club | Hosts / clubs | Phase 2 |
| 2 | **Online payments**: GCash / card through a payment provider, plus a small fee per booking | Player or host (to decide) | Phase 3 |
| 3 | **Live Board sponsors**: a "Brought to you by" spot on the venue TV | Local shops, courts, brands | Phase 4 |
| 4 | **Featured listings** in Find session | Clubs | Phase 4 |
| 5 | **Tournaments and brackets** (not built yet), as a paid add-on | Organizers | Phase 4 |

Not doing: ads inside the app. They make it feel cheap and pay very little until there are many users.

---

## Phase 0: groundwork (now)

- [x] Landing page says CourtWave is **free while in early access** (not "free"), so we never promise free forever. *(done 2026-10-16)*
- [ ] **Privacy policy** and **terms of use** pages, linked from the landing page footer and the sign-up screen. Needed before charging anyone, and payment providers ask for them. Mind the Philippine Data Privacy Act of 2012 (personal data: names, emails, receipts).
- [ ] A way for hosts to send feedback (a simple "Send feedback" link: email or a form).
- [ ] Start the business registration (DTI for a sole proprietor, or SEC for a corporation, then BIR). Phase 2 can run on manual GCash without it for a short pilot, but Phase 3 can't.
- [ ] Decide the support contact (an email address shown on the landing page).

## Phase 1: early access with real clubs (about 4 to 8 weeks)

Goal: 5 to 10 real clubs using CourtWave every week, and learning what they'd pay for.

- [ ] Invite the first hosts (the owner's own network first).
- [ ] Help each one set up: club, first open play, booking link, Live Board.
- [ ] Watch what they use. A small admin view (or a script) that counts per club: sessions held, players, bookings, umpire links used, Live Board opened.
- [ ] Interview each host after 2 to 3 game nights:
  - What did CourtWave replace for you (paper, group chat, spreadsheet)?
  - Which feature would you miss most if it disappeared?
  - What's still annoying?
  - Would you pay for it? How much a month feels fair? *(Only ask this after they've used it.)*
- [ ] Write the answers into this doc (a "What hosts told us" section) and adjust the Free / Pro split and the price.

**Done when:** at least 5 clubs ran 3 or more game nights each, and at least 3 hosts said they'd pay.

## Phase 2: the Club plan (Pro)

### Free vs Pro (draft, adjust after Phase 1)

| | Free | Pro |
|---|---|---|
| Quick session (no account) | Yes | Yes |
| Clubs you own | 1 | 1 per plan |
| Open play sessions | A few a month *(guess: 4)* | Unlimited |
| Fair queue, all modes, booking page, waitlist | Yes | Yes |
| Payment tracking, Mark all as paid, receipts | Yes | Yes |
| Excel export of payments | No | Yes |
| Volunteer umpires | No | Yes |
| Live Board | No | Yes |
| Managers (besides the owner) | No | Yes |
| Club colors / logo | No | Yes |

**Price** *(guess)*: **₱299 to ₱499 per club per month**, about the fee of 2 to 4 players for one night. Maybe a cheaper yearly price (2 months free).

### How we take the money at first

Manual: the host pays by GCash, the owner marks the club as Pro until a date. No billing system until enough clubs pay to justify one.

### What to build

- [ ] **Plan on the club**: `plan` (`free` / `pro`) and `planUntil` (date) that **only the owner of CourtWave can change**. Put them where club managers can't write them, for example `clubs/{id}/billing/plan`, writable only by admins.
- [ ] **Admins in the rules**: an `isAdmin()` check in `firestore.rules` (a fixed list of uids, or an `admins/{uid}` doc that only exists for admins).
- [ ] **Lock Pro features in the rules, not only in the app.** Hiding a button isn't enough: a clever user could call Firestore directly. For example: creating `private/umpire` (umpire links) and `private/live` (Live Board) only when the club's plan is Pro and `planUntil` is in the future. Rules tests for each locked feature (same style as `tests/umpire.test.mjs`).
- [ ] **Session limit for Free clubs.** Counting in rules is hard; options are a monthly counter doc updated in the same batch as the event create (rules check it with `getAfter`), or a softer in-app limit. Decide when building.
- [ ] **In the app**: a plan badge in club settings; locked features show what Pro adds and how to upgrade (not just a disabled button); a reminder a few days before `planUntil`; a short grace period after it passes (features keep working, a banner asks to renew).
- [ ] **Admin page** for the owner: list clubs, set plan and `planUntil`, see basic usage.
- [ ] **Landing page**: a simple pricing section (Free and Pro side by side) and update the "How much does it cost?" answer.
- [ ] Existing clubs: decide whether early-access clubs get Pro free for a while as a thank-you *(suggested: 3 months)*.

**Done when:** the first club pays and gets Pro, and a Free club can't open an umpire link or the Live Board even by calling Firestore directly (proven by a rules test).

## Phase 3: online payments with a booking fee

Today players pay outside the app and the host checks receipt screenshots. With a payment provider, the booking confirms itself as paid.

- [ ] Pick a provider that supports GCash and cards in the Philippines (PayMongo, Xendit, or similar). Compare fees, payout times, and whether money can go straight to each host.
- [ ] **Big decision: whose account receives the money?**
  - (a) Each host connects their own merchant account: CourtWave never holds money, simplest legally, but every host has to sign up with the provider.
  - (b) CourtWave receives everything and pays hosts out: easier for hosts, but CourtWave handles payouts, refunds and more paperwork.
- [ ] Needs **Cloud Functions** to create payments and receive the provider's webhooks, which means the Firebase pay-as-you-go (Blaze) plan.
- [ ] Booking fee *(guess: ₱5 to ₱10 per booking)*: decide who pays it (player, host, or split).
- [ ] Refunds and cancellations policy, written for players.
- [ ] Keep cash and manual GCash with receipts working for hosts who don't want online payments.

**Done when:** a player books and pays online, the seat shows as paid with no receipt check, and the host gets the money.

## Phase 4: extras (once there are users)

- [ ] Live Board sponsor spot (a logo and one line, set per club or sold by CourtWave).
- [ ] Featured clubs at the top of Find session.
- [ ] Tournaments and brackets as a paid add-on (needs its own design).

## Phase 5 (future): white-label licensing

Owner wants this for later (2026-10-16), after the Club plan works. A bigger customer (a venue chain, a large club, a league or a federation) gets **their own copy of CourtWave under their own name, logo and colors**. CourtWave keeps the product and can license it again to the next customer.

- **What they pay** *(guess, set per deal)*: a one-time setup fee, plus a yearly license or maintenance fee (updates, hosting help, support).
- **What to build first:**
  - [ ] Branding from settings, not code: app name, logo, colors, page titles and the landing page text read from one config per deployment, instead of "CourtWave" written in many files.
  - [ ] One Firebase project per customer (their own data, rules and hosting address or domain), deployed from the same code.
  - [ ] A short setup guide: create the Firebase project, set the config, publish the rules and indexes, deploy.
  - [ ] Their own Android app build (name, icon, package id) once the Android app exists.
- **Paperwork:** a license agreement (what they may and may not do, e.g. no reselling, no copying the code), who owns their data (they do), support terms, and what happens if they stop paying. Have a lawyer write or check it.
- **Before offering it:** the name "CourtWave" checked and, ideally, registered as a trademark (IPOPHL), so customers license a name CourtWave owns.

**Done when:** one paying customer runs their own branded copy from the same code.

## Selling the whole business (much later, not planned)

Kept only as a long-term exit. A buyer pays for revenue and users, not for the code alone. What keeps that door open costs little now: clean ownership of the code, a registered name, accounts (Firebase, domain, payments) that can be transferred, the docs in `docs/` and `CLAUDE.md`, and a privacy policy that allows user data to move to a new owner.

---

## Costs to expect

- **Firebase**: the free plan has daily limits (reads, writes). Growing clubs will need the pay-as-you-go plan; cheap at small scale, not zero. Check the Firebase usage page monthly.
- **Payment provider fees** (Phase 3): a percentage per transaction; check the provider's current rates.
- **Optional**: a custom domain (courtwave.com or similar) instead of `courtwave.web.app`.

## Numbers to watch

- Active clubs per week, game nights per club, players per night.
- How many Free clubs hit a Pro feature (the upgrade prompt).
- Free to Pro conversion, and how many Pro clubs renew.

## Open decisions

1. The Free / Pro split and the price (after Phase 1 interviews).
2. Business type: sole proprietor (DTI) or corporation (SEC).
3. Online payments: host's own merchant account (a) or CourtWave pays out (b).
4. Who pays the booking fee.
5. Early-access thank-you for the first clubs.
6. White-label (Phase 5): when to start, and the setup and yearly fees.
