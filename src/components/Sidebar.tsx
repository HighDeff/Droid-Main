import React, { useState } from 'react';
import {
  Plus,
  HardDrive,
  Star,
  Trash2,
  FolderPlus,
  UploadCloud,
  FileText,
  Table,
  Cloud,
  PieChart,
  BarChart3,
} from 'lucide-react';
import { ActiveSection, StorageQuota } from '../types/drive';
import { formatBytes } from '../utils/fileUtils';

interface SidebarProps {
  activeSection: ActiveSection;
  onSelectSection: (section: ActiveSection) => void;
  onOpenCreateFolder: () => void;
  onOpenUpload: () => void;
  onOpenCreateDoc: (type: 'document' | 'spreadsheet') => void;
  storageQuota?: StorageQuota;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  onOpenCreateFolder,
  onOpenUpload,
  onOpenCreateDoc,
  storageQuota,
}) => {
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);

  // Storage usage calculation
  const usageNum = storageQuota?.usage ? parseInt(storageQuota.usage, 10) : 0;
  const limitNum = storageQuota?.limit ? parseInt(storageQuota.limit, 10) : 0;
  const percentage = limitNum > 0 ? Math.min(Math.round((usageNum / limitNum) * 100), 100) : 0;

  return (
    <aside
      id="app-sidebar"
      className="w-64 bg-zinc-50/70 dark:bg-zinc-900/50 border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between p-4 shrink-0 h-[calc(100vh-4rem)] overflow-y-auto"
    >
      <div className="space-y-6">
        {/* + New Button with drop menu */}
        <div className="relative">
          <button
            id="btn-new-drive-item"
            type="button"
            onClick={() => setIsNewMenuOpen(!isNewMenuOpen)}
            className="w-full flex items-center justify-center space-x-2 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-900 dark:text-zinc-100 font-medium py-2.5 px-4 rounded-2xl shadow-xs border border-zinc-200 dark:border-zinc-700 transition-all hover:shadow-sm"
          >
            <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm">New</span>
          </button>

          {isNewMenuOpen && (
            <div
              id="new-item-dropdown"
              className="absolute left-0 mt-2 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl py-2 z-40 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <button
                id="btn-action-new-folder"
                onClick={() => {
                  setIsNewMenuOpen(false);
                  onOpenCreateFolder();
                }}
                className="w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
              >
                <FolderPlus className="w-4 h-4 text-amber-500" />
                <span>New Folder</span>
              </button>
              <button
                id="btn-action-upload-file"
                onClick={() => {
                  setIsNewMenuOpen(false);
                  onOpenUpload();
                }}
                className="w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
              >
                <UploadCloud className="w-4 h-4 text-blue-500" />
                <span>File upload</span>
              </button>
              <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
              <button
                id="btn-action-create-doc"
                onClick={() => {
                  setIsNewMenuOpen(false);
                  onOpenCreateDoc('document');
                }}
                className="w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Google Docs</span>
              </button>
              <button
                id="btn-action-create-sheet"
                onClick={() => {
                  setIsNewMenuOpen(false);
                  onOpenCreateDoc('spreadsheet');
                }}
                className="w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
              >
                <Table className="w-4 h-4 text-emerald-600" />
                <span>Google Sheets</span>
              </button>
            </div>
          )}
        </div>

        {/* Primary Sections Navigation */}
        <nav className="space-y-1">
          <button
            id="nav-item-my-drive"
            onClick={() => onSelectSection('my-drive')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
              activeSection === 'my-drive'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>My Drive</span>
          </button>

          <button
            id="nav-item-starred"
            onClick={() => onSelectSection('starred')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
              activeSection === 'starred'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Star className="w-4 h-4" />
            <span>Starred</span>
          </button>

          <button
            id="nav-item-trash"
            onClick={() => onSelectSection('trash')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
              activeSection === 'trash'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Trash</span>
          </button>

          <button
            id="nav-item-analytics"
            onClick={() => onSelectSection('analytics')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
              activeSection === 'analytics'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <PieChart className="w-4 h-4 text-purple-500" />
            <span>Storage Analytics</span>
          </button>

          <button
            id="nav-item-execution-analytics"
            onClick={() => onSelectSection('execution-analytics')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
              activeSection === 'execution-analytics'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-cyan-500" />
            <span>Execution Analytics</span>
          </button>
        </nav>
      </div>

      {/* Storage Quota widget (clickable to open Analytics) */}
      <div
        id="sidebar-storage-widget"
        onClick={() => onSelectSection('analytics')}
        className="bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-2xl p-3.5 space-y-2.5 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500/60 transition-all group"
        title="Click to view detailed disk usage analytics"
      >
        <div className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-300">
          <span className="flex items-center space-x-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            <Cloud className="w-3.5 h-3.5 text-blue-500" />
            <span>Storage</span>
          </span>
          <span className="text-zinc-500 font-mono text-[11px]">{percentage}%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percentage > 90
                ? 'bg-red-500'
                : percentage > 75
                ? 'bg-amber-500'
                : 'bg-blue-500'
            }`}
            style={{ width: `${Math.max(percentage, 3)}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
            {formatBytes(usageNum)} of {limitNum > 0 ? formatBytes(limitNum) : 'Unlimited'} used
          </p>
          <span className="text-[10px] text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
            View &rarr;
          </span>
        </div>
      </div>
    </aside>
  );
};
