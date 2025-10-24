# Tatco Construction CRM Dashboard

A comprehensive Customer Relationship Management system built specifically for Tatco Construction, designed to streamline project management, client relations, and business operations.

## Project Overview

This CRM dashboard serves as the central hub for Tatco Construction's digital operations, providing a modern, responsive interface for managing projects, clients, and internal processes. Built on a robust React foundation with enterprise-grade features, the system offers scalability and flexibility for future growth.

## Key Features

- **Modern Dashboard Interface**: Clean, intuitive design optimized for construction industry workflows
- **Authentication System**: Secure user authentication with role-based access control
- **Responsive Design**: Fully responsive interface that works across desktop, tablet, and mobile devices
- **Theme Customization**: Dark/light mode support with customizable branding
- **Data Management**: Advanced data tables, forms, and reporting capabilities
- **Project Tracking**: Built-in tools for project management and client communication
- **User Management**: Comprehensive user roles and permissions system

## Technical Stack

- **Frontend**: React 19 with Vite build system
- **Styling**: Tailwind CSS 4 with custom component library
- **State Management**: Zustand for lightweight state management
- **Routing**: React Router 7 for navigation
- **Forms**: React Hook Form with Zod validation
- **HTTP Client**: Axios with interceptors for API communication
- **UI Components**: Custom-built component library with 200+ reusable components
- **Charts & Visualization**: ApexCharts and D3.js for data visualization
- **Internationalization**: React i18next for multi-language support

## Installation

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn package manager

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone [https://github.com/MateoTatco/Bolt.git]
   cd bolt
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   - Update `src/configs/app.config.js` with your application settings
   - Modify `src/constants/app.constant.js` for branding customization
   - Configure API endpoints in `src/configs/endpoint.config.js`

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Open your browser to `http://localhost:5173`
   - Default login credentials are configured in the mock data

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run prettier` - Check code formatting
- `npm run prettier:fix` - Fix code formatting
- `npm run format` - Run both linting and formatting fixes

### Project Structure

```
src/
├── auth/                 # Authentication system
├── components/           # Reusable UI components
│   ├── layouts/         # Layout components
│   ├── shared/          # Shared components
│   ├── template/        # Template components
│   └── ui/              # Base UI components
├── configs/             # Configuration files
├── constants/           # Application constants
├── mock/               # Mock API data
├── services/           # API services
├── store/              # State management
├── utils/              # Utility functions
└── views/              # Page components
```

## Customization and small changes

### Branding
- Update logo files in `public/img/logo/`
- Modify company name in `src/constants/app.constant.js`
- Customize colors and themes in `src/configs/theme.config.js`

### Authentication
- Configure user roles in `src/constants/roles.constant.js`
- Update mock user data in `src/mock/data/authData.js`
- Modify authentication flow in `src/auth/`

### API Integration
- Replace mock API with real endpoints in `src/services/`
- Update API configuration in `src/configs/endpoint.config.js`
- Configure request/response interceptors in `src/services/axios/`

## Deployment

### Production Build

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy the `build` directory** to your hosting platform

3. **Configure environment variables** for production settings

### Environment Configuration

- Set `enableMock: false` in `src/configs/app.config.js` for production
- Configure proper API endpoints
- Set up authentication backend
- Configure CORS and security settings

## Firebase Migration Plan

### Overview

This section outlines the comprehensive plan to migrate the Tatco Construction CRM from mock APIs to Firebase, enabling real-time data synchronization, user authentication, and scalable backend infrastructure.

### Current Architecture Analysis

**Current State:**
- Mock API system using Axios interceptors
- Local storage persistence for leads and clients
- Static data models with predefined relationships
- Basic CRUD operations for leads and clients
- No real-time capabilities or user authentication

**Data Models Identified:**
- **Leads**: 10+ fields including company info, contact details, status tracking
- **Clients**: 8+ fields including business information, location data
- **Users**: Authentication system with role-based access
- **Relationships**: Lead-to-client associations, user ownership

### Migration Strategy

#### Phase 1: Firebase Setup & Authentication (Monday) (DONE)
**Objectives:**
- Set up Firebase project and configure authentication
- Implement user management system
- Create Firebase security rules

**Tasks:**
1. **Firebase Project Configuration** (DONE)
   - Create new Firebase project for Tatco Construction CRM (DONE)
   - Configure Firebase Authentication with email/password (DONE)
   - Set up Firebase Firestore database (DONE)
   - Configure Firebase Storage for file attachments (DONE)
   - Set up Firebase Hosting for production deployment (DONE)

2. **Authentication Implementation** (Partially)
   - Install Firebase SDK: `npm install firebase` (DONE)
   - Create Firebase authentication service (DONE)
   - Implement user registration and login flows (DONE)
   - Add role-based access control (admin, user, manager) (Pending)
   - Create user profile management (Pending)

3. **Security Rules Setup** (Partially)
   - Configure Firestore security rules for data protection (DONE)
   - Implement user-based data access controls (DONE)
   - Set up data validation rules (DONE)
   - Create backup and recovery procedures (Pending)

**Deliverables:** 
- Firebase project configured and ready (DONE)
- User authentication system working (DONE)
- Basic security rules implemented (DONE)
- User management interface functional (DONE)

#### Phase 2: Firestore Database Design (Tuesday) (DONE)
**Objectives:**
- Design Firestore collections and document structure (DONE)
- Implement data migration from mock APIs (DONE)
- Create real-time data synchronization (DONE)

**Tasks:**
1. **Database Schema Design**
   - Design `leads` collection with proper indexing (DONE)
   - Design `clients` collection with relationship mapping (DONE)
   - Create `users` collection for user management (DONE)
   - Design `activities` collection for audit trails (DONE)
   - Plan `settings` collection for application configuration (DONE)

2. **Data Migration Implementation** (Partially)
   - Create migration scripts for existing mock data (DONE)
   - Implement data validation and transformation (DONE)
   - Set up data backup procedures (DONE)
   - Create rollback mechanisms (Pending)

3. **Real-time Synchronization** (Pending)
   - Implement Firestore real-time listeners (Pending)
   - Create optimistic updates for better UX (Pending)
   - Set up conflict resolution strategies (Pending)
   - Implement offline data caching (Pending)

**Deliverables:**
- Firestore collections designed and created (DONE)
- All mock data migrated to Firebase (DONE)
- Real-time data synchronization working (DONE)
- Offline capabilities implemented (PENDING)

#### Phase 3: Service Layer Migration (Wednesday)
**Objectives:**
- Replace mock API services with Firebase services
- Implement advanced querying and filtering
- Add data validation and error handling

**Tasks:**
1. **Firebase Service Implementation**
   - Create `FirebaseService.js` to replace `CrmService.js`
   - Implement CRUD operations for leads and clients
   - Add advanced querying with Firestore
   - Implement batch operations for bulk actions
   - Create data export/import functionality

2. **Advanced Features**
   - Implement full-text search using Algolia or similar
   - Add data analytics and reporting capabilities
   - Create automated backup systems
   - Implement data archiving for old records

3. **Error Handling & Validation**
   - Add comprehensive error handling
   - Implement data validation schemas
   - Create retry mechanisms for failed operations
   - Add logging and monitoring

**Deliverables:**
- All API calls migrated to Firebase
- Advanced querying and filtering working
- Error handling and validation implemented
- Performance optimizations in place

#### Phase 4: Real-time Features & Collaboration (Thursday)
**Objectives:**
- Implement real-time collaboration features
- Add notification system
- Create activity tracking and audit logs

**Tasks:**
1. **Real-time Collaboration**
   - Implement real-time lead/client updates
   - Add user presence indicators
   - Create collaborative editing features
   - Implement conflict resolution for simultaneous edits

2. **Notification System**
   - Set up Firebase Cloud Messaging (FCM)
   - Create in-app notification system
   - Add email notifications for important events
   - Implement push notifications for mobile users

3. **Activity Tracking**
   - Create comprehensive audit logs
   - Implement user activity tracking
   - Add data change history
   - Create reporting dashboards

**Deliverables:**
- Real-time collaboration features working
- Notification system implemented
- Activity tracking and audit logs functional
- User experience significantly improved

#### Phase 5: Testing, Deployment & Optimization (Friday)
**Objectives:**
- Comprehensive testing of all features
- Production deployment
- Performance optimization and monitoring

**Tasks:**
1. **Testing & Quality Assurance**
   - Unit testing for all Firebase services
   - Integration testing for real-time features
   - Performance testing under load
   - Security testing and penetration testing
   - User acceptance testing

2. **Production Deployment**
   - Deploy to Firebase Hosting
   - Configure production environment variables
   - Set up monitoring and alerting
   - Create backup and disaster recovery procedures
   - Implement CI/CD pipeline

3. **Performance Optimization**
   - Optimize Firestore queries and indexes
   - Implement caching strategies
   - Add performance monitoring
   - Create performance dashboards
   - Optimize bundle size and loading times

**Deliverables:**
- Production-ready application deployed
- Comprehensive testing completed
- Performance optimized and monitored
- Documentation updated

### Technical Implementation Details

#### Firebase Collections Structure

```javascript
// Firestore Collections Design
leads: {
  [leadId]: {
    companyName: string,
    leadContact: string,
    title: string,
    email: string,
    phone: string,
    methodOfContact: string,
    dateLastContacted: timestamp,
    projectMarket: string,
    status: string,
    responded: boolean,
    notes: string,
    favorite: boolean,
    owner: string, // userId
    clientIds: array,
    createdAt: timestamp,
    updatedAt: timestamp,
    image: string
  }
}

clients: {
  [clientId]: {
    clientType: string,
    clientName: string,
    address: string,
    city: string,
    state: string,
    zip: string,
    tags: string,
    notes: string,
    favorite: boolean,
    leadIds: array,
    createdAt: timestamp,
    updatedAt: timestamp,
    image: string
  }
}

users: {
  [userId]: {
    email: string,
    userName: string,
    authority: array,
    avatar: string,
    lastLogin: timestamp,
    preferences: object
  }
}

activities: {
  [activityId]: {
    userId: string,
    action: string,
    entityType: string, // 'lead' | 'client'
    entityId: string,
    changes: object,
    timestamp: timestamp,
    ipAddress: string
  }
}
```

#### Environment Variables Required

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Optional: Algolia for search
VITE_ALGOLIA_APP_ID=your_algolia_app_id
VITE_ALGOLIA_SEARCH_KEY=your_algolia_search_key
```

#### Security Rules Example

```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Leads access based on ownership
    match /leads/{leadId} {
      allow read, write: if request.auth != null && 
        (resource.data.owner == request.auth.uid || 
         request.auth.token.authority in ['admin', 'manager']);
    }
    
    // Clients access for all authenticated users
    match /clients/{clientId} {
      allow read, write: if request.auth != null;
    }
    
    // Activities are read-only for users
    match /activities/{activityId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        request.auth.token.authority in ['admin', 'manager'];
    }
  }
}
```

### Migration Benefits

**Immediate Benefits:**
- Real-time data synchronization across all users
- Secure user authentication and authorization
- Scalable cloud infrastructure
- Automatic backups and data protection
- Offline capabilities for mobile users

**Long-term Benefits:**
- Reduced server maintenance costs
- Built-in security and compliance features
- Easy integration with other Firebase services
- Automatic scaling based on usage
- Advanced analytics and reporting capabilities

### Risk Mitigation

**Data Safety:**
- Complete backup of existing mock data before migration
- Rollback procedures in case of issues
- Gradual migration with parallel systems during transition
- Comprehensive testing in staging environment

**Performance Considerations:**
- Implement proper Firestore indexing for optimal query performance
- Use pagination for large datasets
- Implement caching strategies for frequently accessed data
- Monitor and optimize query costs

### Success Metrics

**Technical Metrics:**
- 99.9% uptime for Firebase services
- < 200ms average response time for CRUD operations
- Real-time updates delivered within 1 second
- Zero data loss during migration

**Business Metrics:**
- Improved user productivity through real-time collaboration
- Reduced data entry errors through validation
- Enhanced security and compliance
- Scalable infrastructure for future growth

## Features in Development

The CRM system is designed to support the following construction industry workflows:

- **Project Management**: Track construction projects from inception to completion
- **Client Relations**: Manage client communications and project updates
- **Resource Planning**: Schedule and allocate construction resources
- **Document Management**: Handle project documents and compliance tracking
- **Reporting**: Generate project reports and business analytics
- **Team Collaboration**: Facilitate communication between project stakeholders

## Support and Maintenance

This CRM system is built with enterprise-grade architecture, ensuring:

- **Scalability**: Modular design allows for easy feature additions
- **Maintainability**: Clean code structure with comprehensive documentation
- **Performance**: Optimized for fast loading and smooth user experience
- **Security**: Built-in security measures for data protection
- **Flexibility**: Customizable to meet specific business requirements

## License

This project is proprietary software developed for Tatco Construction. All rights reserved.

---

For technical support or customization requests, please contact the development team.