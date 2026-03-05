import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import "./Layout.css";

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const closeMenu = () => setMenuOpen(false);

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
          <Link to="/" className={location.pathname === "/" ? "active" : ""} onClick={closeMenu}>Dashboard</Link>
          <Link to="/meals" className={location.pathname === "/meals" ? "active" : ""} onClick={closeMenu}>Meals</Link>
          <Link to="/plan" className={location.pathname === "/plan" ? "active" : ""} onClick={closeMenu}>Weekly Plan</Link>
          <Link to="/workouts" className={location.pathname === "/workouts" ? "active" : ""} onClick={closeMenu}>Workouts</Link>
          <Link to="/shopping" className={location.pathname === "/shopping" ? "active" : ""} onClick={closeMenu}>Shopping</Link>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
