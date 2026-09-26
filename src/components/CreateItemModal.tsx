import React, { useState, useEffect } from 'react';
import { X, FolderPlus, FileText, Table, Edit2 } from 'lucide-react';

export type CreateModalType = 'folder' | 'document' | 'spreadsheet' | 'rename';

interface CreateItemModalProps {
  isOpen: boolean;
  type: CreateModalType;
  initialValue?: string;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export const CreateItemModal: React.FC<CreateItemModalProps> = ({
  isOpen,
  type,
  initialValue = '',
  isLoading,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (type === 'rename') {
        setName(initialValue);
      } else if (type === 'folder') {
        setName(initialValue || 'New folder');
      } else if (type === 'document') {
        setName(initialValue || 'Untitled document');
      } else if (type === 'spreadsheet') {
        setName(initialValue || 'Untitled spreadsheet');
      }
    }
  }, [isOpen, type, initialValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  const getTitleAndIcon = () => {
    switch (type) {
      case 'folder':
        return {
          title: 'New Folder',
          icon: <FolderPlus className="w-5 h-5 text-amber-500" />,
          placeholder: 'Folder name',
          submitText: 'Create Folder',
        };
      case 'document':
        return {
          title: 'New Google Doc',
          icon: <FileText className="w-5 h-5 text-blue-500" />,
          placeholder: 'Document title',
          submitText: 'Create Doc',
        };
      case 'spreadsheet':
        return {
          title: 'New Google Sheet',
          icon: <Table className="w-5 h-5 text-emerald-500" />,
          placeholder: 'Spreadsheet title',
          submitText: 'Create Sheet',
        };
      case 'rename':
        return {
          title: 'Rename',
          icon: <Edit2 className="w-5 h-5 text-blue-500" />,
          placeholder: 'New item name',
          submitText: 'Save',
        };
    }
  };

  const info = getTitleAndIcon();

  return (
    <div
      id="create-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 transition-all animate-in fade-in duration-200"
    >
      <div
        id="create-modal-container"
        className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800">
              {info.icon}
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {info.title}
            </h3>
          </div>
          <button
            id="btn-close-create-modal"
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              Name
            </label>
            <input
              id="create-item-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={info.placeholder}
              autoFocus
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 transition-all outline-hidden font-medium"
            />
          </div>

          <div className="flex items-center justify-end space-x-2.5 pt-2">
            <button
              id="btn-cancel-create-modal"
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-submit-create-modal"
              type="submit"
              disabled={isLoading || !name.trim()}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {isLoading && (
                <svg className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>{info.submitText}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
