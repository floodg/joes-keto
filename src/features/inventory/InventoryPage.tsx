import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { InventoryTransaction } from '../../domain/types';
import {
  createInventoryTransaction,
  getIngredientStockLevels,
  getInventoryTransactions,
} from './api';
import './InventoryPage.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayLocalISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTransactionType(type: string): string {
  switch (type) {
    case 'purchase': return '🛒 Purchase';
    case 'meal_consumption': return '🍽️ Meal';
    case 'waste': return '🗑️ Waste';
    case 'manual_adjustment': return '✏️ Manual';
    default: return type;
  }
}

// ─── Adjustment Form ──────────────────────────────────────────────────────────

interface AdjustFormProps {
  userId: string;
  onSaved: () => void;
  onCancel: () => void;
}

function AdjustForm({ userId, onSaved, onCancel }: AdjustFormProps) {
  const [ingredientName, setIngredientName] = useState('');
  const [quantityDelta, setQuantityDelta] = useState('');
  const [unit, setUnit] = useState('');
  const [transactionType, setTransactionType] = useState<'manual_adjustment' | 'waste'>('manual_adjustment');
  const [occurredAt, setOccurredAt] = useState(todayLocalISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const delta = parseFloat(quantityDelta);
    if (!ingredientName.trim()) {
      setError('Ingredient name is required.');
      return;
    }
    if (isNaN(delta) || delta === 0) {
      setError('Quantity must be a non-zero number. Use negative values to decrease stock.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createInventoryTransaction({
        userId,
        ingredientName: ingredientName.trim(),
        quantityDelta: delta,
        unit: unit.trim() || undefined,
        transactionType,
        occurredAt: new Date(occurredAt).toISOString(),
      });
      onSaved();
    } catch (err) {
      setError('Failed to save adjustment. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="adjust-form" onSubmit={handleSubmit}>
      <h2>Adjust Inventory</h2>
      {error && <p className="form-error">{error}</p>}

      <div className="form-group">
        <label htmlFor="adj-ingredient">Ingredient</label>
        <input
          id="adj-ingredient"
          type="text"
          value={ingredientName}
          onChange={e => setIngredientName(e.target.value)}
          placeholder="e.g. Mozzarella, Avocado"
          autoFocus
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="adj-qty">Quantity</label>
          <input
            id="adj-qty"
            type="number"
            step="any"
            value={quantityDelta}
            onChange={e => setQuantityDelta(e.target.value)}
            placeholder="e.g. 200 or -1"
          />
          <p className="form-hint">Use a negative number to decrease stock.</p>
        </div>

        <div className="form-group">
          <label htmlFor="adj-unit">Unit (optional)</label>
          <input
            id="adj-unit"
            type="text"
            value={unit}
            onChange={e => setUnit(e.target.value)}
            placeholder="e.g. g, ml, units"
          />
        </div>
      </div>

      <div className="form-group">
        <label>Type</label>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              name="adj-type"
              value="manual_adjustment"
              checked={transactionType === 'manual_adjustment'}
              onChange={() => setTransactionType('manual_adjustment')}
            />
            Manual adjustment
          </label>
          <label>
            <input
              type="radio"
              name="adj-type"
              value="waste"
              checked={transactionType === 'waste'}
              onChange={() => setTransactionType('waste')}
            />
            Waste (stock thrown away)
          </label>
        </div>
        <p className="form-hint">
          For waste, use a negative quantity to record food thrown away.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="adj-date">Date & Time</label>
        <input
          id="adj-date"
          type="datetime-local"
          value={occurredAt}
          onChange={e => setOccurredAt(e.target.value)}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Adjustment'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [stock, setStock] = useState<Record<string, Record<string, number>>>({});
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Fetch current user id
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // Load stock levels and recent transactions
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [stockData, txData] = await Promise.all([
        getIngredientStockLevels(),
        getInventoryTransactions(),
      ]);
      setStock(stockData);
      setTransactions(txData);
    } catch (err) {
      setError('Failed to load inventory data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdjustmentSaved = () => {
    setShowForm(false);
    loadData();
  };

  // Build a flat sorted list of ingredients from the stock map
  const stockRows = Object.entries(stock)
    .flatMap(([ingredient, units]) =>
      Object.entries(units).map(([unit, qty]) => ({ ingredient, unit, qty }))
    )
    .sort((a, b) => a.ingredient.localeCompare(b.ingredient));

  return (
    <div className="inventory-page">
      <div className="page-header">
        <h1>📦 Inventory</h1>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Adjust Stock
          </button>
        )}
      </div>

      {showForm && userId && (
        <AdjustForm
          userId={userId}
          onSaved={handleAdjustmentSaved}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <p className="loading-message">Loading…</p>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : (
        <>
          {/* ── Current Stock ── */}
          <section className="inventory-section">
            <h2>Current Stock</h2>
            {stockRows.length === 0 ? (
              <p className="empty-message">No inventory recorded yet. Add a shopping trip or adjust stock manually.</p>
            ) : (
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Quantity</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map(({ ingredient, unit, qty }) => (
                    <tr key={`${ingredient}-${unit}`} className={qty < 0 ? 'stock-negative' : ''}>
                      <td className="ingredient-name">{ingredient}</td>
                      <td className="stock-qty">{qty}</td>
                      <td className="stock-unit">{unit || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* ── Recent Transactions ── */}
          <section className="inventory-section">
            <h2>Transaction History</h2>
            {transactions.length === 0 ? (
              <p className="empty-message">No transactions yet.</p>
            ) : (
              <table className="tx-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ingredient</th>
                    <th>Change</th>
                    <th>Unit</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} className={tx.quantityDelta < 0 ? 'tx-negative' : 'tx-positive'}>
                      <td className="tx-date">{formatDate(tx.occurredAt)}</td>
                      <td className="tx-ingredient">{tx.ingredientName}</td>
                      <td className="tx-delta">
                        {tx.quantityDelta > 0 ? '+' : ''}{tx.quantityDelta}
                      </td>
                      <td className="tx-unit">{tx.unit || '—'}</td>
                      <td className="tx-type">{formatTransactionType(tx.transactionType)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="inventory-links">
            <h2>Plan and shop from here</h2>
            <div className="button-group">
              <Link to="/shopping" className="btn">
                Shopping List
              </Link>
              <Link to="/shopping-trips" className="btn">
                Shopping Trips
              </Link>
              <Link to="/plan" className="btn">
                Weekly Plan
              </Link>
              <Link to="/dashboard" className="btn btn-secondary">
                Dashboard
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
