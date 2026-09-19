import { X } from "lucide-react";
import { createPortal } from "react-dom";

export function Modal({ title, description, onClose, children, width = 560, layer = 100, variant = "default", className = "" }) {
  const workspace = variant === "workspace";
  return createPortal(
    <div className={`modal-backdrop${workspace ? " is-workspace" : ""}`} style={{ zIndex: layer }} role="presentation" onMouseDown={onClose}>
      <section
        className={`modal${workspace ? " modal-workspace" : ""}${className ? ` ${className}` : ""}`}
        style={workspace ? undefined : { maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div>
          <button className="icon-button" type="button" title="关闭" onClick={onClose}><X size={19} /></button>
        </header>
        {workspace ? <div className="modal-workspace-body">{children}</div> : children}
      </section>
    </div>,
    document.body,
  );
}
