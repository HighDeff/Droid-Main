import React from 'react';
import {
  Folder,
  FileText,
  Table,
  Presentation,
  FileCode,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  File,
} from 'lucide-react';
import { getFileCategory } from '../utils/fileUtils';

interface FileIconProps {
  mimeType: string;
  className?: string;
  customIconLink?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({ mimeType, className = 'w-5 h-5', customIconLink }) => {
  const category = getFileCategory(mimeType);

  switch (category.iconType) {
    case 'folder':
      return <Folder className={`${className} ${category.color} fill-amber-500/20`} />;
    case 'doc':
      return <FileText className={`${className} ${category.color}`} />;
    case 'sheet':
      return <Table className={`${className} ${category.color}`} />;
    case 'slide':
      return <Presentation className={`${className} ${category.color}`} />;
    case 'pdf':
      return <FileText className={`${className} ${category.color}`} />;
    case 'image':
      return <ImageIcon className={`${className} ${category.color}`} />;
    case 'video':
      return <Video className={`${className} ${category.color}`} />;
    case 'audio':
      return <Music className={`${className} ${category.color}`} />;
    case 'archive':
      return <Archive className={`${className} ${category.color}`} />;
    case 'code':
      return <FileCode className={`${className} ${category.color}`} />;
    default:
      if (customIconLink) {
        return (
          <img
            src={customIconLink}
            alt=""
            className={`${className} object-contain`}
            referrerPolicy="no-referrer"
          />
        );
      }
      return <File className={`${className} ${category.color}`} />;
  }
};
