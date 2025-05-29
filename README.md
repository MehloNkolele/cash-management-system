# Cash Management System

<div align="center">
  <img src="public/assets/images/Absa_logo.png" alt="Absa Logo" width="200">
  <br>
  <h3>Secure Cash Management Solution</h3>
</div>

## Overview

The Cash Management System is a comprehensive Angular-based application designed to streamline and secure the process of cash handling, distribution, and tracking within an organization. This system provides end-to-end management of cash requests, approvals, issuance, returns, and inventory tracking with role-based access controls.

## Features

- **User Role Management**:
  - **Requesters**: Submit cash requests with detailed denomination breakdowns
  - **Issuers**: Process cash issuance and returns
  - **Managers**: Approve requests and oversee operations
  - **Administrators**: Configure system settings and manage users

- **Cash Request Lifecycle**:
  - Request creation with denomination specifications
  - Approval workflow
  - Cash issuance tracking
  - Return processing
  - Automatic and manual rejection handling

- **Inventory Management**:
  - Real-time tracking of available cash by denomination and series
  - Low stock alerts
  - Cash transaction history
  - Series-based inventory management (Mandela, Big 5, etc.)

- **Notifications & Alerts**:
  - Automated notifications for request status changes
  - Low inventory alerts
  - Pending approval reminders
  - Overdue return notifications

- **Reporting & Dashboards**:
  - Role-specific dashboards
  - Request summary visualizations
  - Cash flow reporting
  - System activity logs

- **Security Features**:
  - Role-based access controls
  - Transaction audit logging
  - Dye pack tracking for security
  - Cash verification protocols

## Getting Started

### Prerequisites

- Node.js (v16.x or later)
- npm (v8.x or later)
- Git

### Installation

1. Clone the repository:

```bash
git clone https://github.com/MehloNkolele/cash-management-system.git
cd cash-management-system
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm start
```

4. Navigate to `http://localhost:4200/` in your browser to access the application.

## Project Structure

```
src/
  ├── app/
  │   ├── components/           # UI components
  │   │   ├── add-cash-modal/
  │   │   ├── alerts-overview/
  │   │   ├── cash-request-form/
  │   │   ├── dashboard/
  │   │   ├── inventory-management/
  │   │   └── ...
  │   ├── models/               # Data models & interfaces
  │   │   ├── cash-request.model.ts
  │   │   ├── inventory.model.ts
  │   │   ├── notification.model.ts
  │   │   ├── system-log.model.ts
  │   │   └── user.model.ts
  │   ├── services/             # Business logic services
  │   │   ├── cash-request.service.ts
  │   │   ├── inventory.service.ts
  │   │   ├── notification.service.ts
  │   │   └── ...
  │   └── ...
  └── styles/                   # Global styling
```

## Usage

### User Login

- Access the application at `http://localhost:4200/`
- Login with your credentials based on your assigned role

### Creating Cash Requests

1. Navigate to the dashboard
2. Click "New Request"
3. Fill in the required details including denominations needed
4. Submit for approval

### Approving Requests (Managers)

1. Access the manager dashboard
2. View pending requests in the approval queue
3. Review request details and inventory availability
4. Approve or reject with comments

### Cash Issuance (Issuers)

1. View approved requests in the issuance queue
2. Verify cash before issuance
3. Record issuance details and recipient information

### Processing Returns

1. Select active requests with issued cash
2. Count and verify returned cash
3. Record any discrepancies
4. Complete the return process

## Development

### Available Scripts

- `npm start` - Start the development server
- `npm run build` - Build the production application
- `npm test` - Run unit tests
- `npm run watch` - Build in watch mode for development

### Code Generation

Use Angular CLI to generate components:

```bash
ng generate component components/new-component-name
```

## Technologies

- **Angular**: Frontend framework (v19.2)
- **Angular Material**: UI component library
- **RxJS**: Reactive programming library
- **TypeScript**: Programming language
- **Karma & Jasmine**: Testing framework

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

Project Maintainer: Mehlo Nkolele - [GitHub Profile](https://github.com/MehloNkolele)

Project Repository: [https://github.com/MehloNkolele/cash-management-system.git](https://github.com/MehloNkolele/cash-management-system.git)
