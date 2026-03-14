import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { PlannedMeal, Meal, MealTime, MealStatus } from "../../domain/types";
import { getPlannedMeals, createPlannedMeal, deletePlannedMeal } from "../planner/api";
import { getMealsForUser } from "../meals/api";
import { useAuth } from "../../context/AuthProvider";
import { changePlannedMealStatusWithInventory } from "../mealCompletion";
import { formatDateLocal, getMondayLocal } from "../../lib/dateUtils";
import "./PlanPage.css";

const MEAL_TIMES: MealTime[] = ["breakfast", "lunch", "dinner", "snack"];
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function PlanPage() {
  const { user } = useAuth();
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMondayLocal(new Date()));
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalDate, setModalDate] = useState("");
  const [modalTime, setModalTime] = useState<MealTime>("breakfast");
  const [modalServings, setModalServings] = useState(1);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pm, m] = await Promise.all([getPlannedMeals(), getMealsForUser()]);
      setPlannedMeals(pm);
      setMeals(m);
    } finally {
      setLoading(false);
    }
  };

  const getWeekDates = () => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getMealForSlot = (date: Date, time: MealTime): PlannedMeal | undefined => {
    const dateStr = formatDateLocal(date);
    return plannedMeals.find(pm => pm.date === dateStr && pm.time === time);
  };

  const getMealName = (mealId: string): string => {
    return meals.find(m => m.id === mealId)?.name || "Unknown meal";
  };

  const handleAddMeal = (date: Date, time: MealTime) => {
    setModalDate(formatDateLocal(date));
    setModalTime(time);
    setModalServings(1);
    setShowAddModal(true);
  };

  const handleSaveModal = async (mealId: string, servings: number) => {
    if (!user) return;
    try {
      await createPlannedMeal({
        date: modalDate,
        time: modalTime,
        mealId,
        userId: user.id,
        status: 'planned',
        servings,
      });
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to add meal to plan. Please try again.");
    }
    setShowAddModal(false);
  };

  const handleRemoveMeal = async (id: string) => {
    if (!confirm("Remove this meal from the plan?")) return;
    try {
      await deletePlannedMeal(id);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to remove meal. Please try again.");
    }
  };

  const handleStatusChange = async (pm: PlannedMeal, newStatus: MealStatus) => {
    if (!user || updatingId === pm.id) return;
    setUpdatingId(pm.id);
    try {
      const meal = meals.find(m => m.id === pm.mealId);
      const updated = await changePlannedMealStatusWithInventory({
        plannedMeal: pm,
        meal,
        newStatus,
        userId: user.id,
      });
      setPlannedMeals(prev =>
        prev.map(m => (m.id === pm.id ? { ...m, status: updated.status } : m))
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update meal status. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  const previousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const thisWeek = () => {
    setCurrentWeekStart(getMondayLocal(new Date()));
  };

  const weekDates = getWeekDates();

  if (loading) return <div className="plan-page"><p style={{ padding: '2rem' }}>Loading plan…</p></div>;

  return (
    <div className="plan-page">
      <div className="page-header">
        <h1>📅 Weekly Meal Plan</h1>
        <div className="week-navigation">
          <button className="btn" onClick={previousWeek}>← Previous</button>
          <button className="btn" onClick={thisWeek}>This Week</button>
          <button className="btn" onClick={nextWeek}>Next →</button>
        </div>
      </div>

      <div className="week-display">
        <strong>Week of:</strong> {formatDateLocal(weekDates[0])} to {formatDateLocal(weekDates[6])}
      </div>

      <div className="plan-grid-wrapper">
        <div className="plan-grid">
        <div className="plan-header">
          <div className="time-column">Time</div>
          {weekDates.map((date, i) => (
            <div key={i} className="day-column">
              <div className="day-name">{DAYS_OF_WEEK[i]}</div>
              <div className="day-date">{date.getDate()}/{date.getMonth() + 1}</div>
            </div>
          ))}
        </div>

        {MEAL_TIMES.map(time => (
          <div key={time} className="plan-row">
            <div className="time-cell">{time}</div>
            {weekDates.map((date, i) => {
              const plannedMeal = getMealForSlot(date, time);
              return (
                <div key={i} className="meal-cell">
                  {plannedMeal ? (
                    <div className="planned-meal">
                      <div className="meal-name">{getMealName(plannedMeal.mealId)}</div>
                      {plannedMeal.servings > 1 && (
                        <div className="meal-servings">×{plannedMeal.servings}</div>
                      )}
                      <div className="meal-status-row">
                        <span className={`status-badge status-badge--${plannedMeal.status}`}>
                          {plannedMeal.status === 'completed'
                            ? '✓ Eaten'
                            : plannedMeal.status === 'skipped'
                            ? 'Skipped'
                            : 'Planned'}
                        </span>
                        {plannedMeal.status === 'planned' && (
                          <div className="status-actions">
                            <button
                              className="btn btn-small"
                              onClick={() => handleStatusChange(plannedMeal, 'completed')}
                              disabled={updatingId === plannedMeal.id}
                            >
                              ✓
                            </button>
                            <button
                              className="btn btn-small"
                              onClick={() => handleStatusChange(plannedMeal, 'skipped')}
                              disabled={updatingId === plannedMeal.id}
                            >
                              Skip
                            </button>
                          </div>
                        )}
                      </div>
                      <button 
                        className="remove-btn"
                        onClick={() => handleRemoveMeal(plannedMeal.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="add-btn"
                      onClick={() => handleAddMeal(date, time)}
                    >
                      + Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        </div>
      </div>

      {showAddModal && (
        <AddMealModal
          meals={meals}
          initialServings={modalServings}
          onSave={handleSaveModal}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      <section className="plan-page-links">
        <h2>Jump to related views</h2>
        <div className="button-group">
          <Link to="/dashboard" className="btn">
            Today's Dashboard
          </Link>
          <Link to="/meals" className="btn">
            Manage Meals
          </Link>
          <Link to="/shopping" className="btn">
            Shopping List
          </Link>
          <Link to="/shopping-trips" className="btn">
            Shopping Trips
          </Link>
          <Link to="/inventory" className="btn btn-secondary">
            Inventory
          </Link>
        </div>
      </section>
    </div>
  );
}

interface AddMealModalProps {
  meals: Meal[];
  initialServings: number;
  onSave: (mealId: string, servings: number) => void;
  onCancel: () => void;
}

function AddMealModal({ meals, initialServings, onSave, onCancel }: AddMealModalProps) {
  const [selectedMealId, setSelectedMealId] = useState("");
  const [servings, setServings] = useState(initialServings);

  const handleSave = () => {
    if (!selectedMealId) {
      alert("Please select a meal");
      return;
    }
    onSave(selectedMealId, servings);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Add Meal to Plan</h2>
        <div className="form-group">
          <label>Select Meal</label>
          <select 
            value={selectedMealId} 
            onChange={e => setSelectedMealId(e.target.value)}
            className="meal-select"
          >
            <option value="">-- Choose a meal --</option>
            {meals.map(meal => (
              <option key={meal.id} value={meal.id}>{meal.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Servings</label>
          <input
            type="number"
            min={1}
            value={servings}
            onChange={e => setServings(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="servings-input"
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleSave}>Add</button>
          <button className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

