export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  starred?: boolean;
  trashed?: boolean;
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  parents?: string[];
  owners?: Array<{
    displayName?: string;
    emailAddress?: string;
    photoLink?: string;
    me?: boolean;
  }>;
  shared?: boolean;
}

export interface StorageQuota {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
  usageInDriveTrash?: string;
}

export interface DriveAboutUser {
  displayName?: string;
  emailAddress?: string;
  photoLink?: string;
}

export interface DriveAbout {
  user?: DriveAboutUser;
  storageQuota?: StorageQuota;
}

export type ViewMode = 'grid' | 'list';

export type ActiveSection = 'my-drive' | 'starred' | 'trash' | 'analytics' | 'execution-analytics';

export type FileFilter = 'all' | 'folders' | 'documents' | 'spreadsheets' | 'presentations' | 'pdfs' | 'media';

export interface BreadcrumbItem {
  id: string;
  name: string;
}

export interface DestructiveActionConfig {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  fileIds: string[];
  fileNames: string[];
  isPermanent: boolean;
}
