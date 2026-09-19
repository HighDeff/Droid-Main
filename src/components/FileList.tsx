import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Star,
  MoreVertical,
} from 'lucide-react';
import { DriveFile, ActiveSection } from '../types/drive';
import { FileIcon } from './FileIcon';
import { formatBytes, formatDate, isFolder } from '../utils/fileUtils';
import { useContextMenu } from '../hooks/useContextMenu';
import { ActionRegistry } from '../services/actionRegistry';
import { ContextMenuOverlay } from './ContextMenuOverlay';

interface FileListProps {
  files: DriveFile[];
  activeSection: ActiveSection;
  selectedFileIds?: string[];
  onToggleSelectFile?: (fileId: string, event?: React.MouseEvent) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
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

export const FileList: React.FC<FileListProps> = ({
  files,
  activeSection,
  selectedFileIds = [],
  onToggleSelectFile,
  onSelectAll,
  onClearSelection,
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
  const selectAllRef = useRef<HTMLInputElement>(null);
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

  const allSelected = files.length > 0 && files.every((f) => selectedFileIds.includes(f.id));
  const someSelected = files.some((f) => selectedFileIds.includes(f.id)) && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  if (files.length === 0) {
    return (
      <div className="py-16 text-center text-zinc-400">
        <p className="text-sm">No items found</p>
      </div>
    );
  }

  const handleHeaderCheckboxChange = () => {
    if (allSelected) {
      onClearSelection?.();
    } else {
      onSelectAll?.();
    }
  };

  return (
    <div className="w-full overflow-x-auto relative select-none">
      {/* Custom Context Menu Overlay at Mouse Coordinates */}
      <ContextMenuOverlay
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        file={contextMenu.file}
        actionRegistry={actionRegistry}
        onClose={closeContextMenu}
      />

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            {/* Select-all checkbox */}
            <th className="py-2.5 px-3 w-10 text-center">
              <input
                ref={selectAllRef}
                id="checkbox-select-all-header"
                type="checkbox"
                checked={allSelected}
                onChange={handleHeaderCheckboxChange}
                className="w-4 h-4 rounded-sm text-blue-600 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 focus:ring-blue-500 cursor-pointer"
                title={allSelected ? 'Deselect all' : 'Select all'}
              />
            </th>
            <th className="py-2.5 px-2 w-8"></th>
            <th className="py-2.5 px-3">Name</th>
            <th className="py-2.5 px-3 hidden md:table-cell">Owner</th>
            <th className="py-2.5 px-3 hidden sm:table-cell">Last Modified</th>
            <th className="py-2.5 px-3 hidden lg:table-cell">File Size</th>
            <th className="py-2.5 px-3 w-10 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-sm">
          {files.map((file) => {
            const folder = isFolder(file);
            const isSelected = selectedFileIds.includes(file.id);
            const isPulsing = pulsingFileId === file.id;

            return (
              <motion.tr
                key={file.id}
                id={`file-row-${file.id}`}
                animate={
                  isPulsing
                    ? {
                        backgroundColor: [
                          'rgba(59, 130, 246, 0)',
                          'rgba(59, 130, 246, 0.15)',
                          'rgba(59, 130, 246, 0)',
                        ],
                      }
                    : {}
                }
                transition={{ duration: 0.35, ease: 'easeOut' }}
                onClick={(e) => {
                  if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    onToggleSelectFile?.(file.id, e);
                  } else if (folder) {
                    onOpenFile(file);
                  } else {
                    onPreviewFile(file);
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, file)}
                className={`group transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {/* Row Checkbox */}
                <td
                  className="py-3 px-3 text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    id={`checkbox-row-${file.id}`}
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onToggleSelectFile?.(file.id, e as unknown as React.MouseEvent)}
                    className="w-4 h-4 rounded-sm text-blue-600 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 focus:ring-blue-500 cursor-pointer"
                    title={isSelected ? 'Deselect' : 'Select'}
                  />
                </td>

                {/* Star toggle */}
                <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                  {activeSection !== 'trash' && (
                    <button
                      id={`btn-star-row-${file.id}`}
                      onClick={() => onToggleStar(file)}
                      className={`p-1 rounded-md text-zinc-300 dark:text-zinc-600 hover:text-amber-400 transition-colors ${
                        file.starred ? 'text-amber-400' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${file.starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                  )}
                </td>

                {/* Name and Icon */}
                <td className="py-3 px-3">
                  <div className="flex items-center space-x-3">
                    <FileIcon mimeType={file.mimeType} className="w-5 h-5 shrink-0" />
                    <span className="font-medium text-xs truncate max-w-xs md:max-w-md" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                </td>

                {/* Owner */}
                <td className="py-3 px-3 hidden md:table-cell text-xs text-zinc-500 dark:text-zinc-400">
                  {file.owners && file.owners.length > 0 ? (
                    <div className="flex items-center space-x-1.5 truncate max-w-[120px]">
                      {file.owners[0].photoLink && (
                        <img
                          src={file.owners[0].photoLink}
                          alt={file.owners[0].displayName}
                          referrerPolicy="no-referrer"
                          className="w-4 h-4 rounded-full"
                        />
                      )}
                      <span className="truncate">{file.owners[0].displayName || 'me'}</span>
                    </div>
                  ) : (
                    'me'
                  )}
                </td>

                {/* Modified Time */}
                <td className="py-3 px-3 hidden sm:table-cell text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  {formatDate(file.modifiedTime)}
                </td>

                {/* File Size */}
                <td className="py-3 px-3 hidden lg:table-cell text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  {folder ? '—' : formatBytes(file.size)}
                </td>

                {/* Row Actions Menu */}
                <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end space-x-1">
                    <button
                      id={`btn-row-menu-${file.id}`}
                      onClick={(e) => handleContextMenu(e, file)}
                      className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      title="More actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
