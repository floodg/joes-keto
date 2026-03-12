import { useEffect, useState, useCallback } from "react";
import type { Meal, Ingredient, MealIngredientProduct } from "../../domain/types";
import { getMealsForUser, createMeal, updateMeal, deleteMeal } from "./api";
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

  useEffect(() => {
    loadMeals();
  }, []);

  const loadMeals = async () => {
    setLoading(true);
    try {
      setMeals(await getMealsForUser());
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
          + Add New Meal
        </button>
      </div>

      <div className="meals-layout">
        <div className="meals-list">
          {loading ? (
            <p className="empty-message">Loading meals…</p>
          ) : meals.length === 0 ? (
            <p className="empty-message">No meals yet. Add your first meal!</p>
          ) : (
            meals.map(meal => (
              <div 
                key={meal.id} 
                className={`meal-card ${selectedMeal?.id === meal.id ? 'selected' : ''}`}
                onClick={() => handleViewDetails(meal)}
              >
                <h3>{meal.name}</h3>
                {meal.tags && meal.tags.length > 0 && (
                  <div className="meal-tags">
                    {meal.tags.map((tag, i) => (
                      <span key={i} className="tag">{tag}</span>
                    ))}
                  </div>
                )}
                <div className="meal-info">
                  {!!meal.prepTimeMins && <span>⏱️ Prep: {meal.prepTimeMins}m</span>}
                  {!!meal.cookTimeMins && <span>🔥 Cook: {meal.cookTimeMins}m</span>}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="meal-details">
          {!selectedMeal ? (
            <div className="empty-state">
              <p>Select a meal to view details or add a new one</p>
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
    </div>
  );
}

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
      ingredients: [...meal.ingredients, { id: uuidv4(), name: "", store: "Coles" }]
    });
  };

  const handleRemoveIngredient = (id: string) => {
    onChange({
      ...meal,
      ingredients: meal.ingredients.filter(i => i.id !== id)
    });
  };

  const handleAddInstruction = () => {
    onChange({
      ...meal,
      instructions: [...meal.instructions, ""]
    });
  };

  const handleRemoveInstruction = (index: number) => {
    onChange({
      ...meal,
      instructions: meal.instructions.filter((_, i) => i !== index)
    });
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
        />
      </div>

      <div className="form-group">
        <label>Tags (comma-separated)</label>
        <input
          type="text"
          value={meal.tags?.join(", ") || ""}
          onChange={e => onChange({ 
            ...meal, 
            tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean)
          })}
          placeholder="keto, pizza, lunch"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Prep Time (mins)</label>
          <input
            type="number"
            value={meal.prepTimeMins || ""}
            onChange={e => onChange({ ...meal, prepTimeMins: e.target.value ? parseInt(e.target.value) : undefined })}
          />
        </div>
        <div className="form-group">
          <label>Cook Time (mins)</label>
          <input
            type="number"
            value={meal.cookTimeMins || ""}
            onChange={e => onChange({ ...meal, cookTimeMins: e.target.value ? parseInt(e.target.value) : undefined })}
          />
        </div>
      </div>

      <div className="form-section">
        <div className="section-header">
          <h3>Ingredients</h3>
          <button className="btn btn-small" onClick={handleAddIngredient}>+ Add</button>
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
              type="text"
              value={ing.quantity || ""}
              onChange={e => {
                const newIngs = [...meal.ingredients];
                newIngs[idx] = { ...newIngs[idx], quantity: e.target.value };
                onChange({ ...meal, ingredients: newIngs });
              }}
              placeholder="Quantity"
            />
            <button 
              className="btn btn-danger btn-small"
              onClick={() => handleRemoveIngredient(ing.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="form-section">
        <div className="section-header">
          <h3>Instructions</h3>
          <button className="btn btn-small" onClick={handleAddInstruction}>+ Add</button>
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
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

interface MealViewProps {
  meal: Meal;
  onEdit: () => void;
  onDelete: () => void;
}

function MealView({ meal, onEdit, onDelete }: MealViewProps) {
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);

  const handleIngredientClick = (ing: Ingredient) => {
    const hasProducts =
      ing.primaryProduct != null || (ing.productOptions?.length ?? 0) > 0;
    if (hasProducts) {
      setSelectedIngredient(ing);
    }
  };

  const handleClosePopup = useCallback(() => {
    setSelectedIngredient(null);
  }, []);

  return (
    <div className="meal-view">
      <div className="view-header">
        <h2>{meal.name}</h2>
        <div className="view-actions">
          <button className="btn btn-primary" onClick={onEdit}>Edit</button>
          <button className="btn btn-danger" onClick={onDelete}>Delete</button>
        </div>
      </div>

      {meal.tags && meal.tags.length > 0 && (
        <div className="meal-tags">
          {meal.tags.map((tag, i) => (
            <span key={i} className="tag">{tag}</span>
          ))}
        </div>
      )}

      <div className="meal-info">
        {meal.prepTimeMins && <span>⏱️ Prep: {meal.prepTimeMins} minutes</span>}
        {meal.cookTimeMins && <span>🔥 Cook: {meal.cookTimeMins} minutes</span>}
      </div>

      {meal.ingredients.length > 0 && (
        <div className="view-section">
          <h3>Ingredients</h3>
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
                  {ing.quantity && ` - ${ing.quantity}`}
                  {hasProducts && (
                    <span className="ingredient-link-icon" aria-label="View product options">🛒</span>
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

      {selectedIngredient && (
        <IngredientProductPopup
          ingredient={selectedIngredient}
          onClose={handleClosePopup}
        />
      )}
    </div>
  );
}

// ─── Ingredient Product Popup ─────────────────────────────────────────────────

interface IngredientProductPopupProps {
  ingredient: Ingredient;
  onClose: () => void;
}

function IngredientProductPopup({ ingredient, onClose }: IngredientProductPopupProps) {
  // Combine primary product + options, deduplicated by id
  const products: MealIngredientProduct[] = [];
  if (ingredient.primaryProduct) {
    products.push(ingredient.primaryProduct);
  }
  for (const opt of ingredient.productOptions ?? []) {
    if (!products.some(p => p.id === opt.id)) {
      products.push(opt);
    }
  }

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="product-popup-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Product options for ${ingredient.name}`}
    >
      <div
        className="product-popup"
        onClick={e => e.stopPropagation()}
      >
        <div className="product-popup-header">
          <div>
            <h3 className="product-popup-title">{ingredient.name}</h3>
            <p className="product-popup-subtitle">Available Products</p>
          </div>
          <button
            className="product-popup-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
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
                Open Product ↗
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
