import React from 'react';
import { Folder, File, Loader2, Calendar, HardDrive } from 'lucide-react';

const DriveList = ({ files, onFileClick, isLoading }) => {
  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getFileIcon = (mimeType) => {
    if (mimeType.includes('folder')) return <Folder className="w-5 h-5 text-blue-500" />;
    if (mimeType.includes('pdf')) return <File className="w-5 h-5 text-red-500" />;
    if (mimeType.includes('image')) return <File className="w-5 h-5 text-green-500" />;
    if (mimeType.includes('video')) return <File className="w-5 h-5 text-purple-500" />;
    if (mimeType.includes('document') || mimeType.includes('word')) return <File className="w-5 h-5 text-blue-600" />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <File className="w-5 h-5 text-green-600" />;
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return <File className="w-5 h-5 text-orange-500" />;
    return <File className="w-5 h-5 text-gray-500" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <span className="ml-3 text-gray-600">Loading files...</span>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
        <p className="text-gray-600">Click "Load Files" to fetch your recent Google Drive files.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {files.map((file) => (
        <div
          key={file.id}
          onClick={() => onFileClick(file.id)}
          className="flex items-center p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
        >
          <div className="flex-shrink-0 mr-4">
            {getFileIcon(file.mimeType)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {file.name}
                </h4>
                <div className="flex items-center mt-1 text-xs text-gray-500">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span>{formatDate(file.modifiedTime)}</span>
                  {file.size && (
                    <>
                      <span className="mx-2">•</span>
                      <HardDrive className="w-3 h-3 mr-1" />
                      <span>{formatFileSize(parseInt(file.size))}</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex-shrink-0 ml-4">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {file.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DriveList; 