import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { DestructiveActionConfig } from '../types/drive';

interface ConfirmationModalProps {
  config: DestructiveActionConfig;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  config,
  isLoading,
  onConfirm,
  onCancel,
}) => {
  if (!config.isOpen) return null;

  return (
    <div
      id="destructive-confirmation-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 transition-all animate-in fade-in duration-200"
    >
      <div
        id="destructive-confirmation-dialog"
        className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2.5 rounded-xl ${
                config.isPermanent
                  ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                  : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
              }`}
            >
              {config.isPermanent ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <h3 id="confirmation-dialog-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {config.title}
            </h3>
          </div>
          <button
            id="btn-close-confirmation-modal"
            onClick={onCancel}
            disabled={isLoading}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
          {config.message}
        </p>

        {config.fileNames && config.fileNames.length > 0 && (
          <div className="max-h-32 overflow-y-auto bg-zinc-50 dark:bg-zinc-800/60 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800 space-y-1">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Affected {config.fileNames.length === 1 ? 'Item' : `Items (${config.fileNames.length})`}:
            </p>
            {config.fileNames.map((name, i) => (
              <p key={i} className="text-xs text-zinc-700 dark:text-zinc-300 truncate font-mono">
                • {name}
              </p>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            id="btn-cancel-confirmation"
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-action"
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-xl shadow-xs transition-colors flex items-center space-x-2 disabled:opacity-50 ${
              config.isPermanent
                ? 'bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500/20'
                : 'bg-amber-600 hover:bg-amber-700 focus:ring-2 focus:ring-amber-500/20'
            }`}
          >
            {isLoading && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span>{config.confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
