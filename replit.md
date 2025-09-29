# Cashback Trading Platform (رفيق الكاش باك)

## Overview
A Next.js-based cashback platform for traders, designed to reward users with cashback on every trade they make. The application features Firebase authentication, Firestore database, and a comprehensive loyalty/referral system.

## Project Architecture
- **Framework**: Next.js 15.3.3 with Turbopack
- **Language**: TypeScript
- **Styling**: TailwindCSS with Radix UI components
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth (Email/Password, Google, Apple)
- **State Management**: React Context (useAuthContext)
- **UI Components**: Radix UI primitives with custom styling
- **AI Integration**: Google Genkit for AI features

## Key Features
- User registration and authentication with Firebase
- Trading account management with broker integration
- Cashback calculation and tracking
- Loyalty points and tier system
- Referral program with commission tracking
- Admin dashboard for managing users, brokers, and transactions
- Blog system with Markdown support
- Store/marketplace functionality
- Activity logging and security tracking
- Multi-language support (Arabic/English, RTL layout)

## Project Structure
- `/src/app` - Next.js app router pages and routes
  - `/admin` - Admin dashboard and management features
  - `/dashboard` - User dashboard
  - `/blog` - Blog posts and articles
  - `actions.ts` - Server actions for data operations
- `/src/components` - React components
  - `/ui` - Reusable UI components (Radix UI)
  - `/admin` - Admin-specific components
  - `/user` - User-facing components
  - `/shared` - Shared components (guards, layouts)
- `/src/lib` - Utility functions and configurations
  - `/firebase` - Firebase client and admin configuration
- `/src/hooks` - Custom React hooks
- `/src/types` - TypeScript type definitions

## Environment Variables (Required)
The following Firebase configuration variables must be set in Replit Secrets:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `FIREBASE_SERVICE_ACCOUNT_KEY_B64` - Base64 encoded service account JSON
- `IPINFO_TOKEN` - For geo-location services

## Development Workflow
- **Start Dev Server**: Workflow "Server" runs `npm run dev` on port 5000
- **Port**: 5000 (configured for Replit environment)
- **Host**: 0.0.0.0 (required for Replit proxy)
- **Turbopack**: Enabled for faster builds

## Deployment
- **Type**: Autoscale (stateless web application)
- **Build**: `npm run build`
- **Run**: `npm start -p 5000 -H 0.0.0.0`
- Configured via deploy_config_tool

## Important Notes
- The application uses RTL (right-to-left) layout for Arabic language support
- Firebase credentials are required for authentication and database operations
- The `allowedDevOrigins` config allows Replit proxy domains for proper development experience
- TypeScript and ESLint errors are ignored during builds (configured in next.config.js)

## Recent Changes
- 2025-09-29: Initial Replit environment setup
  - Configured port 5000 with 0.0.0.0 binding
  - Updated Next.js config for Replit proxy compatibility
  - Set up deployment configuration
  - Installed all npm dependencies
