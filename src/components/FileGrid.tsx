import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Folder,
  Star,
  MoreVertical,
} from 'lucide-react';
import { DriveFile, ActiveSection } from '../types/drive';
import { FileIcon } from './FileIcon';
import { formatBytes, formatDate, isFolder, getFileCategory } from '../utils/fileUtils';
import { useContextMenu } from '../hooks/useContextMenu';
import { ActionRegistry } from '../services/actionRegistry';
import { ContextMenuOverlay } from './ContextMenuOverlay';

interface FileGridProps {
  files: DriveFile[];
  activeSection: ActiveSection;
  selectedFileIds?: string[];
  onToggleSelectFile?: (fileId: string, event?: React.MouseEvent) => void;
  onOpenFile: (file: DriveFile) => void;
  onPreviewFile: (file: DriveFile) => void;
  onToggleStar: (file: DriveFile) => void;
  onRenameFile: (file: DriveFile) => void;
  onDeleteFile: (file: DriveFile) => void;
  onRestoreFile?: (file: DriveFile) => void;
  onShowToast?: (message: string, type?: 'success' | 'error') => void;
  onSwipeAction?: (direction: 'up' | 'down' | 'left' | 'right', file: DriveFile) => void;
  onOpenDiffFrameTester?: (file?: DriveFile) => void;
}

export const FileGrid: React.FC<FileGridProps> = ({
  files,
  activeSection,
  selectedFileIds = [],
  onToggleSelectFile,
  onOpenFile,
  onPreviewFile,
  onToggleStar,
  onRenameFile,
  onDeleteFile,
  onRestoreFile,
  onShowToast,
  onSwipeAction,
  onOpenDiffFrameTester,
}) => {
  const { contextMenu, pulsingFileId, handleContextMenu, closeContextMenu } = useContextMenu();

  const actionRegistry = useMemo(() => {
    return new ActionRegistry({
      activeSection,
      onOpenFile,
      onPreviewFile,
      onToggleStar,
      onRenameFile,
      onDeleteFile,
      onRestoreFile,
      onToggleSelectFile,
      onShowToast,
      onSwipeAction,
      onOpenDiffFrameTester,
    });
  }, [
    activeSection,
    onOpenFile,
    onPreviewFile,
    onToggleStar,
    onRenameFile,
    onDeleteFile,
    onRestoreFile,
    onToggleSelectFile,
    onShowToast,
    onSwipeAction,
    onOpenDiffFrameTester,
  ]);

  if (files.length === 0) {
    return (
      <div className="py-16 text-center text-zinc-400">
        <p className="text-sm">No items found</p>
      </div>
    );
  }

  // Separate folders and files for clean visual hierarchy
  const folders = files.filter(isFolder);
  const regularFiles = files.filter((f) => !isFolder(f));

  return (
    <div className="space-y-6 relative select-none">
      {/* Custom Context Menu Overlay at Mouse Coordinates */}
      <ContextMenuOverlay
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        file={contextMenu.file}
        actionRegistry={actionRegistry}
        onClose={closeContextMenu}
      />

      {/* Folders Section */}
      {folders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Folders ({folders.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {folders.map((folder) => {
              const isSelected = selectedFileIds.includes(folder.id);
              const isPulsing = pulsingFileId === folder.id;

              return (
                <motion.div
                  key={folder.id}
                  id={`folder-card-${folder.id}`}
                  animate={
                    isPulsing
                      ? {
                          scale: [1, 1.03, 1],
                          boxShadow: [
                            '0 0 0 0 rgba(59, 130, 246, 0)',
                            '0 0 0 4px rgba(59, 130, 246, 0.35)',
                            '0 0 0 0 rgba(59, 130, 246, 0)',
                          ],
                        }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  onClick={(e) => {
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                      onToggleSelectFile?.(folder.id, e);
                    } else {
                      onOpenFile(folder);
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, folder)}
                  className={`group relative flex items-center justify-between p-3.5 rounded-2xl shadow-2xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-2 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-white dark:bg-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 border border-zinc-200/80 dark:border-zinc-700/70 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 overflow-hidden">
                    {/* Checkbox for Folder */}
                    <div
                      className={`transition-opacity shrink-0 ${
                        isSelected || selectedFileIds.length > 0
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        id={`checkbox-folder-${folder.id}`}
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onToggleSelectFile?.(folder.id, e as unknown as React.MouseEvent)}
                        className="w-4 h-4 rounded-sm text-blue-600 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 focus:ring-blue-500 cursor-pointer"
                        title={isSelected ? 'Deselect folder' : 'Select folder'}
                      />
                    </div>

                    <Folder className="w-5 h-5 text-amber-500 fill-amber-500/20 shrink-0" />
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                      {folder.name}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                    {activeSection !== 'trash' && (
                      <button
                        id={`btn-star-folder-${folder.id}`}
                        onClick={() => onToggleStar(folder)}
                        className={`p-1 rounded-md text-zinc-300 dark:text-zinc-600 hover:text-amber-400 transition-colors ${
                          folder.starred ? 'text-amber-400' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${folder.starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                    )}

                    <button
                      id={`btn-folder-menu-${folder.id}`}
                      onClick={(e) => handleContextMenu(e, folder)}
                      className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      title="More actions"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Files Section */}
      {regularFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Files ({regularFiles.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {regularFiles.map((file) => {
              const isSelected = selectedFileIds.includes(file.id);
              const isPulsing = pulsingFileId === file.id;
              const category = getFileCategory(file.mimeType);

              return (
                <motion.div
                  key={file.id}
                  id={`file-card-${file.id}`}
                  animate={
                    isPulsing
                      ? {
                          scale: [1, 1.03, 1],
                          boxShadow: [
                            '0 0 0 0 rgba(59, 130, 246, 0)',
                            '0 0 0 4px rgba(59, 130, 246, 0.35)',
                            '0 0 0 0 rgba(59, 130, 246, 0)',
                          ],
                        }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  onClick={(e) => {
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                      onToggleSelectFile?.(file.id, e);
                    } else {
                      onPreviewFile(file);
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                  className={`group relative rounded-2xl overflow-hidden shadow-2xs transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-2 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-white dark:bg-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 border border-zinc-200/80 dark:border-zinc-700/70 hover:shadow-xs'
                  }`}
                >
                  {/* Thumbnail / Category Header Box */}
                  <div className="h-28 w-full bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-center relative overflow-hidden border-b border-zinc-100 dark:border-zinc-700/50">
                    {/* Checkbox overlay */}
                    <div
                      className={`absolute top-2 left-2 z-10 transition-opacity ${
                        isSelected || selectedFileIds.length > 0
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        id={`checkbox-file-${file.id}`}
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onToggleSelectFile?.(file.id, e as unknown as React.MouseEvent)}
                        className="w-4 h-4 rounded-sm text-blue-600 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 focus:ring-blue-500 cursor-pointer"
                        title={isSelected ? 'Deselect file' : 'Select file'}
                      />
                    </div>

                    {file.thumbnailLink ? (
                      <img
                        src={file.thumbnailLink}
                        alt={file.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Hide broken thumbnail image and show fallback icon
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-1.5 opacity-60">
                        <FileIcon mimeType={file.mimeType} className="w-8 h-8" />
                        <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400">
                          {category.label}
                        </span>
                      </div>
                    )}

                    {/* Top corner actions */}
                    <div className="absolute top-2 right-2 flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                      {activeSection !== 'trash' && (
                        <button
                          id={`btn-star-card-${file.id}`}
                          onClick={() => onToggleStar(file)}
                          className={`p-1 rounded-md text-zinc-300 dark:text-zinc-600 hover:text-amber-400 transition-colors ${
                            file.starred ? 'text-amber-400' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${file.starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                        </button>
                      )}

                      <button
                        id={`btn-card-menu-${file.id}`}
                        onClick={(e) => handleContextMenu(e, file)}
                        className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        title="More actions"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <FileIcon mimeType={file.mimeType} className="w-4 h-4 shrink-0" />
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={file.name}>
                        {file.name}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                      <span>{formatBytes(file.size)}</span>
                      <span>{formatDate(file.modifiedTime)}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
