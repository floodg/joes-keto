import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { PlannedMeal, PlannedWorkout, Meal, Workout } from "../domain/types";
import { 
  getPlannedMeals, 
  getPlannedWorkouts, 
  getMealById, 
  getWorkoutById 
} from "../storage/dataService";
import "./Dashboard.css";

export default function Dashboard() {
  const [todaysMeals, setTodaysMeals] = useState<Array<PlannedMeal & { meal?: Meal }>>([]);
  const [todaysWorkouts, setTodaysWorkouts] = useState<Array<PlannedWorkout & { workout?: Workout }>>([]);

  useEffect(() => {
    loadTodaysData();
  }, []);

  const loadTodaysData = () => {
    const today = new Date().toISOString().split('T')[0];
    
    // Load today's meals
    const plannedMeals = getPlannedMeals().filter(pm => pm.date === today);
    const mealsWithData = plannedMeals.map(pm => ({
      ...pm,
      meal: getMealById(pm.mealId)
    }));
    setTodaysMeals(mealsWithData);

    // Load today's workouts
    const plannedWorkouts = getPlannedWorkouts().filter(pw => pw.date === today);
    const workoutsWithData = plannedWorkouts.map(pw => ({
      ...pw,
      workout: getWorkoutById(pw.workoutId)
    }));
    setTodaysWorkouts(workoutsWithData);
  };

  const formatMealTime = (time: string) => {
    return time.charAt(0).toUpperCase() + time.slice(1);
  };

  return (
    <div className="dashboard">
      <h1>Today's Plan</h1>
      <p className="date">{new Date().toLocaleDateString('en-AU', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}</p>

      <div className="dashboard-grid">
        <section className="dashboard-section">
          <h2>🍽️ Meals</h2>
          {todaysMeals.length === 0 ? (
            <p className="empty-message">No meals planned for today</p>
          ) : (
            <div className="items-list">
              {todaysMeals.map(pm => (
                <div key={pm.id} className="item-card">
                  <div className="item-time">{formatMealTime(pm.time)}</div>
                  <div className="item-name">{pm.meal?.name || "Unknown meal"}</div>
                  {pm.notes && <div className="item-notes">{pm.notes}</div>}
                </div>
              ))}
            </div>
          )}
          <Link to="/plan" className="section-link">View Weekly Plan →</Link>
        </section>

        <section className="dashboard-section">
          <h2>💪 Workouts</h2>
          {todaysWorkouts.length === 0 ? (
            <p className="empty-message">No workouts scheduled for today</p>
          ) : (
            <div className="items-list">
              {todaysWorkouts.map(pw => (
                <div key={pw.id} className="item-card">
                  {pw.time && <div className="item-time">{pw.time}</div>}
                  <div className="item-name">{pw.workout?.name || "Unknown workout"}</div>
                  {pw.notes && <div className="item-notes">{pw.notes}</div>}
                </div>
              ))}
            </div>
          )}
          <Link to="/workouts" className="section-link">View All Workouts →</Link>
        </section>
      </div>

      <section className="quick-links">
        <h2>Quick Actions</h2>
        <div className="button-group">
          <Link to="/meals" className="btn btn-primary">Browse Meals</Link>
          <Link to="/shopping" className="btn btn-primary">Shopping List</Link>
          <Link to="/plan" className="btn btn-primary">Plan Week</Link>
        </div>
      </section>
    </div>
  );
}
