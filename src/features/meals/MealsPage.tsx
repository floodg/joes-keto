import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import type { Meal, Ingredient, MealIngredientProduct } from "../../domain/types";
import { getMealsForUser, createMeal, updateMeal, deleteMeal } from "./api";
import { upsertIngredientFlags } from "../ingredients/api";
import { useAuth } from "../../context/AuthProvider";
import { v4 as uuidv4 } from "../../storage/uuid";
import "./MealsPage.css";

export default function MealsPage() {
  const { user } = useAuth();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadMeals(); }, []);

  const loadMeals = async () => {
    setLoading(true);
    try {
      const raw = await getMealsForUser();
      // Sort alphabetically (case-insensitive)
      const sorted = [...raw].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
      setMeals(sorted);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    const newMeal: Meal = {
      id: uuidv4(),
      name: "",
      tags: [],
      ingredients: [],
      instructions: [],
    };
    setSelectedMeal(newMeal);
    setIsEditing(true);
  };

  const handleEdit = (meal: Meal) => {
    setSelectedMeal({ ...meal });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedMeal || !selectedMeal.name.trim()) {
      alert("Please enter a meal name");
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      // Persist ingredient-level flags (optional) to the global catalog
      const flags = (selectedMeal.ingredients ?? [])
        .filter(i => i.name && i.name.trim().length > 0)
        .map(i => ({
          name: i.name.trim(),
          optional: i.optional ?? false,
        }));
      if (flags.length > 0) {
        await upsertIngredientFlags(flags);
      }

      const existingMeal = meals.find(m => m.id === selectedMeal.id);
      if (existingMeal) {
        await updateMeal(selectedMeal);
      } else {
        await createMeal({ ...selectedMeal, userId: user.id });
      }
      await loadMeals();
      setIsEditing(false);
      setSelectedMeal(null);
    } catch (err) {
      console.error(err);
      alert("Failed to save meal. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedMeal(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this meal?")) return;
    try {
      await deleteMeal(id);
      await loadMeals();
      if (selectedMeal?.id === id) {
        setSelectedMeal(null);
        setIsEditing(false);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete meal. Please try again.");
    }
  };

  const handleViewDetails = (meal: Meal) => {
    setSelectedMeal(meal);
    setIsEditing(false);
  };

  return (
    <div className="meals-page">
      <div className="page-header">
        <h1>🍽️ Meals</h1>
        <button className="btn btn-primary" onClick={handleAddNew}>
          + Add Meal
        </button>
      </div>

      <div className="meals-layout">
        {/* ── Left: meal list ── */}
        <div className="meals-list-panel">
          <div className="meals-list-header">
            <span>All Meals</span>
            <span className="meals-count">{meals.length}</span>
          </div>

          <div className="meals-list">
            {loading ? (
              <p className="empty-message">Loading…</p>
            ) : meals.length === 0 ? (
              <p className="empty-message">No meals yet — add your first one!</p>
            ) : (
              meals.map(meal => (
                <div
                  key={meal.id}
                  className={`meal-card${selectedMeal?.id === meal.id ? " selected" : ""}`}
                  onClick={() => handleViewDetails(meal)}
                >
                  <div className="meal-card-name">{meal.name}</div>

                  {meal.tags && meal.tags.length > 0 && (
                    <div className="meal-tags">
                      {meal.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="tag">{tag}</span>
                      ))}
                      {meal.tags.length > 3 && (
                        <span className="tag">+{meal.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  <div className="meal-meta">
                    {meal.prepTimeMins ? <span>⏱ {meal.prepTimeMins}m prep</span> : null}
                    {meal.cookTimeMins ? <span>🔥 {meal.cookTimeMins}m cook</span> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Right: detail / form ── */}
        <div className="meal-detail-panel">
          {!selectedMeal ? (
            <div className="empty-state">
              <div className="empty-state-icon">🍽️</div>
              <p>Select a meal to view details</p>
            </div>
          ) : isEditing ? (
            <MealForm
              meal={selectedMeal}
              onChange={setSelectedMeal}
              onSave={handleSave}
              onCancel={handleCancel}
              saving={saving}
            />
          ) : (
            <MealView
              meal={selectedMeal}
              onEdit={() => handleEdit(selectedMeal)}
              onDelete={() => handleDelete(selectedMeal.id)}
            />
          )}
        </div>
      </div>

      <section className="page-footer-links">
        <h2>Plan and shop from your meals</h2>
        <div className="button-group">
          <Link to="/plan" className="btn btn-ghost">Weekly Plan</Link>
          <Link to="/shopping" className="btn btn-ghost">Shopping List</Link>
          <Link to="/dashboard" className="btn btn-ghost">Dashboard</Link>
        </div>
      </section>
    </div>
  );
}

/* ── Meal Form ───────────────────────────────────────────────────────────────── */

interface MealFormProps {
  meal: Meal;
  onChange: (meal: Meal) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}

function MealForm({ meal, onChange, onSave, onCancel, saving }: MealFormProps) {
  const handleAddIngredient = () => {
    onChange({
      ...meal,
      ingredients: [...meal.ingredients, { id: uuidv4(), name: "", store: "Coles" }],
    });
  };

  const handleRemoveIngredient = (id: string) => {
    onChange({ ...meal, ingredients: meal.ingredients.filter(i => i.id !== id) });
  };

  const handleAddInstruction = () => {
    onChange({ ...meal, instructions: [...meal.instructions, ""] });
  };

  const handleRemoveInstruction = (index: number) => {
    onChange({ ...meal, instructions: meal.instructions.filter((_, i) => i !== index) });
  };

  return (
    <div className="meal-form">
      <h2>{meal.name || "New Meal"}</h2>

      <div className="form-group">
        <label>Name *</label>
        <input
          type="text"
          value={meal.name}
          onChange={e => onChange({ ...meal, name: e.target.value })}
          placeholder="Meal name"
          autoFocus
        />
      </div>

      <div className="form-group">
        <label>Tags (comma-separated)</label>
        <input
          type="text"
          value={meal.tags?.join(", ") || ""}
          onChange={e =>
            onChange({
              ...meal,
              tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean),
            })
          }
          placeholder="keto, pizza, lunch"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Prep Time (mins)</label>
          <input
            type="number"
            value={meal.prepTimeMins || ""}
            onChange={e =>
              onChange({ ...meal, prepTimeMins: e.target.value ? parseInt(e.target.value) : undefined })
            }
          />
        </div>
        <div className="form-group">
          <label>Cook Time (mins)</label>
          <input
            type="number"
            value={meal.cookTimeMins || ""}
            onChange={e =>
              onChange({ ...meal, cookTimeMins: e.target.value ? parseInt(e.target.value) : undefined })
            }
          />
        </div>
      </div>

      <div className="form-section">
        <div className="section-header">
          <h3>Ingredients</h3>
          <button className="btn btn-ghost btn-small" onClick={handleAddIngredient}>+ Add</button>
        </div>
        {meal.ingredients.map((ing, idx) => (
          <div key={ing.id} className="ingredient-row">
            <input
              type="text"
              value={ing.name}
              onChange={e => {
                const newIngs = [...meal.ingredients];
                newIngs[idx] = { ...newIngs[idx], name: e.target.value };
                onChange({ ...meal, ingredients: newIngs });
              }}
              placeholder="Ingredient name"
            />
            <input
              type="number"
              min={0}
              step="0.01"
              value={ing.quantityNum ?? ""}
              onChange={e => {
                const v = e.target.value;
                const num = v === "" ? undefined : Number(v);
                const newIngs = [...meal.ingredients];
                newIngs[idx] = { ...newIngs[idx], quantityNum: Number.isFinite(num as number) ? (num as number) : undefined };
                onChange({ ...meal, ingredients: newIngs });
              }}
              placeholder="Qty"
              style={{ width: "6rem" }}
            />
            <select
              value={ing.unit ?? ""}
              onChange={e => {
                const unit = e.target.value || undefined;
                const newIngs = [...meal.ingredients];
                newIngs[idx] = { ...newIngs[idx], unit: unit as Ingredient['unit'] | undefined };
                onChange({ ...meal, ingredients: newIngs });
              }}
            >
              <option value="">Unit…</option>
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="units">units</option>
              <option value="tsp">tsp</option>
              <option value="tbsp">tbsp</option>
              <option value="cup">cup</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}>
              <input
                type="checkbox"
                checked={!!ing.optional}
                onChange={e => {
                  const newIngs = [...meal.ingredients];
                  newIngs[idx] = { ...newIngs[idx], optional: e.target.checked };
                  onChange({ ...meal, ingredients: newIngs });
                }}
              />
              Optional
            </label>
            <button
              className="btn btn-danger btn-small"
              onClick={() => handleRemoveIngredient(ing.id)}
            >
              ✕
            </button>
          </div>
        ))}
        {meal.ingredients.length === 0 && (
          <p style={{ fontSize: "0.8rem", color: "#9ca3af", margin: "0.5rem 0" }}>
            No ingredients yet
          </p>
        )}
      </div>

      <div className="form-section">
        <div className="section-header">
          <h3>Instructions</h3>
          <button className="btn btn-ghost btn-small" onClick={handleAddInstruction}>+ Add</button>
        </div>
        {meal.instructions.map((instruction, idx) => (
          <div key={idx} className="instruction-row">
            <span className="step-number">{idx + 1}.</span>
            <input
              type="text"
              value={instruction}
              onChange={e => {
                const newInstructions = [...meal.instructions];
                newInstructions[idx] = e.target.value;
                onChange({ ...meal, instructions: newInstructions });
              }}
              placeholder="Instruction step"
            />
            <button
              className="btn btn-danger btn-small"
              onClick={() => handleRemoveInstruction(idx)}
            >
              ✕
            </button>
          </div>
        ))}
        {meal.instructions.length === 0 && (
          <p style={{ fontSize: "0.8rem", color: "#9ca3af", margin: "0.5rem 0" }}>
            No instructions yet
          </p>
        )}
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save Meal"}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ── Meal View ───────────────────────────────────────────────────────────────── */

interface MealViewProps {
  meal: Meal;
  onEdit: () => void;
  onDelete: () => void;
}

function MealView({ meal, onEdit, onDelete }: MealViewProps) {
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);

  const handleIngredientClick = (ing: Ingredient) => {
    const hasProducts = ing.primaryProduct != null || (ing.productOptions?.length ?? 0) > 0;
    if (hasProducts) setSelectedIngredient(ing);
  };

  const handleClosePopup = useCallback(() => setSelectedIngredient(null), []);

  return (
    <div className="meal-view">
      <div className="view-header">
        <h2>{meal.name}</h2>
        <div className="view-actions">
          <button className="btn btn-ghost btn-small" onClick={onEdit}>Edit</button>
          <button className="btn btn-danger btn-small" onClick={onDelete}>Delete</button>
        </div>
      </div>

      {meal.tags && meal.tags.length > 0 && (
        <div className="view-tags">
          {meal.tags.map((tag, i) => (
            <span key={i} className="tag">{tag}</span>
          ))}
        </div>
      )}

      {(meal.prepTimeMins || meal.cookTimeMins) && (
        <div className="view-meta">
          {meal.prepTimeMins && <span>⏱ Prep: {meal.prepTimeMins} min</span>}
          {meal.cookTimeMins && <span>🔥 Cook: {meal.cookTimeMins} min</span>}
        </div>
      )}

      {meal.ingredients.length > 0 && (
        <div className="view-section">
          <h3>Ingredients ({meal.ingredients.length})</h3>
          <ul className="ingredient-list">
            {meal.ingredients.map(ing => {
              const hasProducts =
                ing.primaryProduct != null || (ing.productOptions?.length ?? 0) > 0;
              return (
                <li
                  key={ing.id}
                  className={`ingredient-item${hasProducts ? " ingredient-item--clickable" : ""}`}
                  onClick={() => handleIngredientClick(ing)}
                  title={hasProducts ? "Click to view product options" : undefined}
                >
                  <strong>{ing.name}</strong>
                  {ing.quantity && (
                    <span style={{ color: "#6b7280", marginLeft: "0.35rem" }}>
                      — {ing.quantity}
                    </span>
                  )}
                  {ing.pantryStaple && (
                    <span
                      style={{
                        marginLeft: "0.5rem",
                        fontSize: "0.7rem",
                        color: "#065f46",
                        background: "#d1fae5",
                        border: "1px solid #10b981",
                        padding: "0.05rem 0.3rem",
                        borderRadius: "0.25rem",
                      }}
                      title="Pantry staple (always assumed in stock)"
                    >
                      Staple
                    </span>
                  )}
                  {hasProducts && (
                    <span className="ingredient-link-icon" aria-label="View products">🛒</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {meal.instructions.length > 0 && (
        <div className="view-section">
          <h3>Instructions</h3>
          <ol>
            {meal.instructions.map((instruction, idx) => (
              <li key={idx}>{instruction}</li>
            ))}
          </ol>
        </div>
      )}

      {meal.ingredients.length === 0 && meal.instructions.length === 0 && (
        <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginTop: "0.5rem" }}>
          No details added yet. Click Edit to fill in this meal.
        </p>
      )}

      {selectedIngredient && (
        <IngredientProductPopup ingredient={selectedIngredient} onClose={handleClosePopup} />
      )}
    </div>
  );
}

/* ── Product Popup ───────────────────────────────────────────────────────────── */

interface IngredientProductPopupProps {
  ingredient: Ingredient;
  onClose: () => void;
}

function IngredientProductPopup({ ingredient, onClose }: IngredientProductPopupProps) {
  const products: MealIngredientProduct[] = [];
  if (ingredient.primaryProduct) products.push(ingredient.primaryProduct);
  for (const opt of ingredient.productOptions ?? []) {
    if (!products.some(p => p.id === opt.id)) products.push(opt);
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="product-popup-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="product-popup" onClick={e => e.stopPropagation()}>
        <div className="product-popup-header">
          <div>
            <h3 className="product-popup-title">{ingredient.name}</h3>
            <p className="product-popup-subtitle">Available Products</p>
          </div>
          <button className="product-popup-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <ul className="product-list">
          {products.map(product => (
            <li key={product.id} className="product-item">
              <div className="product-info">
                <span className="product-name">{product.name}</span>
                {(product.brand || product.sizeLabel) && (
                  <span className="product-meta">
                    {[product.brand, product.sizeLabel].filter(Boolean).join(" · ")}
                  </span>
                )}
                <span className="product-store">{product.store}</span>
              </div>
              <a
                href={product.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary product-open-btn"
              >
                Open ↗
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
