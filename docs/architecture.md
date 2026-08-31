# Architecture

## What are the moving pieces, and how do they talk to each other?

The application is split into three main layers:
1. Frontend
2. Backend API
3. PostgreSQL database

The frontend is responsible for displaying the application UI, collecting user input, and sending requests to the backend.

The backend is responsible for authentication, authorization, validation, business rules, database operations, and generating responses for the frontend.

The database stores the application's persistent data, including users, menu items, orders, order lines, collaborators, order events, and alerts.

The main communication flow is:

React frontend
    ↓ HTTP/JSON
Express backend API
    ↓ Prisma
PostgreSQL database

## Where does each piece run?

### Frontend

The React + Vite frontend will run in the user's browser during development and will be deployed as a web application.

The frontend is responsible for:
- Login and application screens
- Menu management UI
- Order creation and management
- Order status controls
- Order search and filtering
- Dashboard visualisation
- Alert display and acknowledgement

### Backend

The Node.js + Express backend will run as a server-side application.

It is responsible for:
- Authentication
- Role-based authorization
- Request validation
- Order status transition validation
- Price calculation
- Database operations
- CSV generation
- Dashboard data aggregation
- Immutable order event creation
- Slow-order alert logic

The backend will use Prisma to communicate with PostgreSQL.

### Database

PostgreSQL will store the persistent application data.

The main tables are:
- users
- menu_items
- orders
- order_lines
- order_collaborators
- order_events
- order_alerts


## Deployment

The intended deployment structure is:

Browser
    ↓
Vercel
    ↓
Express API on Render
    ↓
PostgreSQL on Supabase

The exact hosting providers may change during deployment.

## What is the request path for one representative user action, end to end?

A representative action is a waiter changing an order from `ACCEPTED` to `PREPARING`.

1. The waiter selects the order in the React application and clicks the action to move it to `PREPARING`.

2. React sends an HTTP request to the Express API containing the order ID and requested new status.

3. The backend authenticates the request using the user's authentication token.

4. The backend checks that the authenticated user has permission to act on the order. The user must be the primary waiter or an authorized collaborator, depending on the operation.

5. The backend retrieves the current order status from PostgreSQL.

6. The backend checks the state transition against the allowed order lifecycle. `ACCEPTED → PREPARING` is valid, while an invalid transition is rejected.

7. The backend performs the order update and creates an immutable `STATUS_CHANGED` event containing the previous and new status and the user who performed the action.

8. These related database changes are performed together so that the order status and its corresponding history remain consistent.

9. The backend returns the updated order information to the frontend.

10. React updates the displayed order status and timeline.


## What did you decide not to build, and why?

The assignment has a limited time budget, so the implementation will prioritize the ten required goals before optional functionality.

Features such as a kitchen display, table-side ordering, split checks, loyalty functionality, inventory management, reservations, receipts, happy-hour pricing, and multiple-location support will not be built unless all required goals are complete and sufficient time remains.

The architecture may be revised during implementation. Any significant change will be recorded in `decisions.md`.