import React, { useState, useRef } from 'react';
import { X, UploadCloud, File as FileIcon, Trash2, CheckCircle2 } from 'lucide-react';
import { formatBytes } from '../utils/fileUtils';

interface UploadModalProps {
  isOpen: boolean;
  targetFolderName: string;
  isLoading: boolean;
  onClose: () => void;
  onUploadFiles: (files: File[]) => Promise<void>;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  targetFolderName,
  isLoading,
  onClose,
  onUploadFiles,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFiles = (filesList: FileList | null) => {
    if (!filesList) return;
    const newFiles = Array.from(filesList);
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartUpload = async () => {
    if (selectedFiles.length === 0) return;
    await onUploadFiles(selectedFiles);
    setSelectedFiles([]);
  };

  return (
    <div
      id="upload-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 transition-all animate-in fade-in duration-200"
    >
      <div
        id="upload-modal-container"
        className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Upload to Google Drive
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Destination: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{targetFolderName}</span>
            </p>
          </div>
          <button
            id="btn-close-upload-modal"
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drag and Drop Zone */}
        <div
          id="dropzone-area"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
              : 'border-zinc-200 dark:border-zinc-700/80 hover:border-blue-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center space-y-2">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Drag and drop files here, or <span className="text-blue-600 dark:text-blue-400 underline">browse</span>
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                Upload images, documents, PDFs, videos, or archives
              </p>
            </div>
          </div>
        </div>

        {/* Selected files preview */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
              <span>{selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'} selected</span>
              <button
                type="button"
                onClick={() => setSelectedFiles([])}
                className="text-red-500 hover:underline text-[11px]"
              >
                Clear all
              </button>
            </div>
            {selectedFiles.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-100 dark:border-zinc-800 text-xs"
              >
                <div className="flex items-center space-x-2.5 overflow-hidden">
                  <FileIcon className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="truncate font-medium text-zinc-800 dark:text-zinc-200 max-w-[260px]">
                    {f.name}
                  </span>
                  <span className="text-zinc-400 font-mono text-[11px] shrink-0">
                    ({formatBytes(f.size)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-zinc-400 hover:text-red-500 p-1 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2.5 pt-2">
          <button
            id="btn-cancel-upload"
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-upload"
            type="button"
            onClick={handleStartUpload}
            disabled={isLoading || selectedFiles.length === 0}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
