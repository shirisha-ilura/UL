import React from 'react';
import { ArrowLeft, User, Calendar, Mail, Reply } from 'lucide-react';

const EmailDetail = ({ email, onBack }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatEmailAddress = (address) => {
    if (!address) return 'Unknown';
    // Extract name from "Name <email@domain.com>" format
    const match = address.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      return { name: match[1].trim(), email: match[2].trim() };
    }
    return { name: address, email: address };
  };

  const renderEmailContent = (content) => {
    if (!content) return <p className="text-gray-500 italic">No content available</p>;
    
    // Simple HTML sanitization and rendering
    const sanitizedContent = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    return (
      <div 
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      />
    );
  };

  const fromInfo = formatEmailAddress(email.from);
  const toInfo = formatEmailAddress(email.to);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to emails
        </button>
      </div>

      {/* Email Header */}
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {email.subject || 'No Subject'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start">
              <User className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">From</p>
                <p className="text-sm text-gray-600">{fromInfo.name}</p>
                <p className="text-xs text-gray-500">{fromInfo.email}</p>
              </div>
            </div>

            <div className="flex items-start">
              <Mail className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">To</p>
                <p className="text-sm text-gray-600">{toInfo.name}</p>
                <p className="text-xs text-gray-500">{toInfo.email}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <Calendar className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">Date</p>
              <p className="text-sm text-gray-600">
                {formatDate(email.internalDate || email.date)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Email Content */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="prose prose-sm max-w-none">
          {email.body ? (
            renderEmailContent(email.body)
          ) : email.snippet ? (
            <div>
              <p className="text-gray-700 whitespace-pre-wrap">{email.snippet}</p>
              <p className="text-gray-500 text-sm mt-4 italic">
                Full content not available. This is a preview snippet.
              </p>
            </div>
          ) : (
            <p className="text-gray-500 italic">No content available</p>
          )}
        </div>
      </div>

      {/* Email Metadata */}
      {email.labels && email.labels.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Labels</h4>
          <div className="flex flex-wrap gap-2">
            {email.labels.map((label, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <button className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors">
          <Reply className="w-4 h-4 mr-2" />
          Reply
        </button>
      </div>
    </div>
  );
};

export default EmailDetail; 