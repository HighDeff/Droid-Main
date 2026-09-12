import React, { useState } from 'react';
import {
  Folder,
  Star,
  MoreVertical,
  ExternalLink,
  Eye,
  Edit2,
  Trash2,
  RotateCcw,
  Download,
} from 'lucide-react';
import { DriveFile, ActiveSection } from '../types/drive';
import { FileIcon } from './FileIcon';
import { formatBytes, formatDate, isFolder, getFileCategory } from '../utils/fileUtils';

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
}) => {
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);

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
    <div className="space-y-6">
      {/* Folders Section */}
      {folders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Folders ({folders.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {folders.map((folder) => {
              const isMenuOpen = activeMenuFileId === folder.id;
              const isSelected = selectedFileIds.includes(folder.id);

              return (
                <div
                  key={folder.id}
                  id={`folder-card-${folder.id}`}
                  onClick={(e) => {
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                      onToggleSelectFile?.(folder.id, e);
                    } else {
                      onOpenFile(folder);
                    }
                  }}
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
                        id={`btn-star-${folder.id}`}
                        onClick={() => onToggleStar(folder)}
                        className="p-1 text-zinc-300 dark:text-zinc-600 hover:text-amber-400 dark:hover:text-amber-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            folder.starred ? 'fill-amber-400 text-amber-400 opacity-100' : ''
                          }`}
                        />
                      </button>
                    )}

                    <button
                      id={`btn-folder-menu-${folder.id}`}
                      onClick={() => setActiveMenuFileId(isMenuOpen ? null : folder.id)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Context dropdown */}
                  {isMenuOpen && (
                    <div
                      id={`menu-dropdown-${folder.id}`}
                      className="absolute right-2 top-10 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl py-1 z-40 text-xs animate-in fade-in zoom-in-95 duration-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setActiveMenuFileId(null);
                          onPreviewFile(folder);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-500" />
                        <span>Folder details</span>
                      </button>

                      {activeSection !== 'trash' && (
                        <button
                          onClick={() => {
                            setActiveMenuFileId(null);
                            onRenameFile(folder);
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                          <span>Rename</span>
                        </button>
                      )}

                      {activeSection === 'trash' && onRestoreFile && (
                        <button
                          onClick={() => {
                            setActiveMenuFileId(null);
                            onRestoreFile(folder);
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore folder</span>
                        </button>
                      )}

                      <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

                      <button
                        onClick={() => {
                          setActiveMenuFileId(null);
                          onDeleteFile(folder);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-left"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{activeSection === 'trash' ? 'Delete forever' : 'Move to trash'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Files Section */}
      {regularFiles.length > 0 && (
        <div className="space-y-3">
          {folders.length > 0 && (
            <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Files ({regularFiles.length})
            </h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {regularFiles.map((file) => {
              const category = getFileCategory(file.mimeType);
              const isMenuOpen = activeMenuFileId === file.id;
              const isSelected = selectedFileIds.includes(file.id);

              return (
                <div
                  key={file.id}
                  id={`file-card-${file.id}`}
                  onClick={(e) => {
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                      onToggleSelectFile?.(file.id, e);
                    } else {
                      onPreviewFile(file);
                    }
                  }}
                  className={`group relative flex flex-col justify-between rounded-2xl shadow-2xs transition-all cursor-pointer overflow-hidden ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-2 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-white dark:bg-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 border border-zinc-200/80 dark:border-zinc-700/70 hover:shadow-xs'
                  }`}
                >
                  {/* Card Preview / Thumbnail area */}
                  <div className="h-28 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-100 dark:border-zinc-700/40 flex items-center justify-center p-3 relative">
                    {/* Top-left corner Checkbox for File Card */}
                    <div
                      className={`absolute top-2 left-2 z-10 transition-opacity ${
                        isSelected || selectedFileIds.length > 0
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xs p-1 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60 shadow-2xs flex items-center justify-center">
                        <input
                          id={`checkbox-file-${file.id}`}
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => onToggleSelectFile?.(file.id, e as unknown as React.MouseEvent)}
                          className="w-4 h-4 rounded-sm text-blue-600 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 focus:ring-blue-500 cursor-pointer"
                          title={isSelected ? 'Deselect file' : 'Select file'}
                        />
                      </div>
                    </div>

                    {file.thumbnailLink ? (
                      <img
                        src={file.thumbnailLink}
                        alt={file.name}
                        className="h-full w-full object-contain rounded-lg"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex flex-col items-center space-y-1">
                        <FileIcon mimeType={file.mimeType} className="w-10 h-10" />
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${category.bgColor}`}>
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
                        onClick={() => setActiveMenuFileId(isMenuOpen ? null : file.id)}
                        className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
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

                  {/* Context dropdown menu */}
                  {isMenuOpen && (
                    <div
                      id={`card-dropdown-menu-${file.id}`}
                      className="absolute right-2 top-10 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl py-1 z-40 text-xs animate-in fade-in zoom-in-95 duration-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setActiveMenuFileId(null);
                          onPreviewFile(file);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-500" />
                        <span>Preview file</span>
                      </button>

                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => setActiveMenuFileId(null)}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Open in Drive</span>
                        </a>
                      )}

                      {activeSection !== 'trash' && (
                        <>
                          <button
                            onClick={() => {
                              setActiveMenuFileId(null);
                              onRenameFile(file);
                            }}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                            <span>Rename</span>
                          </button>

                          {file.webContentLink && (
                            <a
                              href={file.webContentLink}
                              download
                              onClick={() => setActiveMenuFileId(null)}
                              className="w-full flex items-center space-x-2 px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Download</span>
                            </a>
                          )}
                        </>
                      )}

                      {activeSection === 'trash' && onRestoreFile && (
                        <button
                          onClick={() => {
                            setActiveMenuFileId(null);
                            onRestoreFile(file);
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore file</span>
                        </button>
                      )}

                      <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

                      <button
                        onClick={() => {
                          setActiveMenuFileId(null);
                          onDeleteFile(file);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-left"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{activeSection === 'trash' ? 'Delete forever' : 'Move to trash'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
