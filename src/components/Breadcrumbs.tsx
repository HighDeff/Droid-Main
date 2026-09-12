import React, { useState } from 'react';
import {
  ChevronRight,
  HardDrive,
  Star,
  Trash2,
  Trash,
  Folder,
  ArrowUp,
  PieChart,
} from 'lucide-react';
import { BreadcrumbItem, ActiveSection } from '../types/drive';

interface BreadcrumbsProps {
  activeSection: ActiveSection;
  breadcrumbs: BreadcrumbItem[];
  onNavigateToBreadcrumb: (index: number) => void;
  onNavigateToParent?: () => void;
  onJumpToMyDrive?: () => void;
  onDropOnFolder?: (targetFolderId: string, files: File[]) => void;
  onEmptyTrash?: () => void;
  trashCount?: number;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  activeSection,
  breadcrumbs,
  onNavigateToBreadcrumb,
  onNavigateToParent,
  onJumpToMyDrive,
  onDropOnFolder,
  onEmptyTrash,
  trashCount = 0,
}) => {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverIndex(index);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, index: number, crumb: BreadcrumbItem) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onDropOnFolder) {
      onDropOnFolder(crumb.id, Array.from(e.dataTransfer.files));
    } else {
      onNavigateToBreadcrumb(index);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-zinc-100 dark:border-zinc-800/60 mb-2">
      <div className="flex items-center space-x-2 overflow-x-auto py-1">
        {/* Quick 'Up one level' button if inside a nested subfolder */}
        {activeSection === 'my-drive' && breadcrumbs.length > 1 && (
          <button
            id="btn-breadcrumb-up-level"
            type="button"
            onClick={() => {
              if (onNavigateToParent) {
                onNavigateToParent();
              } else {
                onNavigateToBreadcrumb(breadcrumbs.length - 2);
              }
            }}
            title="Jump back up to parent folder"
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 bg-zinc-100/80 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors border border-zinc-200/80 dark:border-zinc-700/80 shrink-0"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>Up</span>
          </button>
        )}

        <nav aria-label="Breadcrumb" className="flex items-center space-x-1 text-sm">
          {activeSection === 'my-drive' ? (
            breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              const isDragTarget = dragOverIndex === index;

              return (
                <React.Fragment key={crumb.id || index}>
                  {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0 mx-0.5" />}
                  <button
                    id={`breadcrumb-item-${index}`}
                    type="button"
                    onClick={() => {
                      if (!isLast) {
                        onNavigateToBreadcrumb(index);
                      }
                    }}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index, crumb)}
                    title={isLast ? `Current Directory: ${crumb.name}` : `Click to jump back to ${crumb.name}`}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg transition-all truncate max-w-[200px] text-xs sm:text-sm ${
                      isDragTarget
                        ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500 scale-105'
                        : isLast
                        ? 'font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100/60 dark:bg-zinc-800/60 cursor-default'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer font-medium'
                    }`}
                  >
                    {index === 0 ? (
                      <HardDrive className={`w-4 h-4 shrink-0 ${isLast ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500'}`} />
                    ) : (
                      <Folder className={`w-4 h-4 shrink-0 ${isLast ? 'text-amber-500 fill-amber-500/20' : 'text-amber-500/80'}`} />
                    )}
                    <span className="truncate">{crumb.name}</span>
                  </button>
                </React.Fragment>
              );
            })
          ) : (
            // For Starred, Trash, or Analytics: show clickable My Drive root to jump back!
            <div className="flex items-center space-x-1">
              <button
                id="btn-breadcrumb-jump-root"
                type="button"
                onClick={() => {
                  if (onJumpToMyDrive) {
                    onJumpToMyDrive();
                  } else {
                    onNavigateToBreadcrumb(0);
                  }
                }}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-xs sm:text-sm font-medium text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                title="Jump back to My Drive root"
              >
                <HardDrive className="w-4 h-4 text-blue-500" />
                <span>My Drive</span>
              </button>

              <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0 mx-0.5" />

              {activeSection === 'starred' ? (
                <div className="flex items-center space-x-1.5 font-bold text-zinc-900 dark:text-zinc-100 px-2 py-1 text-xs sm:text-sm bg-zinc-100/60 dark:bg-zinc-800/60 rounded-lg">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>Starred Files</span>
                </div>
              ) : activeSection === 'trash' ? (
                <div className="flex items-center space-x-1.5 font-bold text-zinc-900 dark:text-zinc-100 px-2 py-1 text-xs sm:text-sm bg-zinc-100/60 dark:bg-zinc-800/60 rounded-lg">
                  <Trash2 className="w-4 h-4 text-zinc-500" />
                  <span>Trash (Bin)</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 font-bold text-zinc-900 dark:text-zinc-100 px-2 py-1 text-xs sm:text-sm bg-zinc-100/60 dark:bg-zinc-800/60 rounded-lg">
                  <PieChart className="w-4 h-4 text-blue-500" />
                  <span>Disk Storage Analytics</span>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      {/* If in trash, show Empty Trash button */}
      {activeSection === 'trash' && trashCount > 0 && onEmptyTrash && (
        <button
          id="btn-empty-trash"
          onClick={onEmptyTrash}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/40 transition-colors shrink-0"
        >
          <Trash className="w-3.5 h-3.5" />
          <span>Empty trash</span>
        </button>
      )}
    </div>
  );
};

