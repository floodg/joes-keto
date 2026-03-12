import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import "./Layout.css";

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  const closeMenu = () => setMenuOpen(false);

  const handleSignOut = async () => {
    closeMenu();
    try {
      await signOut();
    } catch {
      // sign out best-effort; navigate regardless
    }
    navigate("/login");
  };

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="nav-brand">
          <h1>🥑 Joe's Keto</h1>
        </div>
        <button
          className={`hamburger${menuOpen ? " open" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
        <div className={`nav-links${menuOpen ? " open" : ""}`}>
          <Link to="/dashboard" className={location.pathname === "/dashboard" ? "active" : ""} onClick={closeMenu}>Dashboard</Link>
          <Link to="/meals" className={location.pathname === "/meals" ? "active" : ""} onClick={closeMenu}>Meals</Link>
          <Link to="/plan" className={location.pathname === "/plan" ? "active" : ""} onClick={closeMenu}>Weekly Plan</Link>
          <Link to="/training" className={location.pathname === "/training" ? "active" : ""} onClick={closeMenu}>Training</Link>
          <Link to="/workouts" className={location.pathname === "/workouts" ? "active" : ""} onClick={closeMenu}>Workouts</Link>
          <Link to="/shopping" className={location.pathname === "/shopping" ? "active" : ""} onClick={closeMenu}>Shopping</Link>
          <Link to="/shopping-trips" className={location.pathname === "/shopping-trips" ? "active" : ""} onClick={closeMenu}>Shopping Trips</Link>
          <Link to="/inventory" className={location.pathname === "/inventory" ? "active" : ""} onClick={closeMenu}>Inventory</Link>
          {profile?.role === 'admin' && (
            <>
              <Link to="/store-products" className={location.pathname === "/store-products" ? "active" : ""} onClick={closeMenu}>Store Products</Link>
              <Link to="/admin" className={location.pathname === "/admin" ? "active" : ""} onClick={closeMenu}>Admin</Link>
            </>
          )}
          <button className="nav-logout" onClick={handleSignOut}>Log Out</button>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
