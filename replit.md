# Cashback Trading Platform (رفيق الكاش باك)

## Overview
A Next.js-based cashback platform for traders, designed to reward users with cashback on every trade. The application aims to provide a comprehensive loyalty and referral system, robust authentication, and trading account management. The business vision is to capture a significant market share in the trading cashback sector by offering a secure, feature-rich, and user-friendly experience.

## User Preferences
I want to ensure all server actions are secure and properly migrate any insecure ID token patterns to secure cookie-based authentication. I expect comprehensive security implementations and verification across the platform. I want the agent to prioritize fixing critical security vulnerabilities and ensuring the system is production-ready.

## System Architecture
The platform is built with Next.js 15.3.3 and Turbopack, using TypeScript and styled with TailwindCSS and Radix UI components. Firebase Firestore serves as the database, with Firebase Auth handling user authentication (Email/Password, Google, Apple). State management is handled with React Context (useAuthContext). AI features are integrated using Google Genkit.

**UI/UX Decisions:**
- Multi-language support with Arabic/English and RTL layout.
- Radix UI primitives are used for UI components, with custom styling.

**Technical Implementations & Feature Specifications:**
- User authentication and authorization with Firebase and secure cookie-based sessions.
- Trading account management, including broker integration and a submission/approval workflow.
- Cashback calculation, tracking, and a loyalty points/tier system.
- Referral program with commission tracking.
- Admin dashboard for comprehensive management of users, brokers, and transactions.
- Content management features including a blog system with Markdown support.
- E-commerce functionality with a store/marketplace.
- Activity logging for security tracking.
- Geo-location services for user registration via IP detection.

**System Design Choices:**
- **Security-first approach:** Emphasizing Firebase Security Rules, token verification, and a recent migration to HTTP-only signed cookies for authentication to prevent XSS and CSRF.
- **Server Actions:** All critical user-scoped operations and data fetching are handled via secure server actions, with token verification performed server-side.
- **Atomic Transactions:** Implemented for sensitive operations like store purchases to prevent double-spending and ensure data consistency.
- **Project Structure:** Organized into `src/app` for routes, `src/components` for UI, `src/lib` for utilities, `src/hooks` for custom hooks, and `src/types` for TypeScript definitions.

## External Dependencies
- **Firebase:** Firestore (database), Authentication (user auth), Admin SDK (server-side operations).
- **Next.js:** Web framework.
- **Turbopack:** Build tool for Next.js.
- **TailwindCSS:** Styling framework.
- **Radix UI:** UI component library.
- **Google Genkit:** AI integration.
- **IPinfo.io / ipapi.co:** Geo-location services (server-side with `IPINFO_TOKEN`).
- **next-firebase-auth-edge:** For secure cookie-based authentication.

## Replit Environment Setup

### Development Server
- **Workflow:** "Server" running `npm run dev`
- **Port:** 5000 (configured to bind to 0.0.0.0)
- **Host Configuration:** Next.js configured with `allowedDevOrigins: ['*.replit.dev']` to work with Replit's proxy

### Required Environment Variables
The following environment variables must be configured in Replit Secrets:

**Firebase Client Configuration (NEXT_PUBLIC_*):**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

**Firebase Admin SDK:**
- `FIREBASE_SERVICE_ACCOUNT_KEY_B64` - Base64 encoded Firebase service account JSON key

**Authentication & Security:**
- `COOKIE_SIGNATURE_KEYS` - JSON array of signing keys (e.g., `["secret-key-1","secret-key-2"]`)

**Optional Services:**
- `IPINFO_TOKEN` - IPinfo.io API token for geo-location services

### Deployment Configuration
- **Target:** Autoscale (stateless web application)
- **Build Command:** `npm run build`
- **Run Command:** `npm start`

### Recent Changes
- **2025-10-04:** Initial Replit environment setup completed
  - Installed npm dependencies
  - Configured development workflow on port 5000
  - Set up deployment configuration for production
  - Verified Next.js host configuration for Replit proxy compatibility