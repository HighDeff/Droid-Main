/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
} from './services/firebaseAuth';
import {
  fetchDriveAbout,
  listDriveFiles,
  createDriveFolder,
  createBlankGoogleDoc,
  uploadFileToDrive,
  updateDriveFile,
  deleteDriveFilePermanently,
  emptyDriveTrash,
} from './services/driveApi';
import {
  DriveFile,
  DriveAbout,
  ViewMode,
  ActiveSection,
  FileFilter,
  BreadcrumbItem,
  DestructiveActionConfig,
} from './types/drive';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Breadcrumbs } from './components/Breadcrumbs';
import { FilterBar } from './components/FilterBar';
import { FileList } from './components/FileList';
import { FileGrid } from './components/FileGrid';
import { FilePreviewModal } from './components/FilePreviewModal';
import { CreateItemModal, CreateModalType } from './components/CreateItemModal';
import { UploadModal } from './components/UploadModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { BulkActionBar } from './components/BulkActionBar';
import { AuthScreen } from './components/AuthScreen';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { ExecutionAnalyticsTab } from './components/ExecutionAnalyticsTab';
import { DiffFramesTestModal } from './components/DiffFramesTestModal';
import { AutoDeploySettingsModal } from './components/AutoDeploySettingsModal';
import { OverseerAIPanel } from './components/OverseerAIPanel';
import { AutonomousWorkflowModal } from './components/AutonomousWorkflowModal';
import { AutoDeployEngine, DEFAULT_AUTO_DEPLOY_SETTINGS } from './services/autoDeployEngine';
import { AutoDeploySettings, OverseerLearnedNote, OverseerNudge } from './types/automation';
import { isFolder } from './utils/fileUtils';
import { AlertCircle, CheckCircle2, UploadCloud } from 'lucide-react';

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Drive state
  const [about, setAbout] = useState<DriveAbout | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [activeSection, setActiveSection] = useState<ActiveSection>('my-drive');
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'My Drive' },
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [isDraggingOverMain, setIsDraggingOverMain] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem('drive_view_mode');
      if (saved === 'grid' || saved === 'list') {
        return saved;
      }
    } catch {
      // Fallback if localStorage is restricted
    }
    return 'grid';
  });
  const [currentFilter, setCurrentFilter] = useState<FileFilter>('all');
  const [orderBy, setOrderBy] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('drive_order_by');
      if (
        saved &&
        ['folder,modifiedTime desc', 'folder,name', 'folder,quotaBytesUsed desc'].includes(saved)
      ) {
        return saved;
      }
    } catch {
      // Fallback if localStorage is restricted
    }
    return 'folder,modifiedTime desc';
  });

  // Persist viewMode and orderBy to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('drive_view_mode', viewMode);
    } catch {
      // Ignore write errors
    }
  }, [viewMode]);

  useEffect(() => {
    try {
      localStorage.setItem('drive_order_by', orderBy);
    } catch {
      // Ignore write errors
    }
  }, [orderBy]);

  // Loading & notification states
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals state
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [createModal, setCreateModal] = useState<{
    isOpen: boolean;
    type: CreateModalType;
    initialValue?: string;
    targetFileId?: string;
  }>({
    isOpen: false,
    type: 'folder',
  });
  const [isCreateModalLoading, setIsCreateModalLoading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Destructive Confirmation Modal
  const [destructiveConfig, setDestructiveConfig] = useState<DestructiveActionConfig>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    fileIds: [],
    fileNames: [],
    isPermanent: false,
  });
  const [isDestructiveLoading, setIsDestructiveLoading] = useState(false);

  // Multi-select state
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  // Diff Frame Tester Modal State
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [diffTestFile, setDiffTestFile] = useState<DriveFile | null>(null);

  // Auto-Deploy & Overseer AI State
  const [autoDeployEngine] = useState(() => new AutoDeployEngine());
  const [autoDeploySettings, setAutoDeploySettings] = useState<AutoDeploySettings>(
    () => autoDeployEngine.getSettings()
  );
  const [learnedNotes, setLearnedNotes] = useState<OverseerLearnedNote[]>(
    () => autoDeployEngine.getLearnedNotes()
  );
  const [isOverseerOpen, setIsOverseerOpen] = useState(false);
  const [isOrchestratorOpen, setIsOrchestratorOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const handleUpdateAutoDeploySettings = (newSettings: Partial<AutoDeploySettings>) => {
    const updated = autoDeployEngine.updateSettings(newSettings);
    setAutoDeploySettings(updated);
  };

  const handleExecuteNudgeAction = (nudge: OverseerNudge) => {
    if (nudge.targetTab) {
      setActiveSection(nudge.targetTab);
    }
    if (nudge.suggestedAction?.step) {
      showToast(`Overseer Auto-Executed: "${nudge.suggestedAction.step.title}"`);
    }
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleSwipeAction = (direction: 'up' | 'down' | 'left' | 'right', file: DriveFile) => {
    const dirArrow = direction === 'up' ? '⬆️' : direction === 'down' ? '⬇️' : direction === 'left' ? '⬅️' : '➡️';
    showToast(`Swipe ${direction.toUpperCase()} ${dirArrow} executed on: ${file.name}`);
  };

  const handleOpenDiffFrameTester = (file?: DriveFile) => {
    setDiffTestFile(file || null);
    setIsDiffModalOpen(true);
  };

  // Auth initialization
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );

    return () => unsubscribe();
  }, []);

  // Load drive data
  const loadDriveData = useCallback(
    async (accessToken: string, showRefreshSpin = false) => {
      if (showRefreshSpin) {
        setIsRefreshing(true);
      } else {
        setIsLoadingFiles(true);
      }
      setErrorMessage(null);

      try {
        // Fetch storage & user about
        fetchDriveAbout(accessToken)
          .then((aboutData) => setAbout(aboutData))
          .catch((err) => console.warn('Failed to load storage info:', err));

        // Fetch files based on active section & filters
        const options: Parameters<typeof listDriveFiles>[1] = {
          orderBy,
          filterType: currentFilter,
        };

        if (activeSection === 'trash') {
          options.trashed = true;
        } else if (activeSection === 'starred') {
          options.starred = true;
        }

        if (submittedSearch.trim().length > 0) {
          options.searchQuery = submittedSearch.trim();
        } else if (activeSection === 'my-drive') {
          options.folderId = currentFolderId;
        }

        const data = await listDriveFiles(accessToken, options);
        setFiles(data.files || []);
      } catch (err: unknown) {
        const error = err as Error;
        console.error('Failed to load Drive files:', error);
        if (error.message?.includes('401') || error.message?.includes('Invalid Credentials')) {
          setNeedsAuth(true);
          setErrorMessage('Your session expired. Please sign in again.');
        } else {
          setErrorMessage(error.message || 'Failed to load files from Google Drive.');
        }
      } finally {
        setIsLoadingFiles(false);
        setIsRefreshing(false);
      }
    },
    [activeSection, currentFolderId, submittedSearch, currentFilter, orderBy]
  );

  // Trigger load when parameters change
  useEffect(() => {
    if (token && !needsAuth) {
      loadDriveData(token);
    }
  }, [token, needsAuth, loadDriveData]);

  // Sign in handler
  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Login error:', error);
      setAuthError(error.message || 'Failed to sign in with Google Drive.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setNeedsAuth(true);
    setFiles([]);
    setSelectedFileIds([]);
    setAbout(null);
  };

  // Section navigation
  const handleSelectSection = (section: ActiveSection) => {
    setActiveSection(section);
    setSelectedFileIds([]);
    setSubmittedSearch('');
    setSearchQuery('');
    if (section === 'my-drive') {
      setCurrentFolderId('root');
      setBreadcrumbs([{ id: 'root', name: 'My Drive' }]);
    }
  };

  // Folder navigation
  const handleOpenFile = (file: DriveFile) => {
    if (isFolder(file)) {
      if (activeSection !== 'my-drive') {
        setActiveSection('my-drive');
      }
      setCurrentFolderId(file.id);
      setSelectedFileIds([]);
      setBreadcrumbs((prev) => [...prev, { id: file.id, name: file.name }]);
      setSubmittedSearch('');
      setSearchQuery('');
    } else {
      setPreviewFile(file);
    }
  };

  // Breadcrumb navigation
  const handleNavigateToBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    const newCrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newCrumbs);
    setCurrentFolderId(target.id);
    setSelectedFileIds([]);
    setSubmittedSearch('');
    setSearchQuery('');
  };

  const handleNavigateToParent = () => {
    if (breadcrumbs.length > 1) {
      handleNavigateToBreadcrumb(breadcrumbs.length - 2);
    }
  };

  // Search submission
  const handleSearchSubmit = () => {
    setSelectedFileIds([]);
    setSubmittedSearch(searchQuery);
  };

  const handleClearSearch = () => {
    setSelectedFileIds([]);
    setSearchQuery('');
    setSubmittedSearch('');
  };

  // Multi-select handlers
  const handleToggleSelectFile = (fileId: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  const handleSelectAll = () => {
    setSelectedFileIds(files.map((f) => f.id));
  };

  const handleClearSelection = () => {
    setSelectedFileIds([]);
  };

  // Bulk actions
  const handleBulkTrash = () => {
    if (selectedFileIds.length === 0) return;
    const selectedFiles = files.filter((f) => selectedFileIds.includes(f.id));
    setDestructiveConfig({
      isOpen: true,
      title: `Move ${selectedFiles.length} ${selectedFiles.length === 1 ? 'item' : 'items'} to trash?`,
      message: `The selected items will be moved to the Trash bin. You can restore them anytime before emptying trash.`,
      confirmLabel: `Move to Trash (${selectedFiles.length})`,
      fileIds: selectedFiles.map((f) => f.id),
      fileNames: selectedFiles.map((f) => f.name),
      isPermanent: false,
    });
  };

  const handleBulkPermanentDelete = () => {
    if (selectedFileIds.length === 0) return;
    const selectedFiles = files.filter((f) => selectedFileIds.includes(f.id));
    setDestructiveConfig({
      isOpen: true,
      title: `Permanently delete ${selectedFiles.length} ${selectedFiles.length === 1 ? 'item' : 'items'}?`,
      message: `The selected items will be deleted forever from Google Drive and cannot be restored.`,
      confirmLabel: `Delete Forever (${selectedFiles.length})`,
      fileIds: selectedFiles.map((f) => f.id),
      fileNames: selectedFiles.map((f) => f.name),
      isPermanent: true,
    });
  };

  const handleBulkRestore = async () => {
    if (!token || selectedFileIds.length === 0) return;
    const idsToRestore = [...selectedFileIds];
    try {
      await Promise.allSettled(
        idsToRestore.map((id) => updateDriveFile(token, id, { trashed: false }))
      );
      setFiles((prev) => prev.filter((f) => !idsToRestore.includes(f.id)));
      setSelectedFileIds([]);
      showToast(`Restored ${idsToRestore.length} ${idsToRestore.length === 1 ? 'item' : 'items'}`);
      fetchDriveAbout(token).then((res) => setAbout(res)).catch(() => {});
    } catch (err: unknown) {
      const error = err as Error;
      showToast(error.message || 'Failed to restore selected items', 'error');
    }
  };

  const handleBulkStar = async () => {
    if (!token || selectedFileIds.length === 0) return;
    const selectedFiles = files.filter((f) => selectedFileIds.includes(f.id));
    const allStarred = selectedFiles.every((f) => f.starred);
    const newStarred = !allStarred;

    // Optimistic update
    setFiles((prev) =>
      prev.map((f) =>
        selectedFileIds.includes(f.id) ? { ...f, starred: newStarred } : f
      )
    );

    try {
      await Promise.allSettled(
        selectedFileIds.map((id) => updateDriveFile(token, id, { starred: newStarred }))
      );
      showToast(
        newStarred
          ? `Starred ${selectedFileIds.length} item(s)`
          : `Removed star from ${selectedFileIds.length} item(s)`
      );
    } catch (err: unknown) {
      const error = err as Error;
      showToast(error.message || 'Failed to update stars', 'error');
    }
  };

  // Star / unstar toggle
  const handleToggleStar = async (file: DriveFile) => {
    if (!token) return;
    const newStarred = !file.starred;

    // Optimistic UI update
    setFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, starred: newStarred } : f))
    );
    if (previewFile && previewFile.id === file.id) {
      setPreviewFile({ ...previewFile, starred: newStarred });
    }

    try {
      await updateDriveFile(token, file.id, { starred: newStarred });
      showToast(newStarred ? `Starred "${file.name}"` : `Removed star from "${file.name}"`);
    } catch (err: unknown) {
      const error = err as Error;
      // Revert on failure
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, starred: !newStarred } : f))
      );
      showToast(error.message || 'Failed to update star', 'error');
    }
  };

  // Creation modal submission
  const handleCreateSubmit = async (name: string) => {
    if (!token) return;
    setIsCreateModalLoading(true);

    try {
      if (createModal.type === 'folder') {
        const newFolder = await createDriveFolder(token, name, currentFolderId);
        setFiles((prev) => [newFolder, ...prev]);
        showToast(`Created folder "${name}"`);
      } else if (createModal.type === 'document') {
        const newDoc = await createBlankGoogleDoc(
          token,
          name,
          'application/vnd.google-apps.document',
          currentFolderId
        );
        setFiles((prev) => [newDoc, ...prev]);
        showToast(`Created Google Doc "${name}"`);
      } else if (createModal.type === 'spreadsheet') {
        const newSheet = await createBlankGoogleDoc(
          token,
          name,
          'application/vnd.google-apps.spreadsheet',
          currentFolderId
        );
        setFiles((prev) => [newSheet, ...prev]);
        showToast(`Created Google Sheet "${name}"`);
      } else if (createModal.type === 'rename' && createModal.targetFileId) {
        const updated = await updateDriveFile(token, createModal.targetFileId, { name });
        setFiles((prev) =>
          prev.map((f) => (f.id === updated.id ? { ...f, name: updated.name } : f))
        );
        if (previewFile && previewFile.id === updated.id) {
          setPreviewFile({ ...previewFile, name: updated.name });
        }
        showToast(`Renamed to "${name}"`);
      }

      setCreateModal({ isOpen: false, type: 'folder' });
    } catch (err: unknown) {
      const error = err as Error;
      showToast(error.message || 'Operation failed', 'error');
    } finally {
      setIsCreateModalLoading(false);
    }
  };

  // File Upload
  const handleUploadFiles = async (uploadFilesList: File[]) => {
    if (!token) return;
    setIsUploading(true);

    try {
      for (const file of uploadFilesList) {
        const uploaded = await uploadFileToDrive(token, file, currentFolderId);
        setFiles((prev) => [uploaded, ...prev]);
      }
      showToast(`Uploaded ${uploadFilesList.length} file(s) successfully`);
      setIsUploadModalOpen(false);
      // Refresh storage about
      fetchDriveAbout(token).then((res) => setAbout(res)).catch(() => {});
    } catch (err: unknown) {
      const error = err as Error;
      showToast(error.message || 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Drag-and-drop file upload handlers for main content area
  const handleMainDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      setIsDraggingOverMain(true);
    }
  };

  const handleMainDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDraggingOverMain && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      setIsDraggingOverMain(true);
    }
  };

  const handleMainDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOverMain(false);
    }
  };

  const handleMainDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverMain(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      handleUploadFiles(droppedFiles);
    }
  };

  // Restore trashed file
  const handleRestoreFile = async (file: DriveFile) => {
    if (!token) return;
    try {
      await updateDriveFile(token, file.id, { trashed: false });
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      showToast(`Restored "${file.name}"`);
      // Update storage info
      fetchDriveAbout(token).then((res) => setAbout(res)).catch(() => {});
    } catch (err: unknown) {
      const error = err as Error;
      showToast(error.message || 'Failed to restore file', 'error');
    }
  };

  // Trigger Destructive Action confirmation modal (MANDATORY per Workspace guidelines)
  const handleInitiateDelete = (file: DriveFile) => {
    const isPermanent = activeSection === 'trash';
    setDestructiveConfig({
      isOpen: true,
      title: isPermanent ? 'Permanently delete item?' : 'Move item to trash?',
      message: isPermanent
        ? `"${file.name}" will be deleted forever and you won't be able to restore it.`
        : `"${file.name}" will be moved to the Trash bin. You can restore it anytime before emptying trash.`,
      confirmLabel: isPermanent ? 'Delete Forever' : 'Move to Trash',
      fileIds: [file.id],
      fileNames: [file.name],
      isPermanent,
    });
  };

  // Trigger Empty Trash confirmation modal
  const handleInitiateEmptyTrash = () => {
    setDestructiveConfig({
      isOpen: true,
      title: 'Empty trash bin?',
      message: 'All items currently in the trash bin will be permanently deleted. This action cannot be undone.',
      confirmLabel: 'Empty Trash',
      fileIds: [],
      fileNames: files.map((f) => f.name).slice(0, 5),
      isPermanent: true,
    });
  };

  // Execute Destructive Action after explicit user confirmation
  const handleConfirmDestructiveAction = async () => {
    if (!token) return;
    setIsDestructiveLoading(true);

    try {
      if (destructiveConfig.fileIds.length > 0) {
        const targetIds = destructiveConfig.fileIds;
        if (destructiveConfig.isPermanent) {
          await Promise.allSettled(
            targetIds.map((id) => deleteDriveFilePermanently(token, id))
          );
          showToast(
            targetIds.length === 1
              ? 'Permanently deleted item'
              : `Permanently deleted ${targetIds.length} items`
          );
        } else {
          await Promise.allSettled(
            targetIds.map((id) => updateDriveFile(token, id, { trashed: true }))
          );
          showToast(
            targetIds.length === 1
              ? 'Moved item to trash'
              : `Moved ${targetIds.length} items to trash`
          );
        }
        setFiles((prev) => prev.filter((f) => !targetIds.includes(f.id)));
        setSelectedFileIds((prev) => prev.filter((id) => !targetIds.includes(id)));
      } else {
        // Empty trash
        await emptyDriveTrash(token);
        setFiles([]);
        setSelectedFileIds([]);
        showToast('Trash bin emptied');
      }

      setDestructiveConfig((prev) => ({ ...prev, isOpen: false }));
      if (previewFile && destructiveConfig.fileIds.includes(previewFile.id)) {
        setPreviewFile(null);
      }
      fetchDriveAbout(token).then((res) => setAbout(res)).catch(() => {});
    } catch (err: unknown) {
      const error = err as Error;
      showToast(error.message || 'Failed to complete deletion', 'error');
    } finally {
      setIsDestructiveLoading(false);
    }
  };

  // Unauthenticated screen
  if (needsAuth || !token) {
    return (
      <AuthScreen
        onSignIn={handleSignIn}
        isLoading={isLoggingIn}
        errorMessage={authError}
      />
    );
  }

  const currentFolderName =
    breadcrumbs[breadcrumbs.length - 1]?.name || 'My Drive';

  return (
    <div id="drive-app-root" className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col text-zinc-900 dark:text-zinc-100">
      {/* App Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        onClearSearch={handleClearSearch}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        onRefresh={() => loadDriveData(token, true)}
        isRefreshing={isRefreshing}
        user={user}
        onSignOut={handleSignOut}
        onToggleOverseer={() => setIsOverseerOpen(!isOverseerOpen)}
        isOverseerOpen={isOverseerOpen}
        onOpenOrchestrator={() => setIsOrchestratorOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        freeRoamMode={autoDeploySettings.freeRoamMode}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeSection={activeSection}
          onSelectSection={handleSelectSection}
          onOpenCreateFolder={() =>
            setCreateModal({ isOpen: true, type: 'folder', initialValue: 'New folder' })
          }
          onOpenUpload={() => setIsUploadModalOpen(true)}
          onOpenCreateDoc={(type) =>
            setCreateModal({
              isOpen: true,
              type,
              initialValue: type === 'document' ? 'Untitled document' : 'Untitled spreadsheet',
            })
          }
          storageQuota={about?.storageQuota}
        />

        {/* Main Content Area with Drag & Drop */}
        <main
          id="drive-main-content"
          onDragEnter={handleMainDragEnter}
          onDragOver={handleMainDragOver}
          onDragLeave={handleMainDragLeave}
          onDrop={handleMainDrop}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 relative"
        >
          {/* Drag and Drop Visual Feedback Overlay */}
          {isDraggingOverMain && (
            <div
              id="main-drag-drop-overlay"
              className="absolute inset-0 z-50 bg-blue-600/10 dark:bg-blue-950/40 backdrop-blur-xs border-2 border-dashed border-blue-500 rounded-3xl m-2 flex flex-col items-center justify-center pointer-events-none transition-all animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-2xl border border-blue-200 dark:border-blue-800 flex flex-col items-center space-y-3 text-center max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center animate-bounce">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Drop files to upload
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Files will be uploaded directly to{' '}
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {breadcrumbs[breadcrumbs.length - 1]?.name || 'My Drive'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Breadcrumbs & Actions */}
          <Breadcrumbs
            activeSection={activeSection}
            breadcrumbs={breadcrumbs}
            onNavigateToBreadcrumb={handleNavigateToBreadcrumb}
            onNavigateToParent={handleNavigateToParent}
            onJumpToMyDrive={() => handleSelectSection('my-drive')}
            onDropOnFolder={(folderId, droppedFiles) => {
              if (droppedFiles.length > 0 && token) {
                setIsUploading(true);
                Promise.all(droppedFiles.map((f) => uploadFileToDrive(token, f, folderId)))
                  .then((uploadedList) => {
                    setFiles((prev) => [...uploadedList, ...prev]);
                    showToast(`Uploaded ${uploadedList.length} file(s) into folder`);
                    fetchDriveAbout(token).then(setAbout).catch(() => {});
                  })
                  .catch((err) => showToast(err.message || 'Upload failed', 'error'))
                  .finally(() => setIsUploading(false));
              }
            }}
            onEmptyTrash={handleInitiateEmptyTrash}
            trashCount={files.length}
          />

          {/* Active Search banner */}
          {submittedSearch && (
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 rounded-2xl text-xs text-blue-900 dark:text-blue-200">
              <span>
                Search results for: <strong className="font-semibold">"{submittedSearch}"</strong>
              </span>
              <button
                id="btn-clear-search-banner"
                onClick={handleClearSearch}
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Conditional View: Analytics vs Execution Analytics vs File Workspace */}
          {activeSection === 'execution-analytics' ? (
            <ExecutionAnalyticsTab
              onSelectWorkflow={() => {
                handleSelectSection('my-drive');
              }}
            />
          ) : activeSection === 'analytics' ? (
            <AnalyticsPanel
              storageQuota={about?.storageQuota}
              files={files}
              onFilterByType={(filter) => {
                handleSelectSection('my-drive');
                setCurrentFilter(filter);
              }}
              onJumpToMyDrive={() => handleSelectSection('my-drive')}
              onEmptyTrash={handleInitiateEmptyTrash}
            />
          ) : (
            <>
              {/* Filter Bar */}
              <FilterBar
                currentFilter={currentFilter}
                onSelectFilter={setCurrentFilter}
                orderBy={orderBy}
                onOrderByChange={setOrderBy}
                totalFiles={files.length}
              />

              {/* Global Error notice */}
              {errorMessage && (
                <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-2xl flex items-center space-x-3 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Files display: Loading vs Grid vs List */}
              {isLoadingFiles ? (
                <div className="py-24 flex flex-col items-center justify-center space-y-3 text-zinc-400">
                  <svg className="animate-spin h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-xs font-medium">Loading Google Drive files...</p>
                </div>
              ) : viewMode === 'grid' ? (
                <FileGrid
                  files={files}
                  activeSection={activeSection}
                  selectedFileIds={selectedFileIds}
                  onToggleSelectFile={handleToggleSelectFile}
                  onOpenFile={handleOpenFile}
                  onPreviewFile={setPreviewFile}
                  onToggleStar={handleToggleStar}
                  onRenameFile={(file) =>
                    setCreateModal({
                      isOpen: true,
                      type: 'rename',
                      initialValue: file.name,
                      targetFileId: file.id,
                    })
                  }
                  onDeleteFile={handleInitiateDelete}
                  onRestoreFile={handleRestoreFile}
                  onShowToast={showToast}
                  onSwipeAction={handleSwipeAction}
                  onOpenDiffFrameTester={handleOpenDiffFrameTester}
                />
              ) : (
                <FileList
                  files={files}
                  activeSection={activeSection}
                  selectedFileIds={selectedFileIds}
                  onToggleSelectFile={handleToggleSelectFile}
                  onSelectAll={handleSelectAll}
                  onClearSelection={handleClearSelection}
                  onOpenFile={handleOpenFile}
                  onPreviewFile={setPreviewFile}
                  onToggleStar={handleToggleStar}
                  onRenameFile={(file) =>
                    setCreateModal({
                      isOpen: true,
                      type: 'rename',
                      initialValue: file.name,
                      targetFileId: file.id,
                    })
                  }
                  onDeleteFile={handleInitiateDelete}
                  onRestoreFile={handleRestoreFile}
                  onShowToast={showToast}
                  onSwipeAction={handleSwipeAction}
                  onOpenDiffFrameTester={handleOpenDiffFrameTester}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      {/* 1. File Details / Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        activeSection={activeSection}
        onClose={() => setPreviewFile(null)}
        onToggleStar={handleToggleStar}
        onRename={(file) =>
          setCreateModal({
            isOpen: true,
            type: 'rename',
            initialValue: file.name,
            targetFileId: file.id,
          })
        }
        onDelete={handleInitiateDelete}
      />

      {/* 2. Create Folder / Doc / Sheet / Rename Modal */}
      <CreateItemModal
        isOpen={createModal.isOpen}
        type={createModal.type}
        initialValue={createModal.initialValue}
        isLoading={isCreateModalLoading}
        onClose={() => setCreateModal((prev) => ({ ...prev, isOpen: false }))}
        onSubmit={handleCreateSubmit}
      />

      {/* 3. Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        targetFolderName={currentFolderName}
        isLoading={isUploading}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadFiles={handleUploadFiles}
      />

      {/* 4. Destructive Confirmation Modal (MANDATORY per Workspace Skill) */}
      <ConfirmationModal
        config={destructiveConfig}
        isLoading={isDestructiveLoading}
        onConfirm={handleConfirmDestructiveAction}
        onCancel={() => setDestructiveConfig((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* 5. Bulk Action Floating Bar */}
      <BulkActionBar
        selectedCount={selectedFileIds.length}
        totalCount={files.length}
        activeSection={activeSection}
        allSelectedStarred={
          selectedFileIds.length > 0 &&
          selectedFileIds.every((id) => files.find((f) => f.id === id)?.starred)
        }
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onBulkTrash={handleBulkTrash}
        onBulkPermanentDelete={handleBulkPermanentDelete}
        onBulkRestore={handleBulkRestore}
        onBulkStar={handleBulkStar}
        isLoading={isDestructiveLoading}
      />

      {/* 6. Diff Frames & Movement Testbench Modal */}
      <DiffFramesTestModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        file={diffTestFile}
        targetCoords={{ x: 960, y: 540 }}
        onApplyRepositionedCoords={(newCoords) => {
          showToast(`Applied re-anchored target coordinates: (${newCoords.x}, ${newCoords.y})`);
        }}
      />

      {/* 7. Auto-Deploy & Orchestration Settings Modal */}
      <AutoDeploySettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={autoDeploySettings}
        onSaveSettings={(newSettings) => {
          handleUpdateAutoDeploySettings(newSettings);
          showToast('Updated Auto-Deploy and Autonomous Roam settings.');
        }}
      />

      {/* 8. Overseer AI Floating Monitor & Learning Ledger */}
      <OverseerAIPanel
        isOpen={isOverseerOpen}
        onClose={() => setIsOverseerOpen(false)}
        activeSection={activeSection}
        onSwitchSection={handleSelectSection}
        learnedNotes={learnedNotes}
        settings={autoDeploySettings}
        onUpdateSettings={handleUpdateAutoDeploySettings}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenWorkflowOrchestrator={() => setIsOrchestratorOpen(true)}
        onExecuteNudgeAction={handleExecuteNudgeAction}
      />

      {/* 9. Autonomous Workflow Orchestrator Modal */}
      <AutonomousWorkflowModal
        isOpen={isOrchestratorOpen}
        onClose={() => setIsOrchestratorOpen(false)}
        activeSection={activeSection}
        onSwitchSection={handleSelectSection}
        engine={autoDeployEngine}
        settings={autoDeploySettings}
        onUpdateSettings={handleUpdateAutoDeploySettings}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        files={files}
        onShowToast={showToast}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="app-toast-notification"
          className={`fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-medium animate-in fade-in slide-in-from-bottom-4 duration-200 ${
            toastMessage.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-white shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
}
