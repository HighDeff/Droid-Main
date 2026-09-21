import React, { useState } from 'react';
import {
  Search,
  X,
  LayoutGrid,
  List,
  RefreshCw,
  LogOut,
  ChevronDown,
  Eye,
  Zap,
  Sliders,
} from 'lucide-react';
import { ViewMode } from '../types/drive';
import { User } from 'firebase/auth';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
  onClearSearch: () => void;
  viewMode: ViewMode;
  onToggleViewMode: (mode: ViewMode) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  user: User | null;
  onSignOut: () => void;
  onToggleOverseer?: () => void;
  isOverseerOpen?: boolean;
  onOpenOrchestrator?: () => void;
  onOpenSettingsModal?: () => void;
  freeRoamMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onClearSearch,
  viewMode,
  onToggleViewMode,
  onRefresh,
  isRefreshing,
  user,
  onSignOut,
  onToggleOverseer,
  isOverseerOpen = false,
  onOpenOrchestrator,
  onOpenSettingsModal,
  freeRoamMode = false,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearchSubmit();
    }
  };

  return (
    <header
      id="app-header"
      className="h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 md:px-6 flex items-center justify-between gap-4 sticky top-0 z-30"
    >
      {/* Brand */}
      <div className="flex items-center space-x-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center border border-blue-100 dark:border-blue-900/40">
          <svg className="w-6 h-6" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.25z" fill="#00832d"/>
            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
            <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
          </svg>
        </div>
        <div className="hidden sm:block">
          <span className="font-semibold text-base text-zinc-900 dark:text-zinc-100 tracking-tight">
            Drive Workspace
          </span>
        </div>
      </div>

      {/* Global Drive Search Bar */}
      <div className="flex-1 max-w-xl mx-auto">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="drive-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files and folders in Drive..."
            className="w-full pl-10 pr-10 py-2 text-sm bg-zinc-100 dark:bg-zinc-800/80 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 transition-all outline-hidden"
          />
          {searchQuery && (
            <button
              id="btn-clear-search"
              onClick={onClearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Controls & Profile */}
      <div className="flex items-center space-x-2 shrink-0">
        {/* Autonomous Orchestrator Button */}
        <button
          id="btn-header-open-orchestrator"
          onClick={onOpenOrchestrator}
          title="Open Autonomous Workflow Orchestrator"
          className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-2xs"
        >
          <Zap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span className="hidden md:inline">Orchestrator</span>
          {freeRoamMode && (
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
          )}
        </button>

        {/* Overseer AI Toggle Button */}
        <button
          id="btn-header-toggle-overseer"
          onClick={onToggleOverseer}
          title="Toggle Overseer AI Screen Monitor & Learning Ledger"
          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-2xs ${
            isOverseerOpen
              ? 'bg-purple-600 text-white border-purple-600 shadow-purple-500/20 shadow-xs'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200/80 dark:border-zinc-700/80 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
        >
          <div className="relative">
            <Eye className="w-3.5 h-3.5" />
            <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
          </div>
          <span className="hidden md:inline">Overseer AI</span>
        </button>

        {/* Auto-Deploy Settings Button */}
        <button
          id="btn-header-open-settings"
          onClick={onOpenSettingsModal}
          title="Auto-Deploy, Emergency Triggers & Free Roam Settings"
          className="p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Refresh Button */}
        <button
          id="btn-refresh-drive"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh Drive files"
          className="p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
        </button>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/50">
          <button
            id="btn-view-grid"
            onClick={() => onToggleViewMode('grid')}
            title="Grid view"
            className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            id="btn-view-list"
            onClick={() => onToggleViewMode('list')}
            title="List view"
            className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'list'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* User Profile dropdown */}
        {user && (
          <div className="relative">
            <button
              id="btn-user-profile-menu"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-7 h-7 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
            </button>

            {isUserMenuOpen && (
              <div
                id="user-profile-dropdown"
                className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {user.displayName || 'Google Drive User'}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-mono">
                    {user.email}
                  </p>
                </div>
                <div className="p-1">
                  <button
                    id="btn-sign-out"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out of Google Drive</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
