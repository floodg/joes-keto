import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ShoppingItem } from "../../domain/types";
import { getPlannedMealsForDateRange } from "../planner/api";
import { getMealsForUser } from "../meals/api";
import { getIngredientStockLevels } from "../inventory/api";
import { parseQuantity, formatQuantity } from "./quantityUtils";
import { v4 as uuidv4 } from "../../storage/uuid";
import { formatDateLocal, getMondayLocal } from "../../lib/dateUtils";
import {
  getLinkedProductsForIngredients,
  upsertLinkedProductForIngredient,
  unlinkProductForIngredient,
  type LinkedProduct,
} from "../product-linking/api";
import "./ShoppingPage.css";

export default function ShoppingPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [aggregatedItems, setAggregatedItems] = useState<ShoppingItem[]>([]);
  const [manualItems, setManualItems] = useState<ShoppingItem[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [linkedByName, setLinkedByName] = useState<Map<string, LinkedProduct>>(new Map());
  const [linkingIngredient, setLinkingIngredient] = useState<string | null>(null);

  useEffect(() => {
    // Set default to this week
    const today = new Date();
    const monday = getMondayLocal(today);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    
    setStartDate(formatDateLocal(monday));
    setEndDate(formatDateLocal(sunday));
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      generateShoppingList();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const generateShoppingList = async () => {
    setListLoading(true);
    try {
      const [plannedMeals, allMeals, stockLevels] = await Promise.all([
        getPlannedMealsForDateRange(startDate, endDate),
        getMealsForUser(),
        getIngredientStockLevels(),
      ]);

      const mealMap = new Map(allMeals.map(m => [m.id, m]));

      // Accumulate total ingredient demand broken down by (ingredient, unit).
      // Key: lowercase ingredient name  →  unit  →  { amount, displayName, store }
      const demand = new Map<string, {
        displayName: string;
        store: string;
        byUnit: Map<string, number>;
      }>();

      plannedMeals.forEach(pm => {
        const meal = mealMap.get(pm.mealId);
        if (!meal) return;
        const servings = pm.servings ?? 1;
        meal.ingredients.forEach(ing => {
          // Skip pantry staples entirely
          if (ing.pantryStaple) return;
          const key = ing.name.toLowerCase();
          if (!demand.has(key)) {
            demand.set(key, {
              displayName: ing.name,
              store: ing.store || "Coles",
              byUnit: new Map(),
            });
          }
          const entry = demand.get(key)!;
          // Prefer structured quantity/unit; fall back to parsing legacy label
          const parsed = (ing.quantityNum != null && ing.unit)
            ? { amount: ing.quantityNum, unit: ing.unit }
            : parseQuantity(ing.quantity);
          if (parsed) {
            const prev = entry.byUnit.get(parsed.unit) ?? 0;
            entry.byUnit.set(parsed.unit, prev + parsed.amount * servings);
          }
          // Unparseable quantities are omitted; the ingredient still appears if
          // at least one parseable quantity was found; otherwise the fallback
          // below adds a no-quantity prompt item.
        });
      });

      // Build shopping list: demand minus current inventory.
      const items: ShoppingItem[] = [];
      for (const [key, entry] of demand) {
        const ingredientStock = stockLevels[key] ?? {};

        if (entry.byUnit.size === 0) {
          // No parseable quantities at all – include as a prompt to buy.
          items.push({
            id: uuidv4(),
            name: entry.displayName,
            store: entry.store,
            checked: false,
            manual: false,
          });
          continue;
        }

        for (const [unit, totalNeeded] of entry.byUnit) {
          // Inventory units are already normalised in getIngredientStockLevels.
          const stock = ingredientStock[unit] ?? 0;
          const toBuy = totalNeeded - stock;
          if (toBuy > 0) {
            items.push({
              id: uuidv4(),
              name: entry.displayName,
              quantity: formatQuantity(toBuy, unit),
              store: entry.store,
              checked: false,
              manual: false,
            });
          }
        }
      }

      setAggregatedItems(items);
      // Fetch any existing product links for these ingredient names (use original casing for DB match)
      const names = Array.from(new Set(items.map(i => i.name)));
      const links = await getLinkedProductsForIngredients(names);
      setLinkedByName(links);
    } catch (err) {
      console.error(err);
    } finally {
      setListLoading(false);
    }
  };

  const displayItems = useMemo(() => {
    if (linkedByName.size === 0) return aggregatedItems;
    return aggregatedItems.map(item => {
      const link = linkedByName.get(item.name.toLowerCase());
      if (!link) return ({ ...item, ...(item as any), sourceName: item.name } as any);
      return {
        ...item,
        name: link.productName || item.name,
        // Preserve original ingredient name for linking/editing lookups
        ...(item as any),
        sourceName: item.name,
      };
    });
  }, [aggregatedItems, linkedByName]);

  const handleAddManualItem = () => {
    if (!newItemName.trim()) return;
    const newItem: ShoppingItem = {
      id: uuidv4(),
      name: newItemName,
      store: "Coles",
      checked: false,
      manual: true,
    };
    setManualItems(prev => [...prev, newItem]);
    setNewItemName("");
  };

  const handleDeleteManualItem = (id: string) => {
    setManualItems(prev => prev.filter(i => i.id !== id));
  };

  const handleToggleCheck = (id: string) => {
    setManualItems(prev =>
      prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i)
    );
  };

  const allItems = [...displayItems, ...manualItems];
  const checkedCount = manualItems.filter(i => i.checked).length;

  function LinkProductModal({ ingredientName, onClose }: { ingredientName: string; onClose: () => void }) {
    const existing = linkedByName.get(ingredientName.toLowerCase());
    const [productName, setProductName] = useState(existing?.productName ?? "");
    const [store, setStore] = useState(existing?.store ?? "Coles");
    const [unit, setUnit] = useState<'g' | 'ml' | 'units'>(
      existing?.packSizeG ? 'g' : existing?.packSizeMl ? 'ml' : 'units'
    );
    const [packSize, setPackSize] = useState(
      existing?.packSizeG ?? existing?.packSizeMl ?? existing?.packSizeUnits ?? 0
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
      if (!productName.trim()) { setError('Product name is required.'); return; }
      if (!(packSize > 0)) { setError('Pack size must be greater than zero.'); return; }
      setSaving(true);
      setError('');
      try {
        await upsertLinkedProductForIngredient(ingredientName, {
          productName: productName.trim(),
          store: store.trim(),
          packSize: Number(packSize),
          unit,
        });
        // Refresh link map for just this ingredient
        const links = await getLinkedProductsForIngredients([ingredientName]);
        const updated = new Map(linkedByName);
        for (const [k, v] of links) updated.set(k, v);
        setLinkedByName(updated);
        onClose();
      } catch (err) {
        console.error(err);
        setError('Failed to save link.');
      } finally {
        setSaving(false);
      }
    };

    const handleUnlink = async () => {
      setSaving(true);
      setError('');
      try {
        await unlinkProductForIngredient(ingredientName);
        const updated = new Map(linkedByName);
        updated.delete(ingredientName.toLowerCase());
        setLinkedByName(updated);
        onClose();
      } catch (err) {
        console.error(err);
        setError('Failed to unlink product.');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h2>Link Product</h2>
          <p><strong>{ingredientName}</strong></p>
          {error && <p className="form-error">{error}</p>}
          <div className="form-group">
            <label>Product name</label>
            <input
              type="text"
              value={productName}
              onChange={e => setProductName(e.target.value)}
              placeholder='e.g. "Coles Beef Mince 500g"'
            />
          </div>
          <div className="form-group">
            <label>Store</label>
            <select value={store} onChange={e => setStore(e.target.value)}>
              <option value="Coles">Coles</option>
              <option value="Woolworths">Woolworths</option>
              <option value="IGA">IGA</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-group inline">
            <div>
              <label>Pack size</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={packSize}
                onChange={e => setPackSize(parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label>Unit</label>
              <select value={unit} onChange={e => setUnit(e.target.value as 'g' | 'ml' | 'units')}>
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="units">units</option>
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {existing && (
              <button className="btn danger" onClick={handleUnlink} disabled={saving}>
                Unlink
              </button>
            )}
            <button className="btn" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shopping-page">
      <h1>🛒 Shopping List</h1>

      <div className="date-selector">
        <div className="form-group">
          <label>From</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>To</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={generateShoppingList}>
          🔄 Refresh List
        </button>
      </div>

      <div className="shopping-layout">
        <div className="shopping-list">
          <div className="list-header">
            <h2>Items ({allItems.length})</h2>
            {manualItems.length > 0 && (
              <span className="checked-count">
                {checkedCount}/{manualItems.length} manual items checked
              </span>
            )}
          </div>

          {listLoading ? (
            <p className="empty-message">Loading items…</p>
          ) : allItems.length === 0 ? (
            <p className="empty-message">
              No items in shopping list. Plan some meals or add manual items.
            </p>
          ) : (
            <div className="items-grid">
              {allItems.map(item => (
                <div 
                  key={item.id} 
                  className={`shopping-item ${item.checked ? 'checked' : ''} ${item.manual ? 'manual' : 'auto'}`}
                >
                  {item.manual && (
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => handleToggleCheck(item.id)}
                    />
                  )}
                  <div className="item-content">
                    <div className="item-name">
                      {item.name}
                      {(() => {
                        const sourceName = ((item as any).sourceName ?? item.name) as string;
                        const hasLink = !!linkedByName.get(sourceName.toLowerCase());
                        return !item.manual && !hasLink ? (
                        <button
                          className="btn btn-link btn-sm"
                          onClick={() => setLinkingIngredient(sourceName)}
                          title="Link product"
                          style={{ marginLeft: 8 }}
                        >
                          Link product
                        </button>
                        ) : null;
                      })()}
                      {(() => {
                        const sourceName = ((item as any).sourceName ?? item.name) as string;
                        const hasLink = !!linkedByName.get(sourceName.toLowerCase());
                        return !item.manual && hasLink ? (
                        <button
                          className="btn btn-link btn-sm"
                          onClick={() => setLinkingIngredient(sourceName)}
                          title="Edit linked product"
                          style={{ marginLeft: 8 }}
                        >
                          Edit link
                        </button>
                        ) : null;
                      })()}
                    </div>
                    {item.quantity && (
                      <div className="item-quantity">{item.quantity}</div>
                    )}
                    <div className="item-store">📍 {item.store}</div>
                  </div>
                  {item.manual && (
                    <button 
                      className="delete-btn"
                      onClick={() => handleDeleteManualItem(item.id)}
                    >
                      ✕
                    </button>
                  )}
                  {!item.manual && (
                    <span className="auto-badge">Auto</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="add-manual-section">
          <h3>Add Manual Item</h3>
          <div className="add-item-form">
            <input
              type="text"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleAddManualItem()}
              placeholder="Item name"
            />
            <button className="btn btn-primary" onClick={handleAddManualItem}>
              + Add
            </button>
          </div>
          <p className="help-text">
            Items from planned meals are added automatically. 
            Add extra items here manually.
          </p>
        </div>
      </div>

      <section className="shopping-links">
        <h2>Related views</h2>
        <div className="button-group">
          <Link to="/plan" className="btn">
            Back to Weekly Plan
          </Link>
          <Link to="/shopping-trips" className="btn">
            Record Shopping Trip
          </Link>
          <Link to="/inventory" className="btn">
            View Inventory
          </Link>
          <Link to="/dashboard" className="btn btn-secondary">
            Dashboard
          </Link>
        </div>
      </section>

      {linkingIngredient && (
        <LinkProductModal
          ingredientName={linkingIngredient}
          onClose={() => setLinkingIngredient(null)}
        />
      )}
    </div>
  );
}

