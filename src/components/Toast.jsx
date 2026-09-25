export default function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  const { message, action } = toast;
  return (
    <div className="toast" role="status">
      {message}
      {action ? (
        <button type="button" className="toast-action" onClick={() => { onDismiss(); action.run(); }}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
