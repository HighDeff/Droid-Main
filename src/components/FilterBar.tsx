import React from 'react';
import { FileFilter } from '../types/drive';
import {
  Folder,
  FileText,
  Table,
  Presentation,
  FileCode,
  Image as ImageIcon,
  Layers,
  ArrowUpDown,
} from 'lucide-react';

interface FilterBarProps {
  currentFilter: FileFilter;
  onSelectFilter: (filter: FileFilter) => void;
  orderBy: string;
  onOrderByChange: (order: string) => void;
  totalFiles: number;
}

const FILTER_ITEMS: { id: FileFilter; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'all', label: 'All Files', icon: Layers },
  { id: 'folders', label: 'Folders', icon: Folder },
  { id: 'documents', label: 'Docs', icon: FileText },
  { id: 'spreadsheets', label: 'Sheets', icon: Table },
  { id: 'presentations', label: 'Slides', icon: Presentation },
  { id: 'pdfs', label: 'PDFs', icon: FileCode },
  { id: 'media', label: 'Media', icon: ImageIcon },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  currentFilter,
  onSelectFilter,
  orderBy,
  onOrderByChange,
  totalFiles,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
      {/* Filters */}
      <div className="flex items-center space-x-1.5 overflow-x-auto py-1 scrollbar-none">
        {FILTER_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentFilter === item.id;
          return (
            <button
              key={item.id}
              id={`filter-btn-${item.id}`}
              onClick={() => onSelectFilter(item.id)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sorting & Count */}
      <div className="flex items-center space-x-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="hidden sm:inline font-mono">
          {totalFiles} {totalFiles === 1 ? 'item' : 'items'}
        </span>

        <div className="flex items-center space-x-1.5 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
          <select
            id="drive-sort-select"
            value={orderBy}
            onChange={(e) => onOrderByChange(e.target.value)}
            className="bg-transparent text-xs font-medium text-zinc-700 dark:text-zinc-300 outline-hidden cursor-pointer"
          >
            <option value="folder,modifiedTime desc">Last modified</option>
            <option value="folder,name">Name (A-Z)</option>
            <option value="folder,quotaBytesUsed desc">Size</option>
          </select>
        </div>
      </div>
    </div>
  );
};
