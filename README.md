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

## Customization

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