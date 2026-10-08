import AccountMenu from "./AccountMenu";

// The one top bar for every signed-in screen in the hub and club area: logo, My clubs, account chip.
// `active` highlights My clubs (true on the hub screens, false inside a club).
export default function AccountBar({ active, name, email, onSignOut, navigate }) {
  const toHub = (e) => { e.preventDefault(); navigate("/"); };
  return (
    <header className="acct-bar">
      <div className="acct-bar-in">
        <a className="acct-brand" href="/" onClick={toHub}>
          <img src="/images/courtflow.png" alt="" />
          <b>CourtFlow</b>
        </a>
        <nav aria-label="Account">
          <a href="/" className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={toHub}>My clubs</a>
        </nav>
        <AccountMenu name={name} email={email} onSignOut={onSignOut} navigate={navigate} />
      </div>
    </header>
  );
}
