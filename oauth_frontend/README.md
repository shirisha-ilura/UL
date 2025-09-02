# Gmail OAuth Frontend

A modern React frontend for the Gmail OAuth Backend that allows users to authenticate with Google and read their emails.

## Features

- 🔐 **Google OAuth Integration** - Secure authentication with Google
- 📧 **Email Reading** - Fetch and display latest emails from Gmail
- 🎨 **Modern UI** - Clean, responsive design with Tailwind CSS
- 📱 **Mobile Friendly** - Responsive design that works on all devices
- ⚡ **Real-time Updates** - Automatic authentication status checking

## Prerequisites

Make sure you have:
1. Node.js (v14 or higher)
2. The backend server running on `http://localhost:8000`
3. Google OAuth credentials configured in the backend

## Installation

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm start
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

## How it Works

1. **Authentication Flow:**
   - Click "Connect with Google" button
   - Redirected to Google OAuth consent screen
   - Grant permissions to access Gmail
   - Redirected back to the frontend

2. **Email Reading:**
   - After authentication, click "Load Emails"
   - Fetches the last 5 emails from your Gmail inbox
   - Click on any email to view full details

3. **Features:**
   - View email list with sender, subject, and preview
   - Click emails to see full content
   - Responsive design for mobile and desktop
   - Error handling and loading states

## API Integration

The frontend connects to the backend API endpoints:

- `GET /auth/google` - Initiate OAuth flow
- `GET /users` - Check authentication status
- `GET /emails` - Fetch email list
- `GET /emails/{message_id}` - Get email details

## Development

### Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm eject` - Eject from Create React App

### Project Structure

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── EmailList.js
│   │   └── EmailDetail.js
│   ├── App.js
│   ├── index.js
│   └── index.css
├── package.json
└── tailwind.config.js
```

## Troubleshooting

1. **CORS Issues:**
   - Make sure the backend has CORS configured for `http://localhost:3000`
   - Check that the backend is running on `http://localhost:8000`

2. **OAuth Issues:**
   - Verify Google OAuth credentials are properly configured
   - Check that redirect URI matches: `http://localhost:8000/auth/google/callback`

3. **API Connection Issues:**
   - Ensure the backend server is running
   - Check browser console for error messages
   - Verify proxy configuration in package.json

## Customization

### Styling
The app uses Tailwind CSS. Modify `tailwind.config.js` to customize colors and styling.

### API Configuration
Update the `API_BASE_URL` in `App.js` if your backend runs on a different port.

### Email Display
Modify `EmailList.js` and `EmailDetail.js` to customize how emails are displayed. 