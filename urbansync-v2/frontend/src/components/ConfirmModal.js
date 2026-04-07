import React from 'react';
import { FaExclamationTriangle, FaTimes } from 'react-icons/fa';
import '../css/confirmModal.css';

const ConfirmModal = ({ show, title, message, onConfirm, onCancel, confirmText = "Yes", cancelText = "Cancel", type = "danger" }) => {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className={`modal-header ${type}`}>
          <div className="modal-header-content">
            <FaExclamationTriangle className="modal-icon" />
            <h3 className="modal-title">{title}</h3>
          </div>
          <button className="modal-close-btn" onClick={onCancel}>
            <FaTimes />
          </button>
        </div>
        
        <div className="modal-body">
          <p>{message}</p>
        </div>
        
        <div className="modal-footer">
          <button 
            className="btn btn-secondary modal-btn-cancel" 
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button 
            className={`btn btn-${type} modal-btn-confirm`} 
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
