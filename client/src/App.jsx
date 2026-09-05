import { useEffect, useState } from "react";
import "./App.css";

// const API_URL = "http://localhost:3000/api";

const API_URL = "https://busy-restaurant-backend.onrender.com/api";

const validTransitions = {
  PLACED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["SERVED"],
  SERVED: [],
  CANCELLED: [],
};

function App() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [email, setEmail] = useState("manager@demo.local");
  const [password, setPassword] = useState("manager123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedMenuItem, setSelectedMenuItem] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState("");
  const [addingLine, setAddingLine] = useState(false);
  const [voidingLineId, setVoidingLineId] = useState(null);
  const [orderEvents, setOrderEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [archivedOrders, setArchivedOrders] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [exportDate, setExportDate] = useState(
  new Date().toISOString().slice(0, 10),
  );
  const [search, setSearch] = useState("");
  const [totalOrders, setTotalOrders] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("placedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [limit] = useState(5);
  const [dateFilter, setDateFilter] = useState("");
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [waiters, setWaiters] = useState([]);
  const [selectedWaiterId, setSelectedWaiterId] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);


  async function loadCurrentUser() {
    const response = await fetch(`${API_URL}/auth/me`, {
      credentials: "include",
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();

    if (data.user.role === "MANAGER") {
      await loadDashboard();
      await loadWaiters();
      await loadAlerts();
    }

    setUser(data.user);
    await loadOrders();
    await loadMenuItems();
  }

  useEffect(() => {
    loadCurrentUser().catch(() => {
      // The user is not logged in yet.
    });
  }, []);


  async function handleCreateOrder(event) {
    event.preventDefault();

    try {
      setCreatingOrder(true);
      setError("");

      const response = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          tableNumber: Number(newTableNumber),
          ...(user?.role === "MANAGER" && {
            primaryWaiterId: selectedWaiterId,
          }),
        }),
      });

      const data = await response.json();

      console.log("Create response:", data);

      if (!response.ok) {
        throw new Error(data.error || "Could not create order");
      }

      const createdOrderId = data.order?.id;

      console.log("Created order ID:", createdOrderId);

      if (!createdOrderId) {
        throw new Error("The server did not return an order ID");
      }

      setNewTableNumber("");
      setSelectedWaiterId("");
      setShowNewOrder(false);

      await loadOrders();

      console.log("Opening newly created order:", createdOrderId);
      await loadOrderDetails(createdOrderId);
    } catch (error) {
      console.error("Create order error:", error);
      setError(error.message);
    } finally {
      setCreatingOrder(false);
    }
  }

  async function loadOrders() {
    try {
      setOrdersLoading(true);

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (statusFilter) {
        params.set("status", statusFilter);
      }

      if (dateFilter) {
        params.set("date", dateFilter);
      }

      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("page", page);
      params.set("limit", limit);

      const response = await fetch(
        `${API_URL}/orders?${params.toString()}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Could not load orders");
      }

      const data = await response.json();

      setOrders(data.orders || data);
      setTotalOrders(data.total || data.orders?.length || 0);
    } catch (error) {
      setError(error.message);
    } finally {
      setOrdersLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user, page]);

  async function loadMenuItems() {
    const response = await fetch(`${API_URL}/menu`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Could not load menu items");
    }

    const data = await response.json();
    setMenuItems(data.menuItems || data);
  }  

  async function loadOrderDetails(orderId) {
    if (!orderId) {
      console.error("loadOrderDetails received an empty ID:", orderId);
      return;
    }

    setDetailsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/orders/${orderId}`, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load order details");
      }

      const order = data.order || data;

      setSelectedOrder({
        ...order,
        total: data.total,
      });

      await loadOrderEvents(orderId);
    } catch (detailsError) {
      console.error("Load order details error:", detailsError);
      setError(detailsError.message);
    } finally {
      setDetailsLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      setUser(data.user);
      await loadOrders();
      await loadMenuItems();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    setUser(null);
    setOrders([]);
    setSelectedOrder(null);
  }

  async function handleVoidLine(lineId) {
    const reason = window.prompt("Why is this item being voided?");

    if (!reason || !reason.trim()) {
      return;
    }

    setVoidingLineId(lineId);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/order-lines/${lineId}/void`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            reason: reason.trim(),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not void order item");
      }

      await loadOrders();
      await loadOrderDetails(selectedOrder.id);
    } catch (voidError) {
      setError(voidError.message);
    } finally {
      setVoidingLineId(null);
    }
  }

  async function handleAddNote() {
    if (!selectedOrder || !noteText.trim()) {
      return;
    }

    setAddingNote(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/orders/${selectedOrder.id}/notes`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            note: noteText.trim(),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add note");
      }

      setNoteText("");
      await loadOrderDetails(selectedOrder.id);
      await loadOrderEvents(selectedOrder.id);
    } catch (error) {
      setError(error.message);
    } finally {
      setAddingNote(false);
    }
  }

  async function handleAddLine(event) {
    event.preventDefault();

    if (!selectedOrder || !selectedMenuItem) {
      return;
    }

    setAddingLine(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/order-lines`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          orderId: selectedOrder.id,
          menuItemId: selectedMenuItem,
          quantity: Number(quantity),
          instructions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not add menu item");
      }

      setSelectedMenuItem("");
      setQuantity(1);
      setInstructions("");

      await loadOrders();
      await loadOrderDetails(selectedOrder.id);
    } catch (lineError) {
      const message = lineError.message.toLowerCase();

      if (
        message.includes("unavailable") ||
        message.includes("not available")
      ) {
        setError("This menu item is currently unavailable.");
      } else {
        setError(lineError.message);
      }

    } finally {
      setAddingLine(false);
    }
  }

  async function loadOrderEvents(orderId) {
    console.log("Loading events for order ID:", orderId);

    if (!orderId) {
      console.error("loadOrderEvents received an empty ID");
      return;
    }
    setEventsLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/orders/${orderId}/events`,
        {
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load order timeline");
      }

      setOrderEvents(data.events || data);
    } catch (error) {
      setError(error.message);
    } finally {
      setEventsLoading(false);
    }
  }

  async function handleStatusChange(nextStatus) {
    if (!selectedOrder) {
      return;
    }

    setError("");

    try {
      const response = await fetch(
        `${API_URL}/orders/${selectedOrder.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ status: nextStatus }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update order status");
      }

      await loadOrders();
      await loadOrderDetails(selectedOrder.id);
    } catch (statusError) {
      setError(statusError.message);
    }
  }

  async function loadAlerts() {
    try {
      setAlertsLoading(true);

      const response = await fetch(`${API_URL}/alerts`, {
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Could not load alerts");
      }

      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setAlertsLoading(false);
    }
  }

  async function handleAcknowledgeAlert(alertId) {
    try {
      const response = await fetch(
        `${API_URL}/alerts/${alertId}/acknowledge`,
        {
          method: "PATCH",
          credentials: "include",
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Could not acknowledge alert");
      }

      await loadAlerts();
    } catch (error) {
      setError(error.message);
    }
  }

  async function handleArchiveOrder() {
    if (!selectedOrder) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to archive this order?",
    );

    if (!confirmed) {
      return;
    }

    setError("");

    try {
      const response = await fetch(
        `${API_URL}/orders/${selectedOrder.id}/archive`,
        {
          method: "PATCH",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to archive order");
      }

      setSelectedOrder(null);
      await loadOrders();
    } catch (error) {
      setError(error.message);
    }
  }

  async function loadArchivedOrders() {
    setArchivedLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/orders/archived`,
        {
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load archived orders");
      }

      setArchivedOrders(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setArchivedLoading(false);
    }
  }

  async function handleRestoreOrder(orderId) {
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/orders/${orderId}/restore`,
        {
          method: "PATCH",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to restore order");
      }

      await loadArchivedOrders();
      await loadOrders();
    } catch (error) {
      setError(error.message);
    }
  }

  async function loadDashboard() {
    setDashboardLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/orders/dashboard/summary`,
        {
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load dashboard");
      }

      setDashboard(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setDashboardLoading(false);
    }
  }

  async function handleExportCsv() {
    try {
      if (!exportDate) {
        setError("Please select a date");
        return;
      }

      const response = await fetch(
        `${API_URL}/orders/export/csv?date=${exportDate}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Could not export orders");
      }

      const csvText = await response.text();

      const blob = new Blob([csvText], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `restaurant-orders-${exportDate}.csv`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      setError(error.message);
    }
  }

  async function loadWaiters() {
    try {
      const response = await fetch(`${API_URL}/auth/waiters`, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load waiters");
      }

      setWaiters(data.waiters || data);
    } catch (error) {
      setError(error.message);
    }
  }

  if (!user) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={handleLogin}>
          <p className="eyebrow">BUSY Restaurant</p>
          <h1>Order Management</h1>
          <p className="muted">
            Sign in to manage restaurant orders.
          </p>

          {error && <div className="error">{error}</div>}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className="demo-help">
            Manager: manager@demo.local / manager123
            <br />
            Waiter: waiter1@demo.local / waiter123
          </p>
        </form>
      </main>
    );
  }

  return (
    <main className="app-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">BUSY Restaurant</p>
          <h1>Order Management</h1>
        </div>

        <div className="user-area">
          <div>
            <strong>{user.name}</strong>
            <span>{user.role}</span>
          </div>

          <button className="secondary-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {user?.role === "MANAGER" && (
        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Manager dashboard</p>
              <h2>Today’s overview</h2>
            </div>

            <input
              type="date"
              value={exportDate}
              onChange={(event) => setExportDate(event.target.value)}
            />

            <button
              className="secondary-button"
              onClick={handleExportCsv}
            >
              Export CSV
            </button>

            <button
              className="secondary-button"
              onClick={loadDashboard}
            >
              Refresh dashboard
            </button>

          </div>

          {dashboardLoading ? (
            <p className="muted">Loading dashboard...</p>
          ) : dashboard ? (
            <>
              <div className="dashboard-grid">
                <div className="dashboard-card">
                  <span className="muted">Open orders</span>
                  <strong>{dashboard.summary.openOrders}</strong>
                </div>

                <div className="dashboard-card">
                  <span className="muted">Placed today</span>
                  <strong>{dashboard.summary.placedToday}</strong>
                </div>

                <div className="dashboard-card">
                  <span className="muted">Served today</span>
                  <strong>{dashboard.summary.servedToday}</strong>
                </div>

                <div className="dashboard-card">
                  <span className="muted">Revenue today</span>
                  <strong>
                    ₹{Number(dashboard.summary.revenueToday).toFixed(2)}
                  </strong>
                </div>
              </div>

              <div className="dashboard-breakdown">
                <h3>Orders by status</h3>

                {dashboard.byStatus?.length ? (
                  <div className="breakdown-list">
                    {dashboard.byStatus.map((item) => (
                      <div className="breakdown-row" key={item.status}>
                        <span>{item.status}</span>
                        <strong>{item.count}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No status data available.</p>
                )}
              </div>

              <div className="dashboard-breakdown">
                <h3>Orders by waiter</h3>

                {dashboard.byWaiter?.length ? (
                  <div className="breakdown-list">
                    {dashboard.byWaiter.map((item) => (
                      <div
                        className="breakdown-row"
                        key={item.waiter.id}
                      >
                        <span>{item.waiter.name}</span>
                        <strong>{item.count}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No waiter data available.</p>
                )}
              </div>

              <div className="dashboard-breakdown">
                <h3>Served orders — last 14 days</h3>

                {dashboard.servedLast14Days?.length ? (
                  <div className="served-chart">
                    {dashboard.servedLast14Days.map((item) => (
                      <div className="chart-column" key={item.date}>
                        <div className="chart-value">{item.served}</div>

                        <div
                          className="chart-bar"
                          style={{
                            height: `${Math.max(item.served * 35, 6)}px`,
                          }}
                        />

                        <span className="chart-label">
                          {new Date(`${item.date}T00:00:00`).toLocaleDateString(
                            "en-IN",
                            {
                              day: "2-digit",
                              month: "short",
                            },
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No served-order data available.</p>
                )}
              </div>
            </>
          ) : (
            <p className="muted">No dashboard data available.</p>
          )}
        </section>
      )}

      {error && <div className="error page-error">{error}</div>}

      <section className="welcome-card">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>Welcome back, {user.name}</h2>
          <p className="muted">
            Select an order to view its details and update its status.
          </p>
        </div>

        <button onClick={loadOrders}>Refresh orders</button>
      </section>

      {user?.role === "MANAGER" && (
        <div className="archive-actions">
          <button
            className="secondary-button"
            onClick={() => {
              const nextValue = !showArchived;
              setShowArchived(nextValue);

              if (nextValue) {
                loadArchivedOrders();
              }
            }}
          >
            {showArchived ? "Show active orders" : "Show archived orders"}
          </button>
        </div>
      )}

      {showArchived && user?.role === "MANAGER" && (
        <section className="orders-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Manager view</p>
              <h2>Archived orders</h2>
            </div>
          </div>

          {archivedLoading ? (
            <p className="muted">Loading archived orders...</p>
          ) : archivedOrders.length === 0 ? (
            <p className="muted">No archived orders found.</p>
          ) : (
            <>
              <div className="order-list">
                {archivedOrders.map((order) => (
                  <div className="order-card" key={order.id}>
                    <div>
                      <p className="eyebrow">
                        Table {order.tableNumber}
                      </p>

                      <h3>{order.status}</h3>

                      <p className="muted">
                        Waiter: {order.primaryWaiter?.name || "Unassigned"}
                      </p>

                      <p className="muted">
                        Total: ₹{order.total}
                      </p>

                      <p className="muted">
                        Archived:{" "}
                        {order.archivedAt
                          ? new Date(order.archivedAt).toLocaleString()
                          : "Unknown"}
                      </p>
                    </div>

                    <button
                      className="secondary-button"
                      onClick={() => handleRestoreOrder(order.id)}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>

              <div className="pagination">
                <button
                  className="secondary-button"
                  disabled={page === 1}
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                >
                  Previous
                </button>

                <span>
                  Page {page} of {Math.max(1, Math.ceil(totalOrders / limit))}
                </span>
                <button
                  className="secondary-button"
                  disabled={page >= Math.ceil(totalOrders / limit)}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </section>
      )}


      {user?.role === "MANAGER" && (
        <section className="alerts-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Monitoring</p>
              <h2>Slow-order alerts</h2>
            </div>

            <button
              className="secondary-button"
              onClick={loadAlerts}
              disabled={alertsLoading}
            >
              {alertsLoading ? "Refreshing..." : "Refresh alerts"}
            </button>
          </div>

          {alerts.length === 0 ? (
            <p className="muted">No slow orders right now.</p>
          ) : (
            <div className="alert-list">
              {alerts.map((alert) => (
                <div className="alert-card" key={alert.id}>
                  <div>
                    <strong>
                      Table {alert.order.tableNumber}
                    </strong>

                    <p>
                      Waiter:{" "}
                      {alert.order.primaryWaiter?.name || "Unassigned"}
                    </p>

                    <p className="muted">
                      Order ID: {alert.order.id}
                    </p>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                  >
                    Acknowledge
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      

      <section className="orders-section">
        <div className="section-heading">
          <div className="orders-top-row">
            <div className="orders-title">
              <p className="eyebrow">Orders</p>

              <div className="orders-title-line">
                <h2>Active orders</h2>

                <button
                  className="primary-button"
                  onClick={() => setShowNewOrder(true)}
                >
                  New Order
                </button>
              </div>
            </div>

            <span className="count-badge">
              {totalOrders} orders
            </span>
          </div>

          <div className="order-filters">
            <div className="filter-group search-filter">
              <label htmlFor="order-search">Search</label>

              <input
                id="order-search"
                type="search"
                placeholder="Table or waiter..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="filter-group">
              <label htmlFor="status-filter">Status</label>

              <select
                id="status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All status</option>
                <option value="PLACED">Placed</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="PREPARING">Preparing</option>
                <option value="READY">Ready</option>
                <option value="SERVED">Served</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="sort-filter">Sort by</label>

              <select
                id="sort-filter"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="placedAt">Placed date</option>
                <option value="status">Status</option>
                <option value="tableNumber">Table number</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="order-filter">Order</label>

              <select
                id="order-filter"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>

            <button
              className="secondary-button filter-button"
              onClick={loadOrders}
            >
              Search
            </button>

            <button
              className="clear-button"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setSortBy("placedAt");
                setSortOrder("desc");
                setPage(1);
              }}
            >
              Clear
            </button>
          </div>

          <span className="count-badge">{orders.length}</span>
        </div>

        {showNewOrder && (
          <form className="new-order-form" onSubmit={handleCreateOrder}>
            <div>
              <label htmlFor="new-table-number">Table number</label>

              <input
                id="new-table-number"
                type="number"
                min="1"
                value={newTableNumber}
                onChange={(event) => setNewTableNumber(event.target.value)}
                placeholder="Enter table number"
                required
              />
            </div>

            {user?.role === "MANAGER" && (
              <div>
                <label htmlFor="primary-waiter">Primary waiter</label>

                <select
                  id="primary-waiter"
                  value={selectedWaiterId}
                  onChange={(event) => setSelectedWaiterId(event.target.value)}
                  required
                >
                  <option value="">Select a waiter</option>

                  {waiters.map((waiter) => (
                    <option key={waiter.id} value={waiter.id}>
                      {waiter.name} — {waiter.email}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={creatingOrder}
              >
                {creatingOrder ? "Creating..." : "Create Order"}
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowNewOrder(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {orders.length === 0 ? (
          <div className="empty-state">
            No active orders found.
          </div>
        ) : (
          <div className="orders-grid">
            {orders.map((order) => (
              <button
                className="order-card"
                key={order.id}
                onClick={() => loadOrderDetails(order.id)}
              >
                <div className="order-card-top">
                  <div>
                    <p className="muted">Table</p>
                    <h3>{order.tableNumber}</h3>
                  </div>

                  <span
                    className={`status status-${order.status.toLowerCase()}`}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="order-details">
                  <p>
                    <strong>Waiter:</strong>{" "}
                    {order.primaryWaiter?.name || "Unassigned"}
                  </p>
                  <p>
                    <strong>Placed:</strong>{" "}
                    {new Date(order.placedAt).toLocaleString()}
                  </p>
                  <p>
                    <strong>Total:</strong> ₹{order.total}
                  </p>
                </div>

                <p className="order-id">Click to view details</p>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedOrder && (
        <section className="details-panel">
          <div className="details-header">
            <div>
              <p className="eyebrow">Order details</p>
              <h2>Table {selectedOrder.tableNumber}</h2>
              <p className="muted">
                Order ID: {selectedOrder.id}
              </p>
            </div>

            {user?.role === "MANAGER" && (
              <button
                className="secondary-button"
                onClick={handleArchiveOrder}
              >
                Archive
              </button>
            )}

            <button
              className="secondary-button"
              onClick={() => setSelectedOrder(null)}
            >
              Close
            </button>
          </div>

          {detailsLoading ? (
            <p className="muted">Loading order details...</p>
          ) : (
            <>
              <div className="details-summary">
                <div>
                  <span className="muted">Current status</span>
                  <strong>{selectedOrder.status}</strong>
                </div>

                <div>
                  <span className="muted">Order total</span>
                  <strong>₹{selectedOrder.total}</strong>
                </div>
              </div>

              <h3>Order lines</h3>

              {selectedOrder.lines?.length ? (
                <div className="line-list">
                  {selectedOrder.lines.map((line) => (
                    <div
                      className={`line-item ${line.voidedAt ? "voided-line" : ""}`}
                      key={line.id}
                    >
                      <div>
                        <strong>
                          {line.menuItem?.name || "Menu item"}
                          {line.voidedAt && <span className="voided-label"> VOIDED</span>}
                        </strong>
                        <p className="muted">
                          Quantity: {line.quantity}
                        </p>

                        {line.instructions && (
                          <p className="muted">
                            Instructions: {line.instructions}
                          </p>
                        )}

                        {line.voidReason && (
                          <p className="void-reason">
                            Reason: {line.voidReason}
                          </p>
                        )}
                      </div>

                      <div className="line-actions">
                        <strong>
                          ₹{(Number(line.unitPrice) * line.quantity).toFixed(2)}
                        </strong>

                        {!line.voidedAt &&
                          !["SERVED", "CANCELLED"].includes(selectedOrder.status) && (
                            <button
                              type="button"
                              className="void-button"
                              disabled={voidingLineId === line.id}
                              onClick={() => handleVoidLine(line.id)}
                            >
                              {voidingLineId === line.id ? "Voiding..." : "Void item"}
                            </button>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">No order lines found.</p>
              )}

              {!["SERVED", "CANCELLED"].includes(selectedOrder.status) && (
                <>
                {error && <div className="error">{error}</div>}
                  <h3>Add menu item</h3>

                  <form className="add-line-form" onSubmit={handleAddLine}>
                    <label>
                      Menu item
                      <select
                        value={selectedMenuItem}
                        onChange={(event) => setSelectedMenuItem(event.target.value)}
                        required
                      >
                        <option value="">Select an item</option>

                        {menuItems.map((item) => (
                          <option
                            key={item.id}
                            value={item.id}
                            disabled={!item.available}
                          >
                            {item.name} — ₹{item.price}
                            {!item.available ? " — Unavailable" : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Quantity
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                        required
                      />
                    </label>

                    <label>
                      Instructions
                      <input
                        type="text"
                        value={instructions}
                        onChange={(event) => setInstructions(event.target.value)}
                        placeholder="Optional instructions"
                      />
                    </label>

                    <button type="submit" disabled={addingLine}>
                      {addingLine ? "Adding..." : "Add item"}
                    </button>
                  </form>
                </>
              )}

              {selectedOrder.status !== "SERVED" &&
                selectedOrder.status !== "CANCELLED" && (
                  <div className="note-form">
                    <h3>Add order note</h3>

                    <textarea
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      placeholder="Enter a customer request or order note..."
                      rows={3}
                    />

                    <button
                      type="button"
                      onClick={handleAddNote}
                      disabled={addingNote || !noteText.trim()}
                    >
                      {addingNote ? "Adding..." : "Add Note"}
                    </button>
                  </div>
                )}

              <h3>Order timeline</h3>

              {eventsLoading ? (
                <p className="muted">Loading timeline...</p>
              ) : orderEvents.length ? (
                <div className="timeline">
                  {orderEvents.map((event) => (
                    <div className="timeline-item" key={event.id}>
                      <div className="timeline-dot" />

                      <div className="timeline-content">
                        <strong>
                          {event.eventType.replaceAll("_", " ")}
                        </strong>

                        <p className="muted">
                          {new Date(event.createdAt).toLocaleString()}
                        </p>

                        {event.oldStatus && event.newStatus && (
                          <p>
                            Status changed from{" "}
                            <strong>{event.oldStatus}</strong> to{" "}
                            <strong>{event.newStatus}</strong>
                          </p>
                        )}

                        {event.note && <p>Note: {event.note}</p>}

                        {event.reason && <p>Reason: {event.reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">No timeline events found.</p>
              )}

              <h3>Change status</h3>

              <div className="status-actions">
                {validTransitions[selectedOrder.status].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                  >
                    Mark as {status}
                  </button>
                ))}
              </div>

              {validTransitions[selectedOrder.status].length === 0 && (
                <p className="muted">
                  This order has no further valid status transitions.
                </p>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}

export default App;