import { Link, Outlet } from "react-router-dom";
import "./Layout.css";

export default function Layout() {
  return (
    <div className="layout">
      <nav className="navbar">
        <div className="nav-brand">
          <h1>🥑 Joe's Keto</h1>
        </div>
        <div className="nav-links">
          <Link to="/">Dashboard</Link>
          <Link to="/meals">Meals</Link>
          <Link to="/plan">Weekly Plan</Link>
          <Link to="/workouts">Workouts</Link>
          <Link to="/shopping">Shopping</Link>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
