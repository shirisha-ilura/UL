import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Mail, ExternalLink, Loader2, CheckCircle, AlertCircle, RefreshCw, 
  Folder, MessageSquare, Ticket, Settings, Users, Calendar 
} from 'lucide-react';

const API_BASE_URL = 'http://127.0.0.1:8081';

const PROVIDERS = {
  google: {
    name: 'Google',
    icon: Mail,
    color: 'blue',
    bgColor: 'bg-blue-500',
    hoverColor: 'hover:bg-blue-600',
    services: ['Gmail', 'Drive', 'Calendar']
  },
  slack: {
    name: 'Slack',
    icon: MessageSquare,
    color: 'purple',
    bgColor: 'bg-purple-500',
    hoverColor: 'hover:bg-purple-600',
    services: ['Channels', 'Messages', 'Users']
  },
  jira: {
    name: 'Jira',
    icon: Ticket,
    color: 'indigo',
    bgColor: 'bg-indigo-500',
    hoverColor: 'hover:bg-indigo-600',
    services: ['All Issues', 'Projects', 'Boards']
  }
};

function App() {
  const [connectedProviders, setConnectedProviders] = useState({});
  const [isLoading, setIsLoading] = useState({});
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [activeProvider, setActiveProvider] = useState('google');
  const [data, setData] = useState({
    google: { emails: [], driveFiles: [], events: [] },
    slack: { channels: [], messages: [], users: [] },
    jira: { issues: [], projects: [], boards: [] }
  });
  const [selectedItem, setSelectedItem] = useState(null);
  const [error, setError] = useState('');
  const [activeService, setActiveService] = useState({
    google: 'gmail',
    slack: 'channels',
    jira: 'allissues'
  });

  // Check authentication status for all providers
  const checkAuthStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/users`);
      const users = response.data.users || [];
      
      const connected = {};
      users.forEach(user => {
        // Determine provider based on stored provider field
        if (user.email) {
          // For backward compatibility, check if there's provider info
          const provider = user.provider || 'google'; // Default to google for legacy data
          
          if (provider === 'google') {
            connected.google = { email: user.email, expires_at: user.expires_at };
          } else if (provider === 'atlassian') {
            connected.jira = { email: user.email, expires_at: user.expires_at };
          } else if (provider === 'slack') {
            connected.slack = { email: user.email, expires_at: user.expires_at };
          }
        }
      });
      
      setConnectedProviders(connected);
      return connected;
    } catch (error) {
      console.log('No authenticated users found');
      return {};
    }
  };

  // Handle OAuth for any provider
  const handleProviderAuth = async (provider) => {
    setIsLoading(prev => ({ ...prev, [provider]: true }));
    setIsAuthenticating(true);
    setAuthMessage(`Connecting to ${PROVIDERS[provider].name}...`);
    setError('');
    
    try {
      if (provider === 'google') {
        // Direct redirect for Google (legacy endpoint)
        window.location.href = `${API_BASE_URL}/auth/google`;
      } else {
        // Map frontend provider names to backend provider names
        const providerMapping = {
          'jira': 'atlassian',  // Jira uses Atlassian OAuth
          'slack': 'slack',
          'microsoft': 'microsoft'
        };
        
        const backendProvider = providerMapping[provider] || provider;
        
        // For other providers, get the auth URL first then redirect
        const response = await axios.get(`${API_BASE_URL}/api/v1/auth/${backendProvider}`);
        if (response.data.auth_url) {
          window.location.href = response.data.auth_url;
        } else {
          throw new Error('No auth URL received from server');
        }
      }
    } catch (error) {
      console.error('OAuth error:', error);
      let errorMessage = error.message;
      if (error.response && error.response.data && error.response.data.detail) {
        errorMessage = error.response.data.detail;
      }
      setError(`Failed to initiate ${PROVIDERS[provider].name} OAuth: ${errorMessage}`);
      setIsLoading(prev => ({ ...prev, [provider]: false }));
      setIsAuthenticating(false);
      setAuthMessage('');
    }
  };

  // Disconnect a provider
  const handleDisconnect = async (provider) => {
    setIsLoading(prev => ({ ...prev, [provider]: true }));
    setError('');
    
    try {
      await axios.post(`${API_BASE_URL}/auth/clear-tokens`);
      setConnectedProviders(prev => {
        const updated = { ...prev };
        delete updated[provider];
        return updated;
      });
      setData(prev => ({
        ...prev,
        [provider]: provider === 'google' 
          ? { emails: [], driveFiles: [], events: [] }
          : provider === 'slack'
          ? { channels: [], messages: [], users: [] }
          : { issues: [], projects: [], boards: [] }
      }));
    } catch (error) {
      setError(`Failed to disconnect ${PROVIDERS[provider].name}`);
    } finally {
      setIsLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  // Fetch data for Google services
  const fetchGoogleData = async (service) => {
    if (!connectedProviders.google) return;
    
    setIsLoading(prev => ({ ...prev, [`google_${service}`]: true }));
    setError('');
    
    try {
      const userEmail = connectedProviders.google.email;
      let response;
      
      switch (service) {
        case 'gmail':
          response = await axios.get(`${API_BASE_URL}/google/emails`, {
            params: { user_email: userEmail, max_results: 10 }
          });
          setData(prev => ({
            ...prev,
            google: { ...prev.google, emails: response.data.data?.emails || [] }
          }));
          break;
        case 'drive':
          response = await axios.get(`${API_BASE_URL}/google/drive/files`, {
            params: { user_email: userEmail, max_results: 10 }
          });
          setData(prev => ({
            ...prev,
            google: { ...prev.google, driveFiles: response.data.files || [] }
          }));
          break;
        case 'calendar':
          // Use the new API endpoint for calendar
          response = await axios.get(`${API_BASE_URL}/api/v1/google/calendar/events`, {
            params: { user_email: userEmail, max_results: 10 }
          });
          setData(prev => ({
            ...prev,
            google: { ...prev.google, events: response.data.events || [] }
          }));
          break;
      }
    } catch (error) {
      setError(`Failed to fetch ${service} data`);
      console.error(`Error fetching ${service}:`, error);
    } finally {
      setIsLoading(prev => ({ ...prev, [`google_${service}`]: false }));
    }
  };

  // Fetch data for Slack services
  const fetchSlackData = async (service) => {
    if (!connectedProviders.slack) return;
    
    setIsLoading(prev => ({ ...prev, [`slack_${service}`]: true }));
    setError('');
    
    try {
      const userEmail = connectedProviders.slack.email;
      let response;
      
      switch (service) {
        case 'channels':
          response = await axios.get(`${API_BASE_URL}/api/v1/slack/channels`, {
            params: { user_email: userEmail }
          });
          setData(prev => ({
            ...prev,
            slack: { ...prev.slack, channels: response.data.channels || [] }
          }));
          break;
        case 'messages':
          response = await axios.get(`${API_BASE_URL}/api/v1/slack/messages`, {
            params: { user_email: userEmail, max_results: 10 }
          });
          setData(prev => ({
            ...prev,
            slack: { ...prev.slack, messages: response.data.messages || [] }
          }));
          break;
        case 'users':
          response = await axios.get(`${API_BASE_URL}/api/v1/slack/users`, {
            params: { user_email: userEmail }
          });
          setData(prev => ({
            ...prev,
            slack: { ...prev.slack, users: response.data.users || [] }
          }));
          break;
      }
    } catch (error) {
      setError(`Failed to fetch Slack ${service}`);
      console.error(`Error fetching Slack ${service}:`, error);
    } finally {
      setIsLoading(prev => ({ ...prev, [`slack_${service}`]: false }));
    }
  };

  // Fetch data for Jira services  
  const fetchJiraData = async (service) => {
    if (!connectedProviders.jira) return;
    
    setIsLoading(prev => ({ ...prev, [`jira_${service}`]: true }));
    setError('');
    
    try {
      const userEmail = connectedProviders.jira.email;
      let response;
      
      switch (service) {
        case 'allissues':
          response = await axios.get(`${API_BASE_URL}/api/v1/atlassian/jira/issues`, {
            params: { user_email: userEmail, max_results: 10 }
          });
          setData(prev => ({
            ...prev,
            jira: { ...prev.jira, issues: response.data.issues || [] }
          }));
          break;
        case 'projects':
          response = await axios.get(`${API_BASE_URL}/api/v1/atlassian/jira/projects`, {
            params: { user_email: userEmail }
          });
          setData(prev => ({
            ...prev,
            jira: { ...prev.jira, projects: response.data.projects || [] }
          }));
          break;
        case 'boards':
          response = await axios.get(`${API_BASE_URL}/api/v1/atlassian/jira/boards`, {
            params: { user_email: userEmail }
          });
          
          // Handle boards response - check if it's an error about re-authentication
          if (response.data.success === false && response.data.requires_reauth) {
            setError(response.data.error || 'Boards access requires re-authentication');
            setData(prev => ({
              ...prev,
              jira: { ...prev.jira, boards: [] }
            }));
          } else {
            setData(prev => ({
              ...prev,
              jira: { ...prev.jira, boards: response.data.boards || [] }
            }));
          }
          break;
      }
    } catch (error) {
      setError(`Failed to fetch Jira ${service}`);
      console.error(`Error fetching Jira ${service}:`, error);
    } finally {
      setIsLoading(prev => ({ ...prev, [`jira_${service}`]: false }));
    }
  };

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const provider = urlParams.get('provider') || 'google'; // Default to google for backward compatibility
    
    if (authStatus === 'success') {
      // OAuth callback successful
      setError('');
      setIsAuthenticating(false);
      setAuthMessage('✅ Authentication successful! Loading your data...');
      console.log('Authentication successful');
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Check auth status and auto-fetch data
      setTimeout(async () => {
        const connected = await checkAuthStatus();
        if (Object.keys(connected).length > 0) {
          console.log('User authenticated, fetching data...');
          setAuthMessage('');
          // Auto-fetch data for the first service of the authenticated provider
          if (connected.google) {
            setTimeout(() => fetchGoogleData('gmail'), 1000);
          } else if (connected.jira) {
            setTimeout(() => fetchJiraData('allissues'), 1000);
          } else if (connected.slack) {
            setTimeout(() => fetchSlackData('channels'), 1000);
          }
        }
      }, 1000);
      
    } else if (authStatus === 'error') {
      // OAuth callback failed
      setError('❌ Authentication failed. Please try again.');
      setIsAuthenticating(false);
      setAuthMessage('');
      console.log('Authentication failed');
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
    } else if (code && state) {
      // Handle legacy callback format (should be redirected by server now)
      console.log('Legacy OAuth callback detected');
      
      // Check auth status after a delay
      setTimeout(async () => {
        const connected = await checkAuthStatus();
        if (Object.keys(connected).length > 0) {
          console.log('Authentication successful via legacy callback');
          // Auto-fetch data for the first service of the authenticated provider
          if (connected.google) {
            setTimeout(() => fetchGoogleData('gmail'), 1000);
          } else if (connected.jira) {
            setTimeout(() => fetchJiraData('allissues'), 1000);
          } else if (connected.slack) {
            setTimeout(() => fetchSlackData('channels'), 1000);
          }
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 2000);
      
    } else {
      // Normal page load
      checkAuthStatus();
    }
  }, []);

  // Render provider card
  const renderProviderCard = (providerId) => {
    const provider = PROVIDERS[providerId];
    const isConnected = !!connectedProviders[providerId];
    const IconComponent = provider.icon;
    
    return (
      <div key={providerId} className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <IconComponent className={`w-8 h-8 text-${provider.color}-500 mr-3`} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{provider.name}</h3>
              <p className="text-sm text-gray-500">
                {provider.services.join(', ')}
              </p>
            </div>
          </div>
          <div className="flex items-center">
            {isConnected ? (
              <CheckCircle className="w-6 h-6 text-green-500" />
            ) : (
              <Settings className="w-6 h-6 text-gray-400" />
            )}
          </div>
        </div>
        
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Connected: {connectedProviders[providerId].email}
              </span>
              <button
                onClick={() => handleDisconnect(providerId)}
                disabled={isLoading[providerId]}
                className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
            <button
              onClick={() => setActiveProvider(providerId)}
              className={`w-full py-2 px-4 rounded-md text-white font-medium ${provider.bgColor} ${provider.hoverColor} transition-colors`}
            >
              Access {provider.name}
            </button>
          </div>
        ) : (
          <button
            onClick={() => handleProviderAuth(providerId)}
            disabled={isLoading[providerId]}
            className={`w-full flex items-center justify-center py-2 px-4 rounded-md text-white font-medium ${provider.bgColor} ${provider.hoverColor} disabled:opacity-50 transition-colors`}
          >
            {isLoading[providerId] ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ExternalLink className="w-4 h-4 mr-2" />
            )}
            {isLoading[providerId] ? 'Connecting...' : `Configure ${provider.name}`}
          </button>
        )}
      </div>
    );
  };

  // Render service data
  const renderServiceData = (providerId, service) => {
    const currentData = data[providerId];
    const loadingKey = `${providerId}_${service}`;
    
    let items = [];
    let title = '';
    
    switch (providerId) {
      case 'google':
        switch (service) {
          case 'gmail':
            items = currentData.emails;
            title = 'Recent Emails';
            break;
          case 'drive':
            items = currentData.driveFiles;
            title = 'Recent Files';
            break;
          case 'calendar':
            items = currentData.events;
            title = 'Upcoming Events';
            break;
        }
        break;
      case 'slack':
        switch (service) {
          case 'channels':
            items = currentData.channels;
            title = 'Channels';
            break;
          case 'messages':
            items = currentData.messages;
            title = 'Recent Messages';
            break;
          case 'users':
            items = currentData.users;
            title = 'Team Members';
            break;
        }
        break;
      case 'jira':
        switch (service) {
          case 'allissues':
            items = currentData.issues;
            title = 'All Issues';
            break;
          case 'projects':
            items = currentData.projects;
            title = 'Projects';
            break;
          case 'boards':
            items = currentData.boards;
            title = 'Boards';
            break;
        }
        break;
    }
    
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-md font-medium text-gray-900">{title}</h4>
          <button
            onClick={() => {
              if (providerId === 'google') fetchGoogleData(service);
              else if (providerId === 'slack') fetchSlackData(service);
              else if (providerId === 'jira') fetchJiraData(service);
            }}
            disabled={isLoading[loadingKey]}
            className="flex items-center px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading[loadingKey] ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            Load
          </button>
        </div>
        
        {items.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            {providerId === 'jira' && service === 'boards' && error && error.includes('re-authenticate') ? (
              <span>
                Boards access requires additional permissions. 
                <br />
                <button 
                  onClick={() => handleProviderAuth('jira')}
                  className="text-blue-500 hover:text-blue-700 underline mt-2"
                >
                  Re-authenticate with Jira
                </button>
              </span>
            ) : (
              `No ${service} data found. Click "Load" to fetch data.`
            )}
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {items.slice(0, 5).map((item, index) => {
              // Handle different data structures for different providers
              let title = '';
              let description = '';
              let date = '';
              let status = '';
              let key = '';
              
              if (providerId === 'jira') {
                // Handle Jira data structure with nested fields
                if (service === 'allissues') {
                  title = item.fields?.summary || item.summary || 'Untitled';
                  description = item.fields?.description || item.description || 'No description';
                  status = item.fields?.status?.name || item.status?.name || '';
                  key = item.key || item.id || '';
                  date = item.fields?.updated || item.fields?.created || item.updated || item.created || '';
                } else if (service === 'projects') {
                  title = item.name || item.title || 'Untitled Project';
                  description = item.description || item.projectTypeKey || 'No description';
                  key = item.key || item.id || '';
                  status = item.style || item.projectTypeKey || '';
                } else if (service === 'boards') {
                  title = item.name || item.title || 'Untitled Board';
                  description = item.type || item.description || 'No description';
                  key = item.id || '';
                  status = item.state || '';
                }
              } else {
                // Handle other providers (Google, Slack)
                title = item.subject || item.name || item.title || item.summary || 'Untitled';
                description = item.snippet || item.from || item.creator || item.assignee || item.description || 'No description';
                date = item.date || item.updated || item.created || '';
              }
              
              return (
                <div key={index} className="bg-white p-3 rounded border">
                  <div className="text-sm font-medium text-gray-900">
                    {key && <span className="text-xs text-gray-400 mr-2">{key}</span>}
                    {title}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {description}
                  </div>
                  {status && (
                    <div className="text-xs text-blue-600 mt-1">
                      Status: {status}
                    </div>
                  )}
                  {date && (
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(date).toLocaleDateString()}
                    </div>
                  )}
                  {item.mimeType && (
                    <div className="text-xs text-gray-400 mt-1">
                      Type: {item.mimeType.replace('application/', '')}
                    </div>
                  )}
                  {item.size && (
                    <div className="text-xs text-gray-400 mt-1">
                      Size: {(item.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Lagentry Multi-Provider Dashboard
          </h1>
          <p className="text-gray-600">
            Connect and manage your Google, Slack, and Jira integrations
          </p>
        </div>

        {/* Authentication Message */}
        {authMessage && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <Loader2 className="w-5 h-5 text-blue-500 mr-2 animate-spin" />
              <span className="text-blue-700">{authMessage}</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Provider Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {Object.keys(PROVIDERS).map(renderProviderCard)}
        </div>

        {/* Active Provider Details */}
        {connectedProviders[activeProvider] && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">
                {PROVIDERS[activeProvider].name} Services
              </h2>
              <span className="text-sm text-gray-500">
                Connected as: {connectedProviders[activeProvider].email}
              </span>
            </div>

            {/* Service Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="flex space-x-8">
                {PROVIDERS[activeProvider].services.map((service, index) => {
                  const serviceKey = service.toLowerCase().replace(' ', '');
                  const isActive = activeService[activeProvider] === serviceKey;
                  
                  return (
                    <button
                      key={serviceKey}
                      onClick={() => setActiveService(prev => ({
                        ...prev,
                        [activeProvider]: serviceKey
                      }))}
                      className={`py-4 px-1 border-b-2 font-medium text-sm ${
                        isActive
                          ? `border-${PROVIDERS[activeProvider].color}-500 text-${PROVIDERS[activeProvider].color}-600`
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {service}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Service Content */}
            {renderServiceData(activeProvider, activeService[activeProvider])}
          </div>
        )}
      </div>
    </div>
  );
}

export default App; 