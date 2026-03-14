import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { PlannedMeal, Meal, MealTime, MealStatus } from "../../domain/types";
import { getPlannedMeals, createPlannedMeal, deletePlannedMeal } from "../planner/api";
import { getMealsForUser } from "../meals/api";
import { useAuth } from "../../context/AuthProvider";
import { changePlannedMealStatusWithInventory } from "../mealCompletion";
import "./PlanPage.css";

const MEAL_TIMES: MealTime[] = ["breakfast", "lunch", "dinner", "snack"];
const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function PlanPage() {
  const { user } = useAuth();
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonday(new Date()));
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalDate, setModalDate] = useState("");
  const [modalTime, setModalTime] = useState<MealTime>("breakfast");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

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

  const todayStr = new Date().toISOString().split("T")[0];

  const getMealForSlot = (date: Date, time: MealTime): PlannedMeal | undefined => {
    const dateStr = formatDate(date);
    return plannedMeals.find(pm => pm.date === dateStr && pm.time === time);
  };

  const getMealName = (mealId: string): string =>
    meals.find(m => m.id === mealId)?.name || "Unknown meal";

  const handleAddMeal = (date: Date, time: MealTime) => {
    setModalDate(formatDate(date));
    setModalTime(time);
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
        status: "planned",
        servings,
      });
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to add meal to plan.");
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
    } finally {
      setUpdatingId(null);
    }
  };

  const weekDates = getWeekDates();

  if (loading) {
    return (
      <div className="plan-page">
        <p style={{ padding: "2rem", color: "#9ca3af" }}>Loading plan…</p>
      </div>
    );
  }

  return (
    <div className="plan-page">
      <div className="page-header">
        <h1>📅 Weekly Meal Plan</h1>
        <div className="week-navigation">
          <button className="btn btn-ghost" onClick={() => {
            const d = new Date(currentWeekStart);
            d.setDate(d.getDate() - 7);
            setCurrentWeekStart(d);
          }}>← Prev</button>
          <button className="btn btn-ghost" onClick={() => setCurrentWeekStart(getMonday(new Date()))}>
            Today
          </button>
          <button className="btn btn-ghost" onClick={() => {
            const d = new Date(currentWeekStart);
            d.setDate(d.getDate() + 7);
            setCurrentWeekStart(d);
          }}>Next →</button>
        </div>
      </div>

      <div className="week-display">
        <strong>Week of:</strong> {formatDate(weekDates[0])} → {formatDate(weekDates[6])}
      </div>

      <div className="plan-grid-wrapper">
        <div className="plan-grid">
          {/* Header */}
          <div className="plan-header">
            <div className="time-column">Time</div>
            {weekDates.map((date, i) => {
              const ds = formatDate(date);
              return (
                <div key={i} className={`day-column${ds === todayStr ? " today" : ""}`}>
                  <div className="day-name">{DAYS_FULL[i]}</div>
                  <div className="day-date">{date.getDate()}/{date.getMonth() + 1}</div>
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {MEAL_TIMES.map(time => (
            <div key={time} className="plan-row">
              <div className="time-cell">{time}</div>
              {weekDates.map((date, i) => {
                const ds = formatDate(date);
                const pm = getMealForSlot(date, time);
                const isToday = ds === todayStr;
                const isUpdating = pm ? updatingId === pm.id : false;

                return (
                  <div key={i} className={`meal-cell${isToday ? " today-col" : ""}`}>
                    {pm ? (
                      <div className={`planned-meal status-${pm.status}`}>
                        {/* Delete – only visible on hover via CSS */}
                        <button
                          className="delete-btn"
                          onClick={() => handleRemoveMeal(pm.id)}
                          title="Remove"
                          aria-label="Remove meal"
                        >
                          ✕
                        </button>

                        <span className="meal-name">{getMealName(pm.mealId)}</span>

                        {pm.servings > 1 && (
                          <span className="meal-servings">×{pm.servings}</span>
                        )}

                        {pm.status === "completed" && (
                          <span className="status-pill eaten">✓ Eaten</span>
                        )}
                        {pm.status === "skipped" && (
                          <span className="status-pill skipped">Skipped</span>
                        )}

                        {pm.status === "planned" && (
                          <div className="meal-actions">
                            <button
                              className="action-btn eat"
                              disabled={isUpdating}
                              onClick={() => handleStatusChange(pm, "completed")}
                              title="Mark as eaten"
                            >
                              {isUpdating ? "…" : "✓ Eat"}
                            </button>
                            <button
                              className="action-btn skip"
                              disabled={isUpdating}
                              onClick={() => handleStatusChange(pm, "skipped")}
                              title="Skip this meal"
                            >
                              Skip
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        className="add-btn"
                        onClick={() => handleAddMeal(date, time)}
                        title={`Add ${time} on ${DAYS_FULL[i]}`}
                      >
                        +
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
          date={modalDate}
          time={modalTime}
          onSave={handleSaveModal}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      <section className="plan-page-links">
        <h2>Jump to</h2>
        <div className="button-group">
          <Link to="/dashboard" className="btn btn-ghost">Dashboard</Link>
          <Link to="/meals" className="btn btn-ghost">Manage Meals</Link>
          <Link to="/shopping" className="btn btn-ghost">Shopping List</Link>
          <Link to="/shopping-trips" className="btn btn-ghost">Shopping Trips</Link>
          <Link to="/inventory" className="btn btn-ghost">Inventory</Link>
        </div>
      </section>
    </div>
  );
}

/* ── Add Meal Modal ──────────────────────────────────────────────────────────── */

interface AddMealModalProps {
  meals: Meal[];
  date: string;
  time: MealTime;
  onSave: (mealId: string, servings: number) => void;
  onCancel: () => void;
}

function AddMealModal({ meals, date, time, onSave, onCancel }: AddMealModalProps) {
  const [selectedMealId, setSelectedMealId] = useState("");
  const [servings, setServings] = useState(1);

  const handleSave = () => {
    if (!selectedMealId) { alert("Please select a meal"); return; }
    onSave(selectedMealId, servings);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Add to Plan</h2>
        <p className="modal-slot-label">{time} · {date}</p>

        <div className="form-group">
          <label>Meal</label>
          <select
            value={selectedMealId}
            onChange={e => setSelectedMealId(e.target.value)}
            className="meal-select"
            autoFocus
          >
            <option value="">Choose a meal…</option>
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
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Add Meal</button>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
