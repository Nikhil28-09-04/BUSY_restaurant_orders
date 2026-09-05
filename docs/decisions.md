# Decisions

## Decision 1

- **Chose:** Use a separate React frontend and Express backend.
- **Rejected:** Building the entire application as one monolithic frontend application.
- **Why:** Separating the frontend and backend makes the application easier to maintain and deploy. The React frontend handles the user interface, while the Express backend handles authentication, business logic, database access, and API responses.


## Decision 2

- **Chose:** Use role-based access control for managers and waiters.
- **Rejected:** Giving every authenticated user access to all order management operations.
- **Why:** Managers and waiters have different responsibilities. Managers can access dashboard and management functionality, while waiters mainly work with orders. Role checks and order-access middleware help prevent users from performing actions outside their responsibilities.


## Decision 3

- **Chose:** Store the item name and price in each order line in addition to referencing the menu item.
- **Rejected:** Reading the current menu item name and price whenever an old order is displayed.
- **Why:** Menu items and prices may change over time. Keeping the name and price in the order line preserves the historical details of the order and prevents old bills from changing when the menu is updated.

## Decision 4

- **Chose:** Deploy the frontend and backend as separate services.
- **Rejected:** Running the frontend and backend together on a single server.
- **Why:** The frontend is a Vite-built React application and the backend is an Express service. Deploying them separately allows the frontend to be hosted on Vercel and the backend to be hosted on Render, while the backend connects to the PostgreSQL database hosted on Supabase.

## Decision 5

- **Chose:** Use an environment variable for the frontend origin in the backend CORS configuration.
- **Rejected:** Keeping the Vercel frontend URL permanently hardcoded in the backend source code.
- **Why:** The frontend URL changed during deployment. Using `process.env.CLIENT_URL` makes the backend configuration easier to update between local development and production without changing application code.

- **Later reversed:** An initial version used a hardcoded Vercel origin while testing the deployment. This was changed to the environment-based `CLIENT_URL` configuration after the production frontend URL changed and requests began failing with CORS errors.
