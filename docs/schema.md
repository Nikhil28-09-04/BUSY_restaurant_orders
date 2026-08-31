# Schema

## Overview

The application uses PostgreSQL as the primary relational database. The schema is designed around:
- restaurant users
- menu items, orders
- order lines
- order collaborators
- immutable order events
- slow-order alerts.

## Tables

### 1. users

Stores application users and their roles.

Column              Type

id               UUID                 Primary key
name             VARCHAR(100)         NOT NULL
email            VARCHAR(255)         UNIQUE
password_hash    VARCHAR(255)         NOT NULL
role             ENUM                 NOT NULL (`MANAGER`, `WAITER`)
archived_at      TIMESTAMP            NULL
created_at       TIMESTAMP            NOT NULL
updated_at       TIMESTAMP            NOT NULL

A user can be either a manager or waiter.


### 2. menu_items

Stores the current restaurant menu.

Column       Type           Constraints

id           UUID           Primary key
name         VARCHAR(150)   NOT NULL
price        DECIMAL(10,2)  NOT NULL, >= 0
available    BOOLEAN        NOT NULL
archived_at  TIMESTAMP      NULL
created_at   TIMESTAMP      NOT NULL
updated_at   TIMESTAMP      NOT NULL



### 3. orders

Represents a restaurant order.

Column             Type         Constraints

id                 UUID         Primary key
table_number       VARCHAR(20)  NOT NULL
primary_waiter_id  UUID         NOT NULL, FK → users.id
status             ENUM         NOT NULL
placed_at          TIMESTAMP    NOT NULL
archived_at        TIMESTAMP    NULL
created_at         TIMESTAMP    NOT NULL
updated_at         TIMESTAMP    NOT NULL

Order status values are:

- PLACED
- ACCEPTED
- PREPARING
- READY
- SERVED
- CANCELLED

Every order has one primary waiter.


### 4. order_lines

Stores the individual menu items belonging to an order.

Column        Type           Constraints

id            UUID           Primary key
order_id      UUID           NOT NULL, FK → orders.id
menu_item_id  UUID           NOT NULL, FK → menu_items.id
quantity      INTEGER        NOT NULL, > 0
unit_price    DECIMAL(10,2)  NOT NULL, >= 0
instructions  TEXT           NULL
voided_at     TIMESTAMP      NULL
void_reason   TEXT           NULL
created_at    TIMESTAMP      NOT NULL

`unit_price` ensures that historical price remains same even if menu price changes in future.

Line totals are calculated as:

`quantity × unit_price`

Only non-voided lines contribute to the order total.


### 5. order_collaborators

Represents additional waiters working on an order.

Column            Type       Constraints

order_id          UUID       FK → orders.id
user_id           UUID       FK → users.id
added_by_user_id  UUID       FK → users.id
created_at        TIMESTAMP  NOT NULL

The composite key is:

`(order_id, user_id)`

This prevents the same waiter from being added to the same order more than once.


### 6. order_events

Stores the immutable order timeline.

Column         Type       Constraints

id             UUID       Primary key
order_id       UUID       NOT NULL, FK → orders.id
actor_user_id  UUID       NOT NULL, FK → users.id
event_type     ENUM       NOT NULL
old_status     ENUM       NULL
new_status     ENUM       NULL
order_line_id  UUID       NULL, FK → order_lines.id
reason         TEXT       NULL
note           TEXT       NULL
metadata       JSONB      NULL
created_at     TIMESTAMP  NOT NULL

Possible event types include:

- ORDER_CREATED
- STATUS_CHANGED
- LINE_ADDED
- LINE_VOIDED
- NOTE_ADDED
- COLLABORATOR_ADDED
- COLLABORATOR_REMOVED

Events are append-only.
This table is used to provide the immutable order timeline required by the application.


### 7. order_alerts

Stores acknowledgement state for slow-order alerts.

Column           Type       Constraints

id               UUID       Primary key
order_id         UUID       NOT NULL, FK → orders.id
acknowledged_by  UUID       NULL, FK → users.id
acknowledged_at  TIMESTAMP  NULL
next_alert_at    TIMESTAMP  NULL
created_at       TIMESTAMP  NOT NULL
updated_at       TIMESTAMP  NOT NULL

The order's timestamps are used to determine whether it has become slow.
The alert record primarily tracks acknowledgement and when an alert may appear again.



## Relationships

### One-to-many relationships

- One user can be the primary waiter for many orders.
- One user can create many order events.
- One order has many order lines.
- One order has many order events.
- One menu item can appear in many order lines.
- One order can have many alert records.

### Many-to-many relationship

Orders and waiters have a many-to-many relationship through `order_collaborators`.

An order has one primary waiter `orders.primary_waiter_id`.
While additional participating waiters are represented by `order_collaborators`.



## Database Constraints vs Application Constraints

### Database constraints

The database should enforce fundamental data integrity:

- Primary keys
- Foreign keys
- Unique user email
- Valid enum values
- Positive order-line quantities
- Non-negative menu-item prices
- Non-negative order-line price
- Required relationships
- Unique `(order_id, user_id)` collaborator pairs

### Application constraints

The backend should enforce business rules that require application context:

- Manager versus waiter permissions
- Whether a waiter can modify a particular order
- Whether a waiter is the primary waiter or collaborator
- Valid order status transitions
- Cancellation rules
- Whether an order is still open
- Whether an order line can be voided
- Requirement for a void reason
- Server-side price snapshotting
- Alert acknowledgement and reappearance rules




## Deliberate Denormalization

The main deliberate duplication is `order_lines.unit_price`.

The current price is already stored in `menu_items.price`, but the order line stores the price used when the line was added.

This is intentional because the two values represent different events:

- `menu_items.price` = current selling price
- `order_lines.unit_price` = historical transaction price

Without the history, changing a menu item's price would incorrectly change the value of historical orders.

The `metadata` JSONB field in `order_events` is also intentionally flexible for small pieces of event-specific information that do not need to become permanent relational columns. Core fields that need reliable querying remain structured columns.




## Scaling Considerations

At approximately 100× the current data volume, the first pressure points are expected to be:

### Order events

`order_events` will grow quickly because many actions can create events.

Indexes around `order_id` and `created_at` will be important for retrieving timelines efficiently.

### Order search

Order filtering and sorting will require indexes around commonly queried fields such as:

- `status`
- `primary_waiter_id`
- `placed_at`
- `table_number`

Search queries should use database indexes rather than loading large datasets into the browser.

### Dashboard aggregation

Repeatedly calculating revenue, status counts, waiter counts, and 14-day trends from increasingly large transactional tables could become expensive.

At larger scale, possible improvements include:

- Pre-aggregated daily statistics
- Materialized views
- Caching
- Dedicated reporting tables