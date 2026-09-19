import React from 'react';
import { HardDrive, ShieldCheck, FolderGit2, Search } from 'lucide-react';

interface AuthScreenProps {
  onSignIn: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onSignIn,
  isLoading,
  errorMessage,
}) => {
  return (
    <div
      id="auth-screen-container"
      className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 flex flex-col justify-center items-center px-4 py-12"
    >
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl p-8 space-y-8 text-center">
        {/* Logo / Brand Header */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center shadow-xs">
            {/* Google Drive brand colored mark */}
            <svg className="w-9 h-9" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
              <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
              <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
              <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.25z" fill="#00832d"/>
              <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
              <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Drive Workspace
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Connect your Google Drive account to explore, search, upload, and organize files.
            </p>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 gap-2.5 text-left bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center space-x-3 text-sm text-zinc-700 dark:text-zinc-300">
            <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>Browse folders, files &amp; storage usage</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-zinc-700 dark:text-zinc-300">
            <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Search documents, spreadsheets &amp; media</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-zinc-700 dark:text-zinc-300">
            <FolderGit2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Upload files, create folders &amp; documents</span>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-300 text-left">
            {errorMessage}
          </div>
        )}

        {/* Official Sign in with Google Button as required by skill */}
        <div className="flex flex-col items-center space-y-4">
          <button
            id="btn-google-sign-in"
            type="button"
            onClick={onSignIn}
            disabled={isLoading}
            className="w-full relative inline-flex items-center justify-center p-0.5 mb-2 overflow-hidden text-sm font-medium rounded-xl group bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg focus:outline-hidden focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-full flex items-center justify-center space-x-3 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-100 py-3 px-5 rounded-[10px] transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
              <span className="font-semibold text-sm">
                {isLoading ? 'Connecting to Google...' : 'Sign in with Google'}
              </span>
            </div>
          </button>

          <div className="flex items-center space-x-1.5 text-xs text-zinc-400 dark:text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Tokens are held securely in memory only</span>
          </div>
        </div>
      </div>
    </div>
  );
};
