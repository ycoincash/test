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

## Security Implementation

### Firebase Security
- **Firestore Rules**: Comprehensive security rules implemented in `firestore.rules`
  - User-owned collections with proper ownership checks
  - Admin-only collections requiring `admin: true` custom claim
  - Public read-only collections for products, brokers, etc.
- **Admin Authentication**: Token verification system in `src/lib/auth-helpers.ts`
- **Admin Role**: Script available at `scripts/set-admin-role.ts` to grant admin privileges

### Security Documentation
- `SECURITY_MAPPING.md`: Complete action-to-security mapping
- `SECURITY_IMPLEMENTATION_STATUS.md`: Implementation status and remaining work

### Admin User
- **UID**: `6yUTvF9JrBQo3GUEqxhUnfleVOE3`
- **Email**: `alsabhibassem@gmail.com`
- **Setup**: Run `npx tsx scripts/set-admin-role.ts` to activate admin privileges

## Recent Changes
- 2025-09-29: Initial Replit environment setup
  - Configured port 5000 with 0.0.0.0 binding
  - Updated Next.js config for Replit proxy compatibility
  - Set up deployment configuration
  - Installed all npm dependencies
- 2025-09-29: Firebase security implementation
  - Created comprehensive Firestore security rules
  - Implemented authentication helpers and token verification
  - Set up admin role management system
  - Installed firebase-admin and tsx packages
  - **Note**: Admin actions need to be migrated from Web SDK to Admin SDK (see SECURITY_IMPLEMENTATION_STATUS.md)
- 2025-09-30: Server action security migration (COMPLETED)
  - Migrated all user data fetching functions to Admin SDK
  - **CRITICAL SECURITY FIX**: Implemented ID token verification to prevent horizontal privilege escalation
  - All user-scoped server actions now verify Firebase ID tokens and derive userId server-side
  - Created `getCurrentUserIdToken()` helper in `src/lib/client-auth.ts` for client-side token retrieval
  - Created `verifyClientIdToken()` helper in `src/lib/auth-helpers.ts` for server-side token verification
  - Secured functions include: getUserBalance, notifications, wallet operations, KYC/address submissions, withdrawal requests, phone number updates
  - Added ownership verification to markNotificationsAsRead to prevent cross-user data access
  - Security architecture: Admin operations use Admin SDK (bypasses rules), client operations use Web SDK with rule enforcement, all user-scoped actions require token verification
  - **Status**: Production-ready quick fix implemented and architect-approved
  - **Future recommendation**: Consider migrating to next-firebase-auth-edge for cookie-based authentication
- 2025-09-30: User dashboard security fixes (COMPLETED)
  - Fixed all remaining client SDK queries in user dashboard pages
  - Updated my-accounts page: Now uses getUserTradingAccounts() and getCashbackTransactions() with ID tokens
  - Updated transactions page: Now uses getCashbackTransactions() with ID token verification
  - Updated referrals page: Removed client SDK queries, now uses getUserReferralData() server action
  - Updated dashboard page: Removed client SDK query for offers, now uses getEnabledOffers()
  - Fixed getActiveFeedbackFormForUser(): Converted feedbackResponses query from client SDK to Admin SDK
  - Created new server actions: getUserReferralData(), getEnabledOffers()
  - **Result**: All Firestore permission errors eliminated, user dashboard fully functional with proper security
  - **Status**: Production-ready, architect-approved
- 2025-09-30: Trading account submission security fix (COMPLETED)
  - Fixed broker link page to use secure server action for trading account submission
  - Created submitTradingAccount() server action with ID token verification
  - Implemented atomic transaction for duplicate checking and account creation
  - Now stores both brokerId (stable identifier) and broker (name for display)
  - Uses serverTimestamp for createdAt and normalizes account numbers
  - Complete flow: User submits → Server verifies token → Stores as Pending → Admin approves/rejects
  - **Result**: Users can now successfully submit trading accounts for review with proper security
  - **Status**: Production-ready, architect-approved
- 2025-09-30: Store orders security fix (COMPLETED)
  - **CRITICAL SECURITY FIX**: Fixed horizontal privilege escalation vulnerability in getOrders()
  - Converted getOrders() from client SDK to Admin SDK with ID token verification
  - Function previously accepted userId from client (allowing users to view others' orders)
  - Now verifies ID token and derives userId server-side
  - Updated MyOrdersList component to pass ID token instead of userId
  - Firestore rules already properly restrict order access to owner only
  - **Result**: Users can now only view their own orders, security vulnerability eliminated
  - **Status**: Production-ready, architect-approved
