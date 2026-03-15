import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { addStockByPacks, addStockDirect, getPantryItems, setAutoReorder, type PantryItem } from './api';
import { getLinkedProductsForIngredients, type LinkedProduct } from '../product-linking/api';
import './PantryPage.css';

function daysSince(dateStr?: string): string {
  if (!dateStr) return 'never';
  const d = new Date(dateStr);
  const today = new Date();
  const ms = today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

type Unit = 'g' | 'ml' | 'units';

interface AddStockModalProps {
  ingredientName?: string;
  onClose: () => void;
  onAdded: () => void;
}

function AddStockModal({ ingredientName, onClose, onAdded }: AddStockModalProps) {
  const [name, setName] = useState(ingredientName ?? '');
  const [packs, setPacks] = useState<number>(1);
  const [directQty, setDirectQty] = useState<number>(0);
  const [directUnit, setDirectUnit] = useState<Unit>('g');
  const [link, setLink] = useState<LinkedProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadLink() {
      if (!name.trim()) { setLink(null); return; }
      try {
        const map = await getLinkedProductsForIngredients([name.trim()]);
        if (!active) return;
        const found = map.get(name.trim().toLowerCase()) ?? null;
        setLink(found ?? null);
      } catch {
        if (active) setLink(null);
      }
    }
    loadLink();
    return () => { active = false; };
  }, [name]);

  const packSizeLabel = useMemo(() => {
    if (!link) return null;
    if (link.packSizeG) return `${link.packSizeG} g`;
    if (link.packSizeMl) return `${link.packSizeMl} ml`;
    if (link.packSizeUnits) return `${link.packSizeUnits} units`;
    return null;
  }, [link]);

  const handleAdd = async () => {
    if (!name.trim()) { setError('Ingredient name is required.'); return; }
    setError('');
    setLoading(true);
    try {
      if (link && packs > 0) {
        await addStockByPacks(name.trim(), packs);
      } else {
        if (!(directQty > 0)) { setError('Enter a quantity greater than zero.'); setLoading(false); return; }
        await addStockDirect(name.trim(), directUnit, directQty);
      }
      onAdded();
      onClose();
    } catch (err) {
      console.error(err);
      setError((err as Error)?.message || 'Failed to add stock.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Add Stock</h2>
        {error && <p className="form-error">{error}</p>}
        <div className="form-group">
          <label>Ingredient</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Mozzarella"
            autoFocus
          />
        </div>

        {link ? (
          <>
            <p className="help-text">
              Linked product: <strong>{link.productName}</strong>{' '}
              {packSizeLabel ? <span>({packSizeLabel} per pack)</span> : null}
            </p>
            <div className="form-group">
              <label>How many packs did you buy?</label>
              <input
                type="number"
                min={1}
                step={1}
                value={packs}
                onChange={e => setPacks(parseInt(e.target.value || '0', 10))}
              />
            </div>
          </>
        ) : (
          <>
            <p className="help-text">
              No linked product found. Enter quantity directly.
            </p>
            <div className="form-row">
              <div className="form-group">
                <label>Quantity</label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={directQty}
                  onChange={e => setDirectQty(parseFloat(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Unit</label>
                <select value={directUnit} onChange={e => setDirectUnit(e.target.value as Unit)}>
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="units">units</option>
                </select>
              </div>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleAdd} disabled={loading}>
            {loading ? 'Adding…' : 'Add Stock'}
          </button>
          <button className="btn" onClick={onClose} disabled={loading}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingFor, setAddingFor] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await getPantryItems();
      setItems(rows);
    } catch (err) {
      console.error(err);
      setError('Failed to load pantry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggle = async (row: PantryItem) => {
    try {
      await setAutoReorder(row.id, !row.autoReorder);
      setItems(prev => prev.map(i => i.id === row.id ? { ...i, autoReorder: !i.autoReorder } : i));
    } catch (err) {
      console.error(err);
      // no-op UI error for now
    }
  };

  const hasItems = items.length > 0;

  return (
    <div className="pantry-page">
      <div className="page-header">
        <h1>🥫 Pantry</h1>
        <button className="btn btn-primary" onClick={() => setAddingFor('')}>
          + Add Stock
        </button>
      </div>

      {loading ? (
        <p className="loading-message">Loading…</p>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : !hasItems ? (
        <div className="empty-state">
          <p>Add your first item or link a product to get started.</p>
          <button className="btn" onClick={() => setAddingFor('')}>Add Stock</button>
        </div>
      ) : (
        <div className="pantry-grid">
          {items.map(item => {
            const purchased = Math.max(0, item.purchasedQty);
            const remaining = Math.max(0, item.remainingQty);
            const pct = purchased > 0 ? Math.max(0, Math.min(100, Math.round((remaining / purchased) * 100))) : 0;
            const displayName = item.productName ?? item.ingredientName;
            return (
              <div key={item.id} className="pantry-card">
                <div className="pantry-title">
                  <div className="name">{displayName}</div>
                  <div className="last-badge">bought {daysSince(item.lastPurchaseDate)}</div>
                </div>
                <div className="stock-bar">
                  <div className="fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="qty-row">
                  <div className="qty-text">
                    {remaining}{item.unit} remaining of {purchased}{item.unit} purchased
                  </div>
                  <div className="actions">
                    <button className="btn btn-sm" onClick={() => setAddingFor(item.ingredientName)}>+ Add stock</button>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={item.autoReorder}
                        onChange={() => handleToggle(item)}
                      />
                      <span>Auto-reorder</span>
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addingFor !== null && (
        <AddStockModal
          ingredientName={addingFor || undefined}
          onClose={() => setAddingFor(null)}
          onAdded={load}
        />
      )}
    </div>
  );
}

