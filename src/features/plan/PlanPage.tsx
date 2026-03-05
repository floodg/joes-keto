import { useEffect, useState } from "react";
import type { PlannedMeal, Meal, MealTime } from "../../domain/types";
import { getPlannedMeals, getMeals, addPlannedMeal, deletePlannedMeal } from "../../storage/dataService";
import { v4 as uuidv4 } from "../../storage/uuid";
import "./PlanPage.css";

const MEAL_TIMES: MealTime[] = ["breakfast", "lunch", "dinner", "snack"];
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function PlanPage() {
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonday(new Date()));
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalDate, setModalDate] = useState("");
  const [modalTime, setModalTime] = useState<MealTime>("breakfast");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setPlannedMeals(getPlannedMeals());
    setMeals(getMeals());
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
    const dateStr = formatDate(date);
    return plannedMeals.find(pm => pm.date === dateStr && pm.time === time);
  };

  const getMealName = (mealId: string): string => {
    return meals.find(m => m.id === mealId)?.name || "Unknown meal";
  };

  const handleAddMeal = (date: Date, time: MealTime) => {
    setModalDate(formatDate(date));
    setModalTime(time);
    setShowAddModal(true);
  };

  const handleSaveModal = (mealId: string) => {
    const plannedMeal: PlannedMeal = {
      id: uuidv4(),
      date: modalDate,
      time: modalTime,
      mealId,
    };
    addPlannedMeal(plannedMeal);
    loadData();
    setShowAddModal(false);
  };

  const handleRemoveMeal = (id: string) => {
    if (confirm("Remove this meal from the plan?")) {
      deletePlannedMeal(id);
      loadData();
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
    setCurrentWeekStart(getMonday(new Date()));
  };

  const weekDates = getWeekDates();

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
        <strong>Week of:</strong> {formatDate(weekDates[0])} to {formatDate(weekDates[6])}
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
          onSave={handleSaveModal}
          onCancel={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

interface AddMealModalProps {
  meals: Meal[];
  onSave: (mealId: string) => void;
  onCancel: () => void;
}

function AddMealModal({ meals, onSave, onCancel }: AddMealModalProps) {
  const [selectedMealId, setSelectedMealId] = useState("");

  const handleSave = () => {
    if (!selectedMealId) {
      alert("Please select a meal");
      return;
    }
    onSave(selectedMealId);
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
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleSave}>Add</button>
          <button className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
