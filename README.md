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

## Firebase Integration Status ✅ COMPLETED

### Overview

The Tatco Construction CRM has been successfully migrated from mock APIs to Firebase, providing real-time data synchronization, secure authentication, and scalable cloud infrastructure.

### Completed Implementation

**✅ Firebase Backend Integration:**
- Firebase project configured and deployed
- Firestore database with proper collections structure
- Firebase Authentication with email/password
- Security rules implemented for data protection
- Environment variables configured for local and production

**✅ Data Migration:**
- All mock data migrated to Firestore
- Leads and clients collections properly structured
- Data validation and transformation implemented
- Migration scripts created for easy data transfer

**✅ CRUD Operations:**
- Complete Create, Read, Update, Delete functionality
- Real-time data synchronization
- Lead-to-client linking system
- Bulk import/export capabilities (JSON and CSV)

**✅ Advanced Features:**
- Advanced search and filtering
- Bulk operations for leads and clients
- Data analytics and reporting
- Export/import functionality
- Market options migration (OKC, DFW, ORL)
- Client number field removal and cleanup

**✅ Production Deployment:**
- Successfully deployed to Vercel
- Environment variables configured
- Production-ready with Firebase backend
- All features working in production environment

### Current Data Structure

```javascript
// Firestore Collections (Current Implementation)
leads: {
  [leadId]: {
    companyName: string,
    leadContact: string,
    title: string,
    email: string,
    phone: string,
    methodOfContact: string,
    dateLastContacted: timestamp,
    projectMarket: string, // "OKC" | "DFW" | "ORL"
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
```

## Weekly Frontend Enhancement Plan

### Overview

This comprehensive weekly plan focuses on enhancing the frontend user experience, improving the CRM dashboard, client and lead detail pages, and implementing advanced UI/UX features for the Tatco Construction CRM.

### Monday: Dashboard Enhancement & Data Visualization

**Objectives:**
- Enhance the main CRM dashboard with better data visualization
- Implement advanced filtering and search capabilities
- Improve the overall user experience and navigation

**Tasks:**
1. **Dashboard UI Improvements**
   - Redesign dashboard layout for better information hierarchy
   - Add customizable widgets and dashboard sections
   - Implement drag-and-drop dashboard customization
   - Add quick action buttons for common tasks

2. **Data Visualization Enhancements**
   - Add interactive charts for lead conversion rates
   - Implement project pipeline visualization
   - Create client engagement metrics dashboard
   - Add real-time activity feed

3. **Advanced Filtering System**
   - Implement multi-criteria filtering for leads and clients
   - Add saved filter presets
   - Create advanced search with autocomplete
   - Add date range filtering with calendar picker

4. **Performance Optimizations**
   - Implement virtual scrolling for large datasets
   - Add lazy loading for dashboard components
   - Optimize data fetching with pagination
   - Add loading states and skeleton screens

**Deliverables:**
- Enhanced dashboard with improved UX
- Advanced filtering and search system
- Interactive data visualizations
- Performance optimizations implemented

### Tuesday: Lead Management Enhancement

**Objectives:**
- Improve lead detail page functionality and design
- Implement advanced lead tracking features
- Add lead scoring and qualification system

**Tasks:**
1. **Lead Detail Page Redesign**
   - Create comprehensive lead profile layout
   - Add timeline view for lead interactions
   - Implement lead status workflow management
   - Add lead activity history and notes

2. **Lead Tracking Features**
   - Implement lead scoring algorithm
   - Add lead qualification criteria
   - Create lead source tracking
   - Implement lead conversion probability

3. **Communication Management**
   - Add email integration for lead communication
   - Implement call logging and scheduling
   - Create meeting scheduler integration
   - Add follow-up reminders and notifications

4. **Lead Analytics**
   - Create lead conversion funnel visualization
   - Add lead source performance metrics
   - Implement lead response time tracking
   - Generate lead performance reports

**Deliverables:**
- Redesigned lead detail page
- Advanced lead tracking system
- Communication management tools
- Lead analytics and reporting

### Wednesday: Client Management Enhancement

**Objectives:**
- Enhance client detail page with comprehensive information
- Implement client relationship management features
- Add project tracking and management capabilities

**Tasks:**
1. **Client Detail Page Enhancement**
   - Create comprehensive client profile dashboard
   - Add client project portfolio view
   - Implement client communication history
   - Add client satisfaction tracking

2. **Project Management Integration**
   - Add project timeline visualization
   - Implement project milestone tracking
   - Create project document management
   - Add project budget and cost tracking

3. **Client Relationship Features**
   - Implement client segmentation
   - Add client value scoring
   - Create client retention analytics
   - Add client referral tracking

4. **Document Management**
   - Implement file upload and organization
   - Add document version control
   - Create document sharing capabilities
   - Add document search and filtering

**Deliverables:**
- Enhanced client detail page
- Project management integration
- Client relationship management tools
- Document management system

### Thursday: Advanced UI/UX Features

**Objectives:**
- Implement advanced UI components and interactions
- Add accessibility features and mobile responsiveness
- Create user customization options

**Tasks:**
1. **Advanced UI Components**
   - Implement advanced data tables with sorting/filtering
   - Add interactive calendars and schedulers
   - Create advanced form components with validation
   - Implement modal dialogs and overlays

2. **Accessibility & Mobile**
   - Ensure WCAG 2.1 AA compliance
   - Implement mobile-first responsive design
   - Add keyboard navigation support
   - Create touch-friendly interfaces

3. **User Customization**
   - Add theme customization options
   - Implement dashboard layout preferences
   - Create user-specific settings panel
   - Add notification preferences

4. **Interactive Features**
   - Implement drag-and-drop functionality
   - Add keyboard shortcuts and hotkeys
   - Create contextual menus and tooltips
   - Add animation and transition effects

**Deliverables:**
- Advanced UI component library
- Accessibility compliance implementation
- Mobile-responsive design
- User customization features

### Friday: Integration & Testing

**Objectives:**
- Integrate all new features with existing Firebase backend
- Comprehensive testing and quality assurance
- Performance optimization and deployment preparation

**Tasks:**
1. **Backend Integration**
   - Ensure all new features work with Firebase
   - Implement real-time updates for new features
   - Add data validation and error handling
   - Optimize API calls and data fetching

2. **Testing & Quality Assurance**
   - Unit testing for all new components
   - Integration testing with Firebase
   - User acceptance testing
   - Cross-browser compatibility testing

3. **Performance Optimization**
   - Bundle size optimization
   - Code splitting implementation
   - Image optimization and lazy loading
   - Caching strategy implementation

4. **Documentation & Deployment**
   - Update user documentation
   - Create feature guides and tutorials
   - Prepare production deployment
   - Set up monitoring and analytics

**Deliverables:**
- Fully integrated frontend features
- Comprehensive testing completed
- Performance optimized application
- Production-ready deployment

### Technical Implementation Details

#### Frontend Architecture Enhancements

```javascript
// Enhanced Component Structure
src/
├── components/
│   ├── dashboard/
│   │   ├── DashboardWidgets.jsx
│   │   ├── DataVisualization.jsx
│   │   ├── QuickActions.jsx
│   │   └── ActivityFeed.jsx
│   ├── leads/
│   │   ├── LeadDetailEnhanced.jsx
│   │   ├── LeadTimeline.jsx
│   │   ├── LeadScoring.jsx
│   │   └── LeadAnalytics.jsx
│   ├── clients/
│   │   ├── ClientDetailEnhanced.jsx
│   │   ├── ProjectPortfolio.jsx
│   │   ├── ClientAnalytics.jsx
│   │   └── DocumentManager.jsx
│   └── ui/
│       ├── AdvancedTable.jsx
│       ├── InteractiveCalendar.jsx
│       ├── CustomFilters.jsx
│       └── AccessibilityWrapper.jsx
```

#### Performance Optimization Strategy

- **Code Splitting**: Implement route-based and component-based code splitting
- **Lazy Loading**: Add lazy loading for images, components, and data
- **Caching**: Implement service worker caching for offline capabilities
- **Bundle Optimization**: Use tree shaking and dead code elimination

#### Accessibility Standards

- **WCAG 2.1 AA Compliance**: Ensure all components meet accessibility standards
- **Keyboard Navigation**: Full keyboard support for all interactive elements
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Color Contrast**: Ensure proper color contrast ratios

### Success Metrics

**User Experience Metrics:**
- Page load time < 2 seconds
- Time to interactive < 3 seconds
- User task completion rate > 95%
- Accessibility score > 90%

**Performance Metrics:**
- Lighthouse performance score > 90
- Bundle size reduction by 30%
- First contentful paint < 1.5 seconds
- Cumulative layout shift < 0.1

**Business Metrics:**
- User engagement increase by 40%
- Task completion time reduction by 25%
- User satisfaction score > 4.5/5
- Mobile usage increase by 50%

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