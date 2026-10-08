// The title row every hub and club screen starts with: title, one optional line under it, and the
// page's actions on the right (they wrap below the title on a phone).
export default function PageTitle({ title, sub, children }) {
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
