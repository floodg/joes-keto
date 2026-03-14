import { useEffect, useRef, useState } from 'react';
import type { MealIngredientProduct, StoreProduct } from '../../domain/types';
import { getStoreProducts } from '../store-products/api';
import type { StarterMealWithIngredients, StarterIngredient } from './api';
import {
  getStarterMealsWithIngredients,
  setIngredientPrimaryProduct,
  addIngredientProductOption,
  removeIngredientProductOption,
} from './api';
import './IngredientProductsPage.css';

// ─── Product Combobox ─────────────────────────────────────────────────────────

interface ProductComboboxProps {
  placeholder: string;
  storeProducts: StoreProduct[];
  excludeIds?: string[];
  onSelect: (product: StoreProduct) => void;
}

const CLOSE_DELAY = 150;

function ProductCombobox({ placeholder, storeProducts, excludeIds = [], onSelect }: ProductComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = storeProducts.filter(p => {
    if (excludeIds.includes(p.id)) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.brand?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleSelect = (p: StoreProduct) => {
    onSelect(p);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="ip-combobox" ref={wrapRef}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), CLOSE_DELAY)}
        className="ip-combobox-input"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="ip-combobox-list" role="listbox">
          {filtered.map(p => (
            <li
              key={p.id}
              className="ip-combobox-item"
              onMouseDown={() => handleSelect(p)}
              role="option"
            >
              <span className="ip-combo-name">{[p.brand, p.name].filter(Boolean).join(' ')}</span>
              {p.sizeLabel && <span className="ip-combo-meta">{p.sizeLabel}</span>}
              <span className="ip-combo-store">{p.store}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Ingredient Row ───────────────────────────────────────────────────────────

interface IngredientRowProps {
  ingredient: StarterIngredient;
  storeProducts: StoreProduct[];
  onIngredientUpdated: (updated: StarterIngredient) => void;
}

function IngredientRow({ ingredient, storeProducts, onIngredientUpdated }: IngredientRowProps) {
  const [saving, setSaving] = useState<string | null>(null); // tracks which action is in progress

  // IDs to exclude from add-alternatives combobox: primary + existing options
  const usedProductIds = [
    ...(ingredient.primaryProductId ? [ingredient.primaryProductId] : []),
    ...ingredient.productOptions.map(o => o.storeProductId),
  ];

  /** Convert a StoreProduct to a MealIngredientProduct (strips createdAt etc.) */
  const toMealProduct = (p: StoreProduct): MealIngredientProduct => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    sizeLabel: p.sizeLabel,
    store: p.store,
    productUrl: p.productUrl,
    imageUrl: p.imageUrl,
  });

  const handleSetPrimary = async (productId: string | null) => {
    setSaving('primary');
    try {
      await setIngredientPrimaryProduct(ingredient.id, productId);
      const newPrimaryProduct = productId
        ? storeProducts.find(p => p.id === productId)
        : undefined;
      onIngredientUpdated({
        ...ingredient,
        primaryProductId: productId ?? undefined,
        primaryProduct: newPrimaryProduct ? toMealProduct(newPrimaryProduct) : undefined,
      });
    } catch (err) {
      console.error('Failed to set primary product', err);
      alert('Failed to update default product. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const handleAddOption = async (product: StoreProduct) => {
    setSaving(`add-${product.id}`);
    try {
      const nextSort = ingredient.productOptions.length;
      await addIngredientProductOption(ingredient.id, product.id, nextSort);
      // Use storeProductId as key; optionRowId is a temporary display key only –
      // remove operations use storeProductId, not optionRowId, so this is safe.
      onIngredientUpdated({
        ...ingredient,
        productOptions: [
          ...ingredient.productOptions,
          {
            optionRowId: `temp-${product.id}`,
            storeProductId: product.id,
            product: toMealProduct(product),
            sortOrder: nextSort,
          },
        ],
      });
    } catch (err) {
      console.error('Failed to add product option', err);
      alert('Failed to add alternative. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const handleRemoveOption = async (productId: string) => {
    setSaving(`remove-${productId}`);
    try {
      await removeIngredientProductOption(ingredient.id, productId);
      onIngredientUpdated({
        ...ingredient,
        productOptions: ingredient.productOptions.filter(o => o.storeProductId !== productId),
      });
    } catch (err) {
      console.error('Failed to remove product option', err);
      alert('Failed to remove alternative. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const primaryProduct = ingredient.primaryProduct;

  return (
    <div className="ip-ingredient-row">
      <div className="ip-ingredient-header">
        <span className="ip-ingredient-name">{ingredient.name}</span>
        {ingredient.quantity && (
          <span className="ip-ingredient-qty">{ingredient.quantity}</span>
        )}
      </div>

      {/* Default product */}
      <div className="ip-field-group">
        <label className="ip-field-label">Default product</label>
        <div className="ip-primary-row">
          {primaryProduct ? (
            <div className="ip-primary-badge">
              <span className="ip-primary-name">
                {[primaryProduct.brand, primaryProduct.name].filter(Boolean).join(' ')}
              </span>
              {primaryProduct.sizeLabel && (
                <span className="ip-primary-meta">{primaryProduct.sizeLabel}</span>
              )}
              <button
                className="ip-remove-btn"
                onClick={() => handleSetPrimary(null)}
                disabled={saving === 'primary'}
                title="Clear default"
              >
                ✕
              </button>
            </div>
          ) : (
            <ProductCombobox
              placeholder="Search for a default product…"
              storeProducts={storeProducts}
              excludeIds={usedProductIds}
              onSelect={p => handleSetPrimary(p.id)}
            />
          )}
          {saving === 'primary' && <span className="ip-saving-indicator">Saving…</span>}
        </div>
      </div>

      {/* Alternative products */}
      <div className="ip-field-group">
        <label className="ip-field-label">Alternative products</label>
        <div className="ip-options-list">
          {ingredient.productOptions.map(opt => (
            <div key={opt.storeProductId} className="ip-option-chip">
              <span className="ip-option-name">
                {[opt.product.brand, opt.product.name].filter(Boolean).join(' ')}
              </span>
              {opt.product.sizeLabel && (
                <span className="ip-option-meta">{opt.product.sizeLabel}</span>
              )}
              <button
                className="ip-remove-btn"
                onClick={() => handleRemoveOption(opt.storeProductId)}
                disabled={saving === `remove-${opt.storeProductId}`}
                title="Remove alternative"
              >
                {saving === `remove-${opt.storeProductId}` ? '…' : '✕'}
              </button>
            </div>
          ))}
          <div className="ip-add-option-row">
            <ProductCombobox
              placeholder="Add alternative product…"
              storeProducts={storeProducts}
              excludeIds={usedProductIds}
              onSelect={handleAddOption}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Meal Detail Panel ────────────────────────────────────────────────────────

interface MealDetailProps {
  meal: StarterMealWithIngredients;
  storeProducts: StoreProduct[];
  onMealUpdated: (updated: StarterMealWithIngredients) => void;
}

function MealDetail({ meal, storeProducts, onMealUpdated }: MealDetailProps) {
  const handleIngredientUpdated = (updated: StarterIngredient) => {
    onMealUpdated({
      ...meal,
      ingredients: meal.ingredients.map(i => i.id === updated.id ? updated : i),
    });
  };

  return (
    <div className="ip-meal-detail">
      <div className="ip-meal-detail-header">
        <h2>{meal.name}</h2>
        {meal.tags.length > 0 && (
          <div className="ip-meal-tags">
            {meal.tags.map(tag => (
              <span key={tag} className="ip-meal-tag">{tag}</span>
            ))}
          </div>
        )}
        <p className="ip-meal-detail-subtitle">
          {meal.ingredients.length} ingredient{meal.ingredients.length !== 1 ? 's' : ''}
          {' — assign a default store product and any alternative options for each ingredient.'}
        </p>
      </div>

      {meal.ingredients.length === 0 ? (
        <p className="ip-empty-note">This meal has no ingredients.</p>
      ) : (
        <div className="ip-ingredients-list">
          {meal.ingredients.map(ing => (
            <IngredientRow
              key={ing.id}
              ingredient={ing}
              storeProducts={storeProducts}
              onIngredientUpdated={handleIngredientUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IngredientProductsPage() {
  const [meals, setMeals] = useState<StarterMealWithIngredients[]>([]);
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getStarterMealsWithIngredients(), getStoreProducts()])
      .then(([fetchedMeals, fetchedProducts]) => {
        setMeals(fetchedMeals);
        setStoreProducts(fetchedProducts);
        if (fetchedMeals.length > 0) {
          setSelectedMealId(fetchedMeals[0].id);
        }
      })
      .catch(err => {
        setError('Failed to load data. Please refresh the page.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedMeal = meals.find(m => m.id === selectedMealId) ?? null;

  const handleMealUpdated = (updated: StarterMealWithIngredients) => {
    setMeals(prev => prev.map(m => m.id === updated.id ? updated : m));
  };

  return (
    <div className="ip-page">
      <div className="page-header">
        <h1>🥘 Ingredient Products</h1>
      </div>
      <p className="ip-page-subtitle">
        Manage which store products are linked to each starter meal ingredient. Set the default product
        and add alternative options that users can swap to when shopping.
      </p>

      {loading ? (
        <p className="ip-loading">Loading…</p>
      ) : error ? (
        <p className="ip-error">{error}</p>
      ) : (
        <div className="ip-layout">
          {/* Sidebar – meal list */}
          <div className="ip-sidebar">
            <ul className="ip-meal-list">
              {meals.map(meal => {
                const linkedCount = meal.ingredients.filter(i => i.primaryProductId).length;
                const totalCount = meal.ingredients.length;
                return (
                  <li
                    key={meal.id}
                    className={`ip-meal-card${selectedMealId === meal.id ? ' selected' : ''}`}
                    onClick={() => setSelectedMealId(meal.id)}
                  >
                    <div className="ip-meal-card-name">{meal.name}</div>
                    {totalCount > 0 && (
                      <div className="ip-meal-card-progress">
                        <span
                          className={`ip-progress-badge${linkedCount === totalCount ? ' complete' : ''}`}
                        >
                          {linkedCount}/{totalCount} linked
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Detail panel */}
          <div className="ip-detail">
            {selectedMeal ? (
              <MealDetail
                meal={selectedMeal}
                storeProducts={storeProducts}
                onMealUpdated={handleMealUpdated}
              />
            ) : (
              <div className="ip-empty-state">
                <p>Select a starter meal from the list to manage its ingredient products.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
