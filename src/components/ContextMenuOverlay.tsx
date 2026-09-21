import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DriveFile } from '../types/drive';
import { ActionRegistry, ActionDefinition } from '../services/actionRegistry';
import { FileIcon } from './FileIcon';
import { isFolder } from '../utils/fileUtils';

interface ContextMenuOverlayProps {
  isOpen: boolean;
  position: { x: number; y: number };
  file: DriveFile | null;
  actionRegistry: ActionRegistry;
  onClose: () => void;
}

export const ContextMenuOverlay: React.FC<ContextMenuOverlayProps> = ({
  isOpen,
  position,
  file,
  actionRegistry,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && menuRef.current) {
      menuRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen || !file) return null;

  const actions: ActionDefinition[] = actionRegistry.getAvailableActions(file);
  const folder = isFolder(file);

  return (
    <AnimatePresence>
      <div
        id="custom-context-menu-backdrop"
        className="fixed inset-0 z-50 pointer-events-none"
      >
        <motion.div
          ref={menuRef}
          id="custom-context-menu-overlay"
          tabIndex={-1}
          initial={{ opacity: 0, scale: 0.92, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.1 } }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
          className="pointer-events-auto w-64 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200/90 dark:border-zinc-800/90 rounded-2xl shadow-2xl py-1.5 z-50 focus:outline-hidden text-xs select-none"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {/* Header with preview thumbnail/icon & file title */}
          <div className="px-3.5 py-2.5 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <FileIcon mimeType={file.mimeType} className="w-4 h-4" />
            </div>
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate text-[11px]" title={file.name}>
                {file.name}
              </p>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-mono">
                {folder ? 'Folder' : file.mimeType.split('/').pop()?.toUpperCase() || 'File'}
              </span>
            </div>
          </div>

          {/* Action Items List */}
          <div className="py-1 max-h-[380px] overflow-y-auto">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <React.Fragment key={action.id}>
                  {action.dividerBefore && (
                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1 mx-2" />
                  )}
                  <motion.button
                    id={`context-action-${action.id}`}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onClose();
                      action.execute(file);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-1.5 transition-colors text-left group ${
                      action.destructive
                        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
                        : action.category === 'gesture'
                        ? 'text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                        : action.category === 'advanced'
                        ? 'text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 font-semibold'
                        : 'text-zinc-700 dark:text-zinc-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110 ${
                          action.destructive
                            ? 'text-red-500'
                            : action.category === 'gesture'
                            ? 'text-indigo-500 dark:text-indigo-400'
                            : action.category === 'advanced'
                            ? 'text-cyan-500'
                            : 'text-zinc-400 group-hover:text-blue-500 dark:text-zinc-500'
                        }`}
                      />
                      <span className="truncate">{action.label}</span>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                      {action.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 font-mono font-bold">
                          {action.badge}
                        </span>
                      )}
                      {action.shortcut && (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono tracking-tighter">
                          {action.shortcut}
                        </span>
                      )}
                    </div>
                  </motion.button>
                </React.Fragment>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
