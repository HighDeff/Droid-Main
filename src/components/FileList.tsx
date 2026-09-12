import React, { useState, useRef, useEffect } from 'react';
import {
  Star,
  MoreVertical,
  ExternalLink,
  Eye,
  Edit2,
  Trash2,
  Download,
  RotateCcw,
} from 'lucide-react';
import { DriveFile, ActiveSection } from '../types/drive';
import { FileIcon } from './FileIcon';
import { formatBytes, formatDate, isFolder } from '../utils/fileUtils';

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
}) => {
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

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
    <div className="w-full overflow-x-auto">
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
            const isMenuOpen = activeMenuFileId === file.id;
            const isSelected = selectedFileIds.includes(file.id);

            return (
              <tr
                key={file.id}
                id={`file-row-${file.id}`}
                onDoubleClick={() => onOpenFile(file)}
                onClick={(e) => {
                  if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    onToggleSelectFile?.(file.id, e);
                  }
                }}
                className={`group transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 ring-1 ring-inset ring-blue-400/40'
                    : 'hover:bg-blue-50/40 dark:hover:bg-blue-950/20'
                }`}
              >
                {/* Checkbox column */}
                <td className="py-2.5 px-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    id={`checkbox-select-${file.id}`}
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onToggleSelectFile?.(file.id, e as unknown as React.MouseEvent)}
                    className="w-4 h-4 rounded-sm text-blue-600 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 focus:ring-blue-500 cursor-pointer"
                    title={isSelected ? 'Deselect' : 'Select'}
                  />
                </td>

                {/* Star toggle */}
                <td className="py-2.5 px-2 w-8 text-center" onClick={(e) => e.stopPropagation()}>
                  {activeSection !== 'trash' && (
                    <button
                      id={`btn-star-${file.id}`}
                      onClick={() => onToggleStar(file)}
                      title={file.starred ? 'Remove star' : 'Add star'}
                      className="text-zinc-300 dark:text-zinc-600 hover:text-amber-400 dark:hover:text-amber-400 transition-colors"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          file.starred ? 'fill-amber-400 text-amber-400' : ''
                        }`}
                      />
                    </button>
                  )}
                </td>

                {/* Name and Icon */}
                <td
                  className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100"
                  onClick={() => onOpenFile(file)}
                >
                  <div className="flex items-center space-x-3">
                    <FileIcon
                      mimeType={file.mimeType}
                      className="w-5 h-5 shrink-0"
                      customIconLink={file.iconLink}
                    />
                    <span className="truncate max-w-xs md:max-w-md hover:underline">
                      {file.name}
                    </span>
                  </div>
                </td>

                {/* Owner */}
                <td className="py-2.5 px-3 text-xs text-zinc-500 dark:text-zinc-400 hidden md:table-cell">
                  {file.owners && file.owners.length > 0 ? (
                    <span>{file.owners[0].me ? 'me' : file.owners[0].displayName || 'Shared'}</span>
                  ) : (
                    'me'
                  )}
                </td>

                {/* Modified date */}
                <td className="py-2.5 px-3 text-xs text-zinc-500 dark:text-zinc-400 hidden sm:table-cell font-mono">
                  {formatDate(file.modifiedTime)}
                </td>

                {/* File size */}
                <td className="py-2.5 px-3 text-xs text-zinc-500 dark:text-zinc-400 hidden lg:table-cell font-mono">
                  {folder ? '--' : formatBytes(file.size)}
                </td>

                {/* Action dropdown menu */}
                <td className="py-2.5 px-3 text-right relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    id={`btn-file-menu-${file.id}`}
                    onClick={() => setActiveMenuFileId(isMenuOpen ? null : file.id)}
                    className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {isMenuOpen && (
                    <div
                      id={`file-menu-dropdown-${file.id}`}
                      className="absolute right-3 top-10 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100"
                    >
                      {/* Open / Preview */}
                      <button
                        id={`menu-item-preview-${file.id}`}
                        onClick={() => {
                          setActiveMenuFileId(null);
                          onPreviewFile(file);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-500" />
                        <span>Preview details</span>
                      </button>

                      {file.webViewLink && (
                        <a
                          id={`menu-item-open-drive-${file.id}`}
                          href={file.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => setActiveMenuFileId(null)}
                          className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Open in Google Drive</span>
                        </a>
                      )}

                      {activeSection !== 'trash' && (
                        <>
                          <button
                            id={`menu-item-rename-${file.id}`}
                            onClick={() => {
                              setActiveMenuFileId(null);
                              onRenameFile(file);
                            }}
                            className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                            <span>Rename</span>
                          </button>

                          {file.webContentLink && (
                            <a
                              id={`menu-item-download-${file.id}`}
                              href={file.webContentLink}
                              download
                              onClick={() => setActiveMenuFileId(null)}
                              className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Download</span>
                            </a>
                          )}
                        </>
                      )}

                      {activeSection === 'trash' && onRestoreFile && (
                        <button
                          id={`menu-item-restore-${file.id}`}
                          onClick={() => {
                            setActiveMenuFileId(null);
                            onRestoreFile(file);
                          }}
                          className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore file</span>
                        </button>
                      )}

                      <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

                      <button
                        id={`menu-item-delete-${file.id}`}
                        onClick={() => {
                          setActiveMenuFileId(null);
                          onDeleteFile(file);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-left"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{activeSection === 'trash' ? 'Delete forever' : 'Move to trash'}</span>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
