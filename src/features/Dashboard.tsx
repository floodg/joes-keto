import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { PlannedMeal, Meal, MealStatus } from "../domain/types";
import { getPlannedMeals, updatePlannedMealStatus } from "./planner/api";
import { getMealsForUser } from "./meals/api";
import { createInventoryTransaction } from "./inventory/api";
import { supabase } from "../lib/supabase";
import "./Dashboard.css";

type TodaysMeal = PlannedMeal & { meal?: Meal };

export default function Dashboard() {
  const [todaysMeals, setTodaysMeals] = useState<TodaysMeal[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    Promise.all([getPlannedMeals(), getMealsForUser()])
      .then(([plannedMeals, allMeals]) => {
        const mealMap = new Map(allMeals.map(m => [m.id, m]));
        setTodaysMeals(
          plannedMeals
            .filter(pm => pm.date === today)
            .map(pm => ({ ...pm, meal: mealMap.get(pm.mealId) }))
        );
      })
      .catch(console.error);
  }, []);

  const formatMealTime = (time: string) => {
    return time.charAt(0).toUpperCase() + time.slice(1);
  };

  const handleStatusChange = async (pm: TodaysMeal, newStatus: MealStatus) => {
    if (processingId === pm.id) return;
    setProcessingId(pm.id);
    try {
      const updated = await updatePlannedMealStatus(pm.id, newStatus);
      setTodaysMeals(prev =>
        prev.map(m => (m.id === pm.id ? { ...m, status: updated.status } : m))
      );

      // When a meal is completed, log inventory consumption for each ingredient
      if (newStatus === 'completed' && userId && pm.meal?.ingredients?.length) {
        const servings = pm.servings ?? 1;
        const now = new Date().toISOString();
        try {
          await Promise.all(
            pm.meal.ingredients.map(ing => {
              const qty = parseQuantity(ing.quantity) * servings;
              return createInventoryTransaction({
                userId,
                ingredientName: ing.name,
                quantityDelta: -qty,
                unit: parseUnit(ing.quantity),
                transactionType: 'meal_consumption',
                sourceType: 'planned_meal',
                sourceId: pm.id,
                occurredAt: now,
              });
            })
          );
        } catch (err) {
          console.error('Failed to record inventory transactions for completed meal', err);
        }
      }
    } catch (err) {
      console.error('Failed to update meal status', err);
    } finally {
      setProcessingId(null);
    }
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
                <div
                  key={pm.id}
                  className={`item-card item-card--${pm.status}`}
                >
                  <div className="item-card-header">
                    <div>
                      <div className="item-time">{formatMealTime(pm.time)}</div>
                      <div className="item-name">{pm.meal?.name || "Unknown meal"}</div>
                      {pm.meal?.ingredients && pm.meal.ingredients.length > 0 && (
                        <ul className="item-ingredients">
                          {pm.meal.ingredients.map(ing => (
                            <li key={ing.id} className="item-ingredient">
                              {ing.quantity ? `${ing.quantity} ${ing.name}` : ing.name}
                            </li>
                          ))}
                        </ul>
                      )}
                      {pm.notes && <div className="item-notes">{pm.notes}</div>}
                    </div>
                    <div className="item-status-badge">
                      {pm.status === 'completed' && <span className="status-badge status-badge--completed">✓ Eaten</span>}
                      {pm.status === 'skipped' && <span className="status-badge status-badge--skipped">Skipped</span>}
                    </div>
                  </div>
                  {pm.status === 'planned' && (
                    <div className="item-actions">
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleStatusChange(pm, 'completed')}
                        disabled={processingId === pm.id}
                      >
                        {processingId === pm.id ? 'Saving…' : '✓ Mark eaten'}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleStatusChange(pm, 'skipped')}
                        disabled={processingId === pm.id}
                      >
                        Skip
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <Link to="/plan" className="section-link">View Weekly Plan →</Link>
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract a numeric quantity from a text string like "200g", "1.5 tbsp", "2".
 * Returns 1 as a safe default if no leading number can be parsed, and logs a
 * warning so inventory discrepancies are visible in the console.
 */
function parseQuantity(quantity?: string): number {
  if (!quantity) return 1;
  const match = quantity.match(/^(\d+(\.\d+)?)/);
  if (!match) {
    console.warn(`Could not parse numeric quantity from "${quantity}"; defaulting to 1 for inventory deduction.`);
    return 1;
  }
  return parseFloat(match[1]);
}

/**
 * Extract a unit from a text string like "200g", "1.5 tbsp", "2 cups".
 * Returns undefined if no unit suffix is found.
 */
function parseUnit(quantity?: string): string | undefined {
  if (!quantity) return undefined;
  const match = quantity.match(/^\d+(\.\d+)?\s*([a-zA-Z]+)/);
  return match ? match[2] : undefined;
}
