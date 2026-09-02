import { useState } from 'react';

export function DashboardMessageModal({ type = 'info', title, message, onClose }) {
  if (!message) return null;

  const icon = type === 'error' ? '!' : 'OK';
  const modalTitle = title || (type === 'error' ? 'Atencion requerida' : 'Operacion completada');

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="message-modal-title">
      <div className={`app-modal message-modal ${type === 'error' ? 'is-error' : 'is-success'}`}>
        <div className="modal-icon" aria-hidden="true">{icon}</div>
        <h3 id="message-modal-title">{modalTitle}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="modal-primary-btn" onClick={onClose}>
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}

export function DashboardConfirmModal({
  title,
  message,
  confirmLabel = 'Aceptar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const [working, setWorking] = useState(false);

  if (!title && !message) return null;

  const handleConfirm = async () => {
    setWorking(true);
    try {
      await onConfirm?.();
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className={`app-modal confirm-modal ${danger ? 'is-danger' : ''}`}>
        <div className="modal-icon" aria-hidden="true">{danger ? '!' : '?'}</div>
        <h3 id="confirm-modal-title">{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="modal-secondary-btn" onClick={onCancel} disabled={working}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'modal-danger-btn' : 'modal-primary-btn'}
            onClick={handleConfirm}
            disabled={working}
          >
            {working ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
