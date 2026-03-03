import { useEffect, useState } from "react";
import type { Meal } from "../../domain/types";
import { getMeals, addMeal, updateMeal, deleteMeal } from "../../storage/dataService";
import { v4 as uuidv4 } from "../../storage/uuid";
import "./MealsPage.css";

export default function MealsPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadMeals();
  }, []);

  const loadMeals = () => {
    setMeals(getMeals());
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

  const handleSave = () => {
    if (!selectedMeal || !selectedMeal.name.trim()) {
      alert("Please enter a meal name");
      return;
    }

    const existingMeal = meals.find(m => m.id === selectedMeal.id);
    if (existingMeal) {
      updateMeal(selectedMeal);
    } else {
      addMeal(selectedMeal);
    }

    loadMeals();
    setIsEditing(false);
    setSelectedMeal(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedMeal(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this meal?")) {
      deleteMeal(id);
      loadMeals();
      if (selectedMeal?.id === id) {
        setSelectedMeal(null);
        setIsEditing(false);
      }
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
          {meals.length === 0 ? (
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
                  {meal.prepTimeMins && <span>⏱️ Prep: {meal.prepTimeMins}m</span>}
                  {meal.cookTimeMins && <span>🔥 Cook: {meal.cookTimeMins}m</span>}
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
}

function MealForm({ meal, onChange, onSave, onCancel }: MealFormProps) {
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
        <button className="btn btn-primary" onClick={onSave}>Save</button>
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
          <ul>
            {meal.ingredients.map(ing => (
              <li key={ing.id}>
                <strong>{ing.name}</strong>
                {ing.quantity && ` - ${ing.quantity}`}
              </li>
            ))}
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
    </div>
  );
}
