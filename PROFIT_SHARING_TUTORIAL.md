# Profit Sharing System - Complete User Guide

## Table of Contents
1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Company Management](#company-management)
4. [User Access Management](#user-access-management)
5. [Profit Plans](#profit-plans)
6. [Stakeholders & Awards](#stakeholders--awards)
7. [Valuations (Profit Entries)](#valuations-profit-entries)
8. [Milestones Tracking](#milestones-tracking)
9. [Notifications](#notifications)
10. [Access Control & Roles](#access-control--roles)
11. [Complete Workflow Example](#complete-workflow-example)

---

## Overview

The Profit Sharing system allows companies to manage profit-sharing plans, track stakeholder awards, record profit valuations, and calculate payouts. The system supports multiple companies, role-based access control, and automated notifications.

### Key Concepts

- **Company**: A separate entity with its own plans, stakeholders, and valuations
- **Profit Plan**: Defines profit thresholds, payment schedules, and milestones
- **Stakeholder**: An individual who receives profit-sharing awards
- **Award**: A specific profit-sharing allocation tied to a plan with shares and dates
- **Valuation**: A profit entry that records profit amount, date, and calculates price per share
- **Price Per Share**: Calculated as `profitAmount / totalShares` for each valuation

---

## Getting Started

### Prerequisites

- Admin access to Profit Sharing (built-in admins: `admin-01@tatco.construction`, `brett@tatco.construction`)
- At least one company must be created
- Users must be registered in Bolt before being added to Profit Sharing

### Initial Setup

1. Navigate to **Profit Sharing** from the main sidebar
2. Go to the **Settings** tab
3. Create your first company (default: "Tatco OKC" is auto-created if none exist)
4. Select the company you want to work with

---

## Company Management

### Creating a Company

1. Go to **Profit Sharing > Settings**
2. Click **"Add Company"** button
3. Enter company name (e.g., "Tatco OKC", "Tatco Dallas")
4. Click **"Save"**
5. The company is automatically selected

### Selecting a Company

- All data (plans, stakeholders, valuations) is filtered by the selected company
- The selected company persists in your profile and local storage
- Switch companies using the **"Select"** action in the companies table

### Deleting a Company

- Click **"Delete"** in the companies table
- **Warning**: This action cannot be undone

---

## User Access Management

### Adding Users to Profit Sharing

1. Go to **Profit Sharing > Settings > User Management**
2. Click **"Add User"**
3. Select a registered Bolt user from the dropdown
4. Choose role:
   - **Admin**: Full access to all features
   - **User**: Read-only access to Overview and own Stakeholder data
5. Click **"Save"**

### User Roles

#### Admin
- Full access to all tabs (Overview, Plans, Stakeholders, Valuations, Milestones, Settings)
- Can create, edit, and delete all records
- Receives admin-specific notifications
- Can manage user access

#### User (Regular User)
- Can only view **Overview** and **Stakeholders** tabs
- Only sees their own stakeholder record
- Cannot edit or delete awards
- Receives user-specific notifications (access granted, award finalized, payment reminders)

### Built-in Admins

- `admin-01@tatco.construction`
- `brett@tatco.construction`

These admins cannot be removed or modified in the User Management section.

---

## Profit Plans

### Creating a Profit Plan

1. Go to **Profit Sharing > Plans**
2. Click **"Create Profit Plan"**
3. Fill in the form:
   - **Plan Name**: e.g., "2025 Q1 Profit Sharing"
   - **Milestone Amount**: Profit threshold that must be reached
   - **Total Shares**: Total outstanding shares for this plan
   - **Payment Schedule**: Quarterly, Annually, etc.
   - **Payment Schedule Dates**: Specific dates when payments occur
4. Click **"Save Draft"** or **"Finalize"**

### Plan Status

- **Draft**: Can be edited, awards can be added but not finalized
- **Finalized**: Locked, awards can be finalized and paid out

### Editing a Plan

- Click on a plan in the Plans tab
- Make changes and save
- **Note**: Finalized plans cannot be edited

---

## Stakeholders & Awards

### Adding a Stakeholder

1. Go to **Profit Sharing > Stakeholders**
2. Click **"Add Stakeholder"**
3. Select an existing Bolt user from the dropdown (or enter manually)
4. Fill in details:
   - **Full Name**: Auto-populated if user selected
   - **Title**: Job title
   - **Email**: Auto-populated if user selected
   - **Phone**: Contact number
   - **Employment Status**: Full-time, Part-time, Contract, etc.
   - **Pay Type**: Salary or Hourly
   - **Amount**: Salary/hourly rate
5. Click **"Save"**

### Creating an Award

1. Go to **Profit Sharing > Stakeholders**
2. Click on a stakeholder to view their detail page
3. Click **"New Award"** button
4. Fill in award details:
   - **Plan**: Select the profit plan this award is tied to
   - **Award Start Date**: When the award period begins
   - **Award End Date**: When the award period ends
   - **Number of Profit Shares Issued**: Shares allocated to this stakeholder
5. Click **"Save Draft"** or **"Finalize"**

### Award Status

- **Draft**: Can be edited or deleted
- **Finalized**: Locked, ready for payout calculation

### Viewing Award Payouts

- On the Stakeholder Detail page, expand an award row (click chevron icon)
- View the **Payout History** table showing:
  - Profit Date
  - Profit Amount
  - Price Per Share
  - Shares
  - Estimated Payout

### Next Estimated Profit Payment

- Displayed at the top of the Stakeholder Detail page
- Calculated as: `shares issued × latest price per share` from valuations
- Uses the most recent valuation for the award's plan (or latest overall if no plan-specific one)

---

## Valuations (Profit Entries)

### Creating a Valuation

1. Go to **Profit Sharing > Valuations** (Profit Entries tab)
2. Click **"Add Profit Entry"**
3. Fill in the form:
   - **Plan**: Select the profit plan
   - **Profit Date**: Date of the profit entry
   - **Source**: Manual, Financial Statement, etc.
   - **Profit Amount**: Total profit for this period
   - **Milestone Amount**: Pulled from plan (can be overridden)
   - **Total Shares**: Pulled from plan (can be overridden)
   - **Price Per Share**: Auto-calculated as `profitAmount / totalShares`
   - **Notes**: Optional notes
4. Click **"Save"**

### Price Per Share Calculation

- **Formula**: `pricePerShare = profitAmount / totalShares`
- Automatically calculated when profit amount or total shares change
- Displayed prominently in the header card and table

### Viewing Profit Trend

- A line chart shows profit trend over time
- Hover over data points to see exact values

### Editing a Valuation

- Click the edit icon in the valuations table
- Modify fields and save
- Price per share recalculates automatically

---

## Milestones Tracking

### Viewing Milestones

1. Go to **Profit Sharing > Milestones**
2. View all plans and their milestone status:
   - **Met**: Latest profit exceeds milestone amount
   - **Pending**: Latest profit is below milestone amount
3. See progress bars showing milestone attainment

### Milestone Status

- **Met**: `latestProfit >= milestoneAmount`
- **Pending**: `latestProfit < milestoneAmount`

---

## Notifications

### User Notifications

Regular users receive notifications for:

1. **Access Granted**: When added to Profit Sharing
   - Clicking navigates to Profit Sharing Overview tab

2. **Award Finalized**: When a profit award is finalized for them
   - Includes estimated payout amount
   - Clicking navigates to their Stakeholder Detail page

3. **Payment Reminder**: When a payment date is approaching
   - Notifies about upcoming payout dates

### Admin Notifications

Admins receive notifications for:

1. **Payment Date Approaching**: 14 days and 3 days before payment dates
   - Reminds to set quarterly profit and process payouts

2. **New Valuation Created**: When a new profit entry is added

3. **Plan Finalized**: When a profit plan is finalized

4. **User Role Changed**: When a user's Profit Sharing role is updated

5. **User Added**: When a new user is granted Profit Sharing access

### Notification Preferences

1. Go to **Profile > Notifications**
2. Find the **Profit Sharing** section (only visible if you have access)
3. Toggle notifications on/off:
   - **Profit Sharing**: User notifications (awards, payments)
   - **Profit Sharing (Admin)**: Admin-only notifications (for admins only)

---

## Access Control & Roles

### Admin Access

- Full access to all tabs and features
- Can create, edit, and delete all records
- Can manage user access in Settings
- Receives admin-specific notifications

### Regular User Access

- **Visible Tabs**: Overview, Stakeholders only
- **Hidden Tabs**: Plans, Valuations, Milestones, Settings
- **Stakeholders Tab**: Only sees their own stakeholder record
- **Stakeholder Detail Page**:
  - Can view their own awards and details
  - Cannot edit or delete awards
  - All form fields are read-only
  - Cannot access other stakeholders' pages (redirected if attempted)

### Access Enforcement

- Access is checked on page load
- Regular users are redirected if trying to access restricted pages
- UI elements are hidden/disabled based on role
- Data is filtered server-side and client-side

---

## Complete Workflow Example

### Scenario: Setting up Profit Sharing for Q1 2025

#### Step 1: Create Company (if needed)
1. Go to **Settings > Companies**
2. Create "Tatco OKC" (or select existing)
3. Select it as active

#### Step 2: Create Profit Plan
1. Go to **Plans**
2. Create "2025 Q1 Profit Sharing Plan"
3. Set milestone: $100,000
4. Set total shares: 10,000
5. Set payment schedule: Quarterly
6. Add payment dates: March 31, June 30, September 30, December 31
7. **Finalize** the plan

#### Step 3: Add Stakeholders
1. Go to **Stakeholders**
2. Add stakeholders (select from Bolt users or enter manually)
3. Fill in employment details

#### Step 4: Create Awards
1. Open each stakeholder's detail page
2. Click **"New Award"**
3. Select the "2025 Q1 Profit Sharing Plan"
4. Set award dates (e.g., Jan 1 - Mar 31, 2025)
5. Set shares issued (e.g., 1,000 shares)
6. **Finalize** the award

#### Step 5: Record Profit Entry
1. Go to **Valuations** (Profit Entries)
2. Click **"Add Profit Entry"**
3. Select "2025 Q1 Profit Sharing Plan"
4. Set profit date: March 31, 2025
5. Enter profit amount: $150,000
6. Total shares: 10,000 (auto-filled from plan)
7. Price per share: $15.00 (auto-calculated)
8. **Save**

#### Step 6: View Results
1. **Overview Tab**: See KPIs updated with latest profit, outstanding awards, etc.
2. **Stakeholder Detail**: See "Next Estimated Profit Payment" = $15,000 (1,000 shares × $15)
3. **Milestones Tab**: See plan status as "Met" (profit $150k > milestone $100k)
4. **Stakeholder Awards**: Expand award to see payout history

#### Step 7: Process Payment
1. When payment date arrives (March 31), admins receive notification
2. Review payout calculations in Stakeholder Detail pages
3. Process actual payments outside the system
4. Record next quarter's profit entry when available

---

## Tips & Best Practices

### Data Organization

- **One company per entity**: Create separate companies for different business units
- **Plan naming**: Use descriptive names with dates (e.g., "2025 Q1 Profit Sharing")
- **Award dates**: Ensure award end dates align with payment schedule dates

### Calculations

- **Price Per Share**: Always calculated from latest valuation
- **Estimated Payout**: Uses latest price per share × shares issued
- **Milestone Status**: Compares latest profit to milestone amount

### Notifications

- Enable notifications in Profile to stay updated
- Admins should enable both user and admin notifications
- Regular users only need user notifications

### Access Management

- Add users to Profit Sharing only when they need access
- Use "User" role for most stakeholders (read-only)
- Reserve "Admin" role for managers who need full access

### Troubleshooting

- **$0.00 Payment**: Check that valuations exist and have valid price per share
- **No Data Showing**: Verify company is selected in Settings
- **Access Denied**: Check user role in Settings > User Management
- **Valuations Not Loading**: Ensure companyId matches selected company

---

## Technical Details

### Data Structure

- **Companies**: Stored in `companies` collection
- **Plans**: Stored in `profitSharingPlans` collection with `companyId`
- **Stakeholders**: Stored in `stakeholders` collection with `companyId` and `linkedUserId`
- **Valuations**: Stored in `valuations` collection with `companyId` and `planId`
- **User Access**: Stored in `profitSharingAccess` collection with `companyId` and `role`

### Calculations

- **Price Per Share**: `profitAmount / totalShares` (from valuation)
- **Award Payout**: `sharesIssued × pricePerShare` (for each valuation)
- **Total Estimated Payment**: Sum of all award payouts using latest valuation

### Filtering

- All queries filter by `companyId` to ensure data isolation
- Regular users see only their own stakeholder record (`linkedUserId` match)
- Admins see all data for the selected company

---



