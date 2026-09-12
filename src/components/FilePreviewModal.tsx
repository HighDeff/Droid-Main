import React from 'react';
import {
  X,
  ExternalLink,
  Download,
  Calendar,
  Clock,
  HardDrive,
  Users,
  Star,
  Trash2,
  Edit2,
} from 'lucide-react';
import { DriveFile, ActiveSection } from '../types/drive';
import { FileIcon } from './FileIcon';
import { formatBytes, formatDate, getFileCategory, isFolder } from '../utils/fileUtils';

interface FilePreviewModalProps {
  file: DriveFile | null;
  activeSection: ActiveSection;
  onClose: () => void;
  onToggleStar: (file: DriveFile) => void;
  onRename: (file: DriveFile) => void;
  onDelete: (file: DriveFile) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  activeSection,
  onClose,
  onToggleStar,
  onRename,
  onDelete,
}) => {
  if (!file) return null;

  const category = getFileCategory(file.mimeType);
  const folder = isFolder(file);

  return (
    <div
      id="file-preview-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 transition-all animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="file-preview-container"
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <FileIcon mimeType={file.mimeType} className="w-6 h-6 shrink-0" customIconLink={file.iconLink} />
            <div className="overflow-hidden">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={file.name}>
                {file.name}
              </h3>
              <span className={`inline-block text-[10px] px-2 py-0.5 rounded-md font-medium mt-0.5 ${category.bgColor}`}>
                {category.label}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0 ml-2">
            {activeSection !== 'trash' && (
              <button
                id="btn-preview-star"
                onClick={() => onToggleStar(file)}
                className="p-2 text-zinc-400 hover:text-amber-400 dark:hover:text-amber-400 rounded-xl transition-colors"
                title={file.starred ? 'Remove star' : 'Star file'}
              >
                <Star className={`w-4 h-4 ${file.starred ? 'fill-amber-400 text-amber-400' : ''}`} />
              </button>
            )}

            <button
              id="btn-close-preview-modal"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content / Preview Area */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Visual Preview / Thumbnail */}
          {file.thumbnailLink ? (
            <div className="w-full h-56 bg-zinc-50 dark:bg-zinc-950 rounded-2xl flex items-center justify-center p-4 border border-zinc-100 dark:border-zinc-800/80 overflow-hidden">
              <img
                src={file.thumbnailLink}
                alt={file.name}
                className="max-h-full max-w-full object-contain rounded-lg shadow-xs"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="w-full py-10 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl flex flex-col items-center justify-center space-y-2 border border-dashed border-zinc-200 dark:border-zinc-700/60 text-center">
              <FileIcon mimeType={file.mimeType} className="w-12 h-12" />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                {file.mimeType}
              </p>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-1">
              <div className="flex items-center space-x-2 text-zinc-500 dark:text-zinc-400 font-medium">
                <HardDrive className="w-3.5 h-3.5" />
                <span>Size</span>
              </div>
              <p className="text-zinc-900 dark:text-zinc-100 font-mono font-medium">
                {folder ? 'Folder' : formatBytes(file.size)}
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-1">
              <div className="flex items-center space-x-2 text-zinc-500 dark:text-zinc-400 font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>Modified</span>
              </div>
              <p className="text-zinc-900 dark:text-zinc-100 font-mono font-medium">
                {formatDate(file.modifiedTime)}
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-1">
              <div className="flex items-center space-x-2 text-zinc-500 dark:text-zinc-400 font-medium">
                <Calendar className="w-3.5 h-3.5" />
                <span>Created</span>
              </div>
              <p className="text-zinc-900 dark:text-zinc-100 font-mono font-medium">
                {formatDate(file.createdTime)}
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-1">
              <div className="flex items-center space-x-2 text-zinc-500 dark:text-zinc-400 font-medium">
                <Users className="w-3.5 h-3.5" />
                <span>Owner</span>
              </div>
              <p className="text-zinc-900 dark:text-zinc-100 truncate font-medium">
                {file.owners && file.owners.length > 0
                  ? file.owners[0].me
                    ? 'me (You)'
                    : file.owners[0].displayName || file.owners[0].emailAddress
                  : 'You'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 bg-zinc-50/80 dark:bg-zinc-800/40 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            {activeSection !== 'trash' && (
              <button
                id="btn-preview-action-rename"
                onClick={() => {
                  onClose();
                  onRename(file);
                }}
                className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Rename</span>
              </button>
            )}

            <button
              id="btn-preview-action-delete"
              onClick={() => {
                onClose();
                onDelete(file);
              }}
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900/40 rounded-xl transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{activeSection === 'trash' ? 'Delete forever' : 'Move to trash'}</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {file.webContentLink && (
              <a
                id="btn-preview-action-download"
                href={file.webContentLink}
                download
                className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                <span>Download</span>
              </a>
            )}

            {file.webViewLink && (
              <a
                id="btn-preview-action-open-drive"
                href={file.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center space-x-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Google Drive</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
