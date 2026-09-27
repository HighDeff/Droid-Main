import React from 'react';
import {
  Trash2,
  Star,
  RotateCcw,
  X,
  CheckSquare,
  Square,
  AlertCircle,
} from 'lucide-react';
import { ActiveSection } from '../types/drive';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  activeSection: ActiveSection;
  allSelectedStarred?: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkTrash: () => void;
  onBulkPermanentDelete: () => void;
  onBulkRestore: () => void;
  onBulkStar: () => void;
  isLoading?: boolean;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  totalCount,
  activeSection,
  allSelectedStarred = false,
  onSelectAll,
  onClearSelection,
  onBulkTrash,
  onBulkPermanentDelete,
  onBulkRestore,
  onBulkStar,
  isLoading = false,
}) => {
  if (selectedCount === 0) return null;

  const isAllSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div
      id="bulk-action-bar"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-auto max-w-[95vw] sm:max-w-2xl bg-zinc-900/95 dark:bg-zinc-800/95 text-white backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl border border-zinc-700/80 flex items-center justify-between gap-3 sm:gap-5 animate-in fade-in slide-in-from-bottom-5 duration-200"
    >
      {/* Selection count & select/deselect all toggle */}
      <div className="flex items-center space-x-2.5">
        <button
          id="btn-bulk-toggle-select-all"
          type="button"
          onClick={isAllSelected ? onClearSelection : onSelectAll}
          title={isAllSelected ? 'Deselect all' : 'Select all'}
          className="p-1 text-blue-400 hover:text-blue-300 rounded-lg transition-colors flex items-center space-x-1.5"
        >
          {isAllSelected ? (
            <CheckSquare className="w-4 h-4" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </button>

        <div className="flex items-center space-x-1.5 text-xs font-semibold">
          <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[11px] font-mono">
            {selectedCount}
          </span>
          <span className="text-zinc-300 hidden xs:inline">
            of {totalCount} selected
          </span>
        </div>
      </div>

      <div className="h-4 w-px bg-zinc-700" />

      {/* Action Buttons */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* If in trash: Restore and Delete Forever */}
        {activeSection === 'trash' ? (
          <>
            <button
              id="btn-bulk-restore"
              type="button"
              onClick={onBulkRestore}
              disabled={isLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/50 rounded-xl transition-all disabled:opacity-50"
              title="Restore selected items"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore ({selectedCount})</span>
            </button>

            <button
              id="btn-bulk-delete-forever"
              type="button"
              onClick={onBulkPermanentDelete}
              disabled={isLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/50 border border-red-800/50 rounded-xl transition-all disabled:opacity-50"
              title="Permanently delete selected items"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete forever ({selectedCount})</span>
            </button>
          </>
        ) : (
          /* If in my-drive or starred: Star/Unstar and Move to Trash */
          <>
            <button
              id="btn-bulk-star"
              type="button"
              onClick={onBulkStar}
              disabled={isLoading}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl transition-all disabled:opacity-50 ${
                allSelectedStarred
                  ? 'text-amber-300 bg-amber-950/50 hover:bg-amber-900/60 border border-amber-700/50'
                  : 'text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700'
              }`}
              title={allSelectedStarred ? 'Remove star from selected' : 'Star selected items'}
            >
              <Star className={`w-3.5 h-3.5 ${allSelectedStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span className="hidden sm:inline">
                {allSelectedStarred ? 'Unstar' : 'Star'}
              </span>
            </button>

            <button
              id="btn-bulk-trash"
              type="button"
              onClick={onBulkTrash}
              disabled={isLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/50 border border-red-800/50 rounded-xl transition-all disabled:opacity-50"
              title="Move selected items to trash"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Move to trash ({selectedCount})</span>
            </button>
          </>
        )}
      </div>

      <div className="h-4 w-px bg-zinc-700" />

      {/* Dismiss / Clear Selection Button */}
      <button
        id="btn-bulk-clear-selection"
        type="button"
        onClick={onClearSelection}
        title="Deselect all items"
        className="p-1 text-zinc-400 hover:text-white rounded-lg transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
