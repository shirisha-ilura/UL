import React from 'react';
import { ArrowLeft, ExternalLink, Calendar, HardDrive, File, Folder } from 'lucide-react';

const DriveDetail = ({ file, onBack }) => {
  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getFileIcon = (mimeType) => {
    if (mimeType.includes('folder')) return <Folder className="w-8 h-8 text-blue-500" />;
    if (mimeType.includes('pdf')) return <File className="w-8 h-8 text-red-500" />;
    if (mimeType.includes('image')) return <File className="w-8 h-8 text-green-500" />;
    if (mimeType.includes('video')) return <File className="w-8 h-8 text-purple-500" />;
    if (mimeType.includes('document') || mimeType.includes('word')) return <File className="w-8 h-8 text-blue-600" />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <File className="w-8 h-8 text-green-600" />;
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return <File className="w-8 h-8 text-orange-500" />;
    return <File className="w-8 h-8 text-gray-500" />;
  };

  if (!file || !file.file) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">File details not available</p>
        <button
          onClick={onBack}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          ← Back to files
        </button>
      </div>
    );
  }

  const fileData = file.file;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-800 mr-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to files
        </button>
      </div>

      {/* File Info */}
      <div className="bg-gray-50 rounded-lg p-6 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0 mr-4">
            {getFileIcon(fileData.mimeType)}
          </div>
          
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {fileData.name}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                <span>Modified: {formatDate(fileData.modifiedTime)}</span>
              </div>
              
              {fileData.size && (
                <div className="flex items-center">
                  <HardDrive className="w-4 h-4 mr-2" />
                  <span>Size: {formatFileSize(parseInt(fileData.size))}</span>
                </div>
              )}
              
              <div className="flex items-center">
                <File className="w-4 h-4 mr-2" />
                <span>Type: {fileData.mimeType}</span>
              </div>
              
              <div className="flex items-center">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                  {fileData.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-4">
        {fileData.webViewLink && (
          <a
            href={fileData.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-4 py-2 bg-google-blue text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in Google Drive
          </a>
        )}
      </div>

      {/* Description */}
      {fileData.description && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Description</h3>
          <p className="text-gray-600 bg-white p-4 rounded-lg border">
            {fileData.description}
          </p>
        </div>
      )}

      {/* Thumbnail */}
      {fileData.thumbnailLink && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Preview</h3>
          <div className="bg-white p-4 rounded-lg border">
            <img
              src={fileData.thumbnailLink}
              alt={fileData.name}
              className="max-w-full h-auto rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DriveDetail; 