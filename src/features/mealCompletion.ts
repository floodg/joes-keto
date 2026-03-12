import type { Meal, MealStatus, PlannedMeal } from "../domain/types";
import { updatePlannedMealStatus } from "./planner/api";
import { createInventoryTransaction } from "./inventory/api";
import { parseQuantity } from "./shopping/quantityUtils";

interface ChangeStatusOptions {
  plannedMeal: PlannedMeal;
  meal: Meal | undefined;
  newStatus: MealStatus;
  userId: string | null;
}

/**
 * Update a planned meal's status and, when marking as completed, record
 * corresponding inventory consumption transactions for each ingredient.
 *
 * This centralises the completion logic so both the dashboard and planner
 * views keep inventory in sync using the shared quantity parsing utilities.
 */
export async function changePlannedMealStatusWithInventory(
  options: ChangeStatusOptions
): Promise<PlannedMeal> {
  const { plannedMeal, meal, newStatus, userId } = options;

  const updated = await updatePlannedMealStatus(plannedMeal.id, newStatus);

  if (
    newStatus === "completed" &&
    userId &&
    meal &&
    meal.ingredients &&
    meal.ingredients.length > 0
  ) {
    const servings = plannedMeal.servings ?? 1;
    const occurredAt = new Date().toISOString();

    await Promise.all(
      meal.ingredients.map((ingredient) => {
        const parsed = parseQuantity(ingredient.quantity);
        if (!parsed) {
          console.warn(
            `Could not parse quantity "${ingredient.quantity}" for ingredient "${ingredient.name}" when recording meal consumption; skipping inventory transaction.`
          );
          return Promise.resolve();
        }

        return createInventoryTransaction({
          userId,
          ingredientName: ingredient.name,
          quantityDelta: -parsed.amount * servings,
          unit: parsed.unit,
          transactionType: "meal_consumption",
          sourceType: "planned_meal",
          sourceId: plannedMeal.id,
          occurredAt,
        });
      })
    );
  }

  return updated;
}

