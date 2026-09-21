import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  HardDrive,
  FileText,
  Table,
  Presentation,
  FileCode,
  Image,
  Trash2,
  PieChart as PieChartIcon,
  CheckCircle2,
  Folder,
  ArrowRight,
} from 'lucide-react';
import { DriveFile, StorageQuota, FileFilter } from '../types/drive';
import { formatBytes } from '../utils/fileUtils';

interface AnalyticsPanelProps {
  storageQuota?: StorageQuota;
  files: DriveFile[];
  onFilterByType?: (filterType: FileFilter) => void;
  onJumpToMyDrive?: () => void;
  onEmptyTrash?: () => void;
}

interface CategoryStats {
  id: string;
  name: string;
  bytes: number;
  count: number;
  color: string;
  filterKey?: FileFilter;
  icon: React.ReactNode;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  storageQuota,
  files,
  onFilterByType,
  onJumpToMyDrive,
  onEmptyTrash,
}) => {
  // Parse storage quota
  const totalLimitBytes = storageQuota?.limit ? parseInt(storageQuota.limit, 10) : 0;
  const totalUsageBytes = storageQuota?.usage ? parseInt(storageQuota.usage, 10) : 0;
  const usageInDriveBytes = storageQuota?.usageInDrive ? parseInt(storageQuota.usageInDrive, 10) : 0;
  const usageInTrashBytes = storageQuota?.usageInDriveTrash ? parseInt(storageQuota.usageInDriveTrash, 10) : 0;

  const usagePercent = totalLimitBytes > 0
    ? Math.min(Math.round((totalUsageBytes / totalLimitBytes) * 100), 100)
    : 0;

  const remainingBytes = totalLimitBytes > 0 ? Math.max(0, totalLimitBytes - totalUsageBytes) : 0;

  // Aggregate files by MIME category
  const breakdown = useMemo(() => {
    let docsBytes = 0;
    let docsCount = 0;

    let sheetsBytes = 0;
    let sheetsCount = 0;

    let presBytes = 0;
    let presCount = 0;

    let pdfBytes = 0;
    let pdfCount = 0;

    let mediaBytes = 0;
    let mediaCount = 0;

    let othersBytes = 0;
    let othersCount = 0;

    let foldersCount = 0;

    files.forEach((file) => {
      const size = file.size ? parseInt(file.size, 10) : 0;
      const mime = (file.mimeType || '').toLowerCase();

      if (mime === 'application/vnd.google-apps.folder') {
        foldersCount++;
        return;
      }

      if (
        mime.includes('document') ||
        mime.includes('word') ||
        mime.includes('text/plain') ||
        mime.includes('markdown') ||
        mime.includes('rtf')
      ) {
        docsBytes += size;
        docsCount++;
      } else if (
        mime.includes('spreadsheet') ||
        mime.includes('excel') ||
        mime.includes('csv') ||
        mime.includes('sheet')
      ) {
        sheetsBytes += size;
        sheetsCount++;
      } else if (
        mime.includes('presentation') ||
        mime.includes('powerpoint') ||
        mime.includes('slides')
      ) {
        presBytes += size;
        presCount++;
      } else if (mime.includes('pdf')) {
        pdfBytes += size;
        pdfCount++;
      } else if (
        mime.startsWith('image/') ||
        mime.startsWith('video/') ||
        mime.startsWith('audio/')
      ) {
        mediaBytes += size;
        mediaCount++;
      } else {
        othersBytes += size;
        othersCount++;
      }
    });

    // Account for Google Drive reported usage vs individual files loaded
    const sumCalculatedFiles = docsBytes + sheetsBytes + presBytes + pdfBytes + mediaBytes + othersBytes;
    const unexplainedDriveUsage = Math.max(0, usageInDriveBytes - sumCalculatedFiles);
    const finalOthersBytes = othersBytes + unexplainedDriveUsage;

    const categories: CategoryStats[] = [
      {
        id: 'documents',
        name: 'Documents',
        bytes: docsBytes,
        count: docsCount,
        color: '#3b82f6',
        filterKey: 'documents',
        icon: <FileText className="w-4 h-4 text-blue-500" />,
      },
      {
        id: 'spreadsheets',
        name: 'Spreadsheets',
        bytes: sheetsBytes,
        count: sheetsCount,
        color: '#10b981',
        filterKey: 'spreadsheets',
        icon: <Table className="w-4 h-4 text-emerald-500" />,
      },
      {
        id: 'presentations',
        name: 'Presentations',
        bytes: presBytes,
        count: presCount,
        color: '#f59e0b',
        filterKey: 'presentations',
        icon: <Presentation className="w-4 h-4 text-amber-500" />,
      },
      {
        id: 'pdfs',
        name: 'PDF Files',
        bytes: pdfBytes,
        count: pdfCount,
        color: '#ef4444',
        filterKey: 'pdfs',
        icon: <FileCode className="w-4 h-4 text-red-500" />,
      },
      {
        id: 'media',
        name: 'Media & Images',
        bytes: mediaBytes,
        count: mediaCount,
        color: '#8b5cf6',
        filterKey: 'media',
        icon: <Image className="w-4 h-4 text-purple-500" />,
      },
      {
        id: 'trash',
        name: 'Trash (Bin)',
        bytes: usageInTrashBytes,
        count: files.filter((f) => f.trashed).length,
        color: '#f43f5e',
        icon: <Trash2 className="w-4 h-4 text-rose-500" />,
      },
      {
        id: 'others',
        name: 'Others / System',
        bytes: finalOthersBytes,
        count: othersCount,
        color: '#64748b',
        filterKey: 'all',
        icon: <HardDrive className="w-4 h-4 text-slate-500" />,
      },
    ];

    // Filter out categories with 0 bytes and 0 count if total is positive
    const effectiveCategories = categories.filter((c) => c.bytes > 0 || c.count > 0);

    // If everything is 0 (brand new account or no quota used), provide at least one slice for chart
    const chartData = (effectiveCategories.length > 0
      ? effectiveCategories
      : [{ id: 'empty', name: 'Free Storage', bytes: totalLimitBytes || 1024 * 1024, count: 0, color: '#3b82f6', icon: <HardDrive className="w-4 h-4" /> }]
    ).map((c) => ({
      name: c.name,
      value: Math.max(c.bytes, 1),
      rawBytes: c.bytes,
      count: c.count,
      color: c.color,
      id: c.id,
    }));

    return {
      categories,
      effectiveCategories,
      chartData,
      foldersCount,
      totalFilesCount: files.filter((f) => f.mimeType !== 'application/vnd.google-apps.folder').length,
    };
  }, [files, usageInDriveBytes, usageInTrashBytes, totalLimitBytes]);

  const totalCalculatedUsage = Math.max(
    totalUsageBytes,
    breakdown.categories.reduce((acc, c) => acc + c.bytes, 0)
  );

  return (
    <div id="storage-analytics-panel" className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-zinc-800/80 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <PieChartIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Storage & Disk Usage Analytics
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Disk space distribution parsed from Google Drive storage quota & file registry
            </p>
          </div>
        </div>

        {onJumpToMyDrive && (
          <button
            id="btn-analytics-back-my-drive"
            onClick={onJumpToMyDrive}
            className="flex items-center space-x-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors self-start sm:self-auto"
          >
            <span>Back to My Drive</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Usage Card */}
        <div className="bg-white dark:bg-zinc-800/80 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <span>Used Storage</span>
            <span className="font-mono text-zinc-800 dark:text-zinc-200 font-bold">{usagePercent}%</span>
          </div>
          <div className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 font-mono">
            {formatBytes(totalUsageBytes)}
          </div>
          <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                usagePercent > 90 ? 'bg-red-500' : usagePercent > 75 ? 'bg-amber-500' : 'bg-blue-600'
              }`}
              style={{ width: `${Math.max(usagePercent, 2)}%` }}
            />
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            of {totalLimitBytes > 0 ? formatBytes(totalLimitBytes) : 'Unlimited'} account quota
          </p>
        </div>

        {/* Free Space Card */}
        <div className="bg-white dark:bg-zinc-800/80 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <span>Free Space</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {totalLimitBytes > 0 ? formatBytes(remainingBytes) : 'Unlimited'}
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {totalLimitBytes > 0 ? `${100 - usagePercent}% available for new files` : 'No storage quota limit imposed'}
          </p>
        </div>

        {/* In Drive vs Trash */}
        <div className="bg-white dark:bg-zinc-800/80 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <span>In Drive</span>
            <HardDrive className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
            {formatBytes(usageInDriveBytes || totalUsageBytes)}
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {breakdown.totalFilesCount} active files in {breakdown.foldersCount} folders
          </p>
        </div>

        {/* Trash Quota */}
        <div className="bg-white dark:bg-zinc-800/80 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <span>Trash (Bin)</span>
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
            {formatBytes(usageInTrashBytes)}
          </div>
          {usageInTrashBytes > 0 && onEmptyTrash ? (
            <button
              onClick={onEmptyTrash}
              className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-medium"
            >
              Empty trash to reclaim space
            </button>
          ) : (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Trash is clean or empty
            </p>
          )}
        </div>
      </div>

      {/* Main Chart and Breakdown Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pie Chart Card */}
        <div className="lg:col-span-6 bg-white dark:bg-zinc-800/80 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
              Disk Usage by File Type
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Visual proportion of occupied disk space categorized by MIME format
            </p>
          </div>

          <div className="w-full h-72 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdown.chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {breakdown.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any, item: any) => [
                    `${formatBytes(item.payload.rawBytes || Number(value))} (${item.payload.count || 0} files)`,
                    name,
                  ]}
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderRadius: '0.75rem',
                    border: '1px solid #27272a',
                    color: '#f4f4f5',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value: string) => (
                    <span className="text-xs text-zinc-700 dark:text-zinc-300 mr-2">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Hover over chart segments to inspect detailed byte allocations
          </div>
        </div>

        {/* Detailed Breakdown List Card */}
        <div className="lg:col-span-6 bg-white dark:bg-zinc-800/80 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
              Category Distribution
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Breakdown of files, aggregate size, and share of occupied quota
            </p>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
              {breakdown.categories.map((cat) => {
                const catPercent = totalCalculatedUsage > 0
                  ? Math.round((cat.bytes / totalCalculatedUsage) * 100)
                  : 0;

                return (
                  <div
                    key={cat.id}
                    className="py-3 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-700/30 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${cat.color}15` }}
                      >
                        {cat.icon}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                            {cat.name}
                          </span>
                          {cat.filterKey && onFilterByType && (
                            <button
                              onClick={() => onFilterByType(cat.filterKey!)}
                              className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              Filter
                            </button>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          {cat.count} file{cat.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {formatBytes(cat.bytes)}
                      </div>
                      <div className="flex items-center justify-end space-x-1.5">
                        <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(catPercent, 2)}%`,
                              backgroundColor: cat.color,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400">{catPercent}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Folders Note */}
          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-700/50 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center space-x-1.5">
              <Folder className="w-4 h-4 text-amber-500" />
              <span>Drive Directories: {breakdown.foldersCount} folders</span>
            </span>
            <span>Real-time quota sync</span>
          </div>
        </div>
      </div>
    </div>
  );
};
