// The title row every hub and club screen starts with: title, one optional line under it, and the
// page's actions on the right (they wrap below the title on a phone).
// `hidden`: list screens whose place the sidebar (or the club's tabs) already names keep the title for screen
// readers only, so the page starts with its own content (search, list). Owner's call, 2026-11-11.
export default function PageTitle({ title, sub, children, hidden = false }) {
  if (hidden) return <h1 className="sr-only">{title}</h1>;
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="page-title-actions">{children}</div>}
    </div>
  );
}
