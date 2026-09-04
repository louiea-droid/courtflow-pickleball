export default function PanelHead({ title, sub, button, action }) {
  return (
    <div className="panelhead">
      <div><h3>{title}</h3><span>{sub}</span></div>
      {button && <button className="text" onClick={action}>{button}</button>}
    </div>
  );
}
