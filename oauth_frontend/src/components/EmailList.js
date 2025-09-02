import React from 'react';
import { Mail, Calendar, User, ArrowRight, Loader2 } from 'lucide-react';

const EmailList = ({ emails, onEmailClick, isLoading }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-google-blue" />
        <span className="ml-3 text-gray-600">Loading emails...</span>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="text-center py-12">
        <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No emails loaded</h3>
        <p className="text-gray-500">
          Click "Load Emails" to fetch your latest emails from Gmail
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Latest Emails ({emails.length})
        </h3>
      </div>
      
      <div className="space-y-3">
        {emails.map((email, index) => (
          <div
            key={email.id || index}
            onClick={() => onEmailClick(email.id)}
            className="bg-gray-50 hover:bg-gray-100 rounded-lg p-4 cursor-pointer transition-colors border border-gray-200"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center mb-2">
                  <User className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {email.from || 'Unknown Sender'}
                  </span>
                </div>
                
                <h4 className="text-base font-semibold text-gray-900 mb-1 truncate">
                  {email.subject || 'No Subject'}
                </h4>
                
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                  {truncateText(email.snippet || 'No preview available')}
                </p>
                
                <div className="flex items-center text-xs text-gray-500">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span>{formatDate(email.internalDate || email.date)}</span>
                </div>
              </div>
              
              <ArrowRight className="w-5 h-5 text-gray-400 ml-3 flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmailList; 