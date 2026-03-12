import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ShoppingTrip, ShoppingTripItem, StoreProduct } from '../../domain/types';
import {
  getShoppingTrips,
  createShoppingTrip,
  updateShoppingTrip,
  deleteShoppingTrip,
  addShoppingTripItem,
  updateShoppingTripItem,
  deleteShoppingTripItem,
} from './api';
import { getStoreProducts } from '../store-products/api';
import './ShoppingTripsPage.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayLocalISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── New Trip Form ─────────────────────────────────────────────────────────────

interface NewTripFormProps {
  onSave: (trip: ShoppingTrip) => void;
  onCancel: () => void;
}

function NewTripForm({ onSave, onCancel }: NewTripFormProps) {
  const [store, setStore] = useState('Coles');
  const [purchasedAt, setPurchasedAt] = useState(todayLocalISO());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store.trim()) { setError('Store name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const trip = await createShoppingTrip({
        store: store.trim(),
        purchasedAt: new Date(purchasedAt).toISOString(),
        notes: notes.trim() || undefined,
      });
      onSave(trip);
    } catch (err) {
      setError('Failed to create shopping trip.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="trip-form" onSubmit={handleSubmit}>
      <h2>New Shopping Trip</h2>
      {error && <p className="form-error">{error}</p>}
      <div className="form-group">
        <label htmlFor="trip-store">Store</label>
        <input
          id="trip-store"
          type="text"
          value={store}
          onChange={e => setStore(e.target.value)}
          placeholder="e.g. Coles, Woolworths"
        />
      </div>
      <div className="form-group">
        <label htmlFor="trip-date">Date &amp; Time</label>
        <input
          id="trip-date"
          type="datetime-local"
          value={purchasedAt}
          onChange={e => setPurchasedAt(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor="trip-notes">Notes (optional)</label>
        <textarea
          id="trip-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Any notes about this trip"
        />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Create Trip'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Product Name Combobox ─────────────────────────────────────────────────────

interface ProductComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (product: StoreProduct) => void;
  storeProducts: StoreProduct[];
}

function parseSizeLabel(sizeLabel: string): { packQuantity: string; packUnit: string } | null {
  const match = sizeLabel.trim().match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
  if (match) return { packQuantity: match[1], packUnit: match[2].trim() };
  return null;
}

const DROPDOWN_CLOSE_DELAY_MS = 150;

function ProductCombobox({ value, onChange, onSelect, storeProducts }: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = storeProducts.filter(p => {
    if (!value.trim()) return true;
    const q = value.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.brand?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleSelect = (product: StoreProduct) => {
    onSelect(product);
    setOpen(false);
  };

  return (
    <div className="product-name-combobox" ref={wrapperRef}>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), DROPDOWN_CLOSE_DELAY_MS)}
        placeholder="Product name"
        className="item-name-input"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="product-suggestions" role="listbox">
          {filtered.map(product => (
            <li
              key={product.id}
              className="product-suggestion-item"
              onMouseDown={() => handleSelect(product)}
              role="option"
            >
              <span className="suggestion-name">
                {product.brand ? `${product.brand} ` : ''}{product.name}
              </span>
              {product.sizeLabel && (
                <span className="suggestion-meta">{product.sizeLabel}</span>
              )}
              <span className="suggestion-store">{product.store}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Add Item Form ─────────────────────────────────────────────────────────────

interface AddItemFormProps {
  tripId: string;
  onSave: (item: ShoppingTripItem) => void;
  storeProducts: StoreProduct[];
}

function AddItemForm({ tripId, onSave, storeProducts }: AddItemFormProps) {
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [packQuantity, setPackQuantity] = useState('');
  const [packUnit, setPackUnit] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleProductSelect = (product: StoreProduct) => {
    setProductName(product.brand ? `${product.brand} ${product.name}` : product.name);
    if (product.sizeLabel) {
      const parsed = parseSizeLabel(product.sizeLabel);
      if (parsed) {
        setPackQuantity(parsed.packQuantity);
        setPackUnit(parsed.packUnit);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) { setError('Product name is required.'); return; }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) { setError('Quantity must be a positive number.'); return; }
    setSaving(true);
    setError('');
    try {
      const item = await addShoppingTripItem({
        shoppingTripId: tripId,
        productName: productName.trim(),
        quantityPurchased: qty,
        packQuantity: packQuantity ? parseFloat(packQuantity) : undefined,
        packUnit: packUnit.trim() || undefined,
      });
      onSave(item);
      setProductName('');
      setQuantity('1');
      setPackQuantity('');
      setPackUnit('');
    } catch (err) {
      setError('Failed to add item.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="add-item-row" onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <ProductCombobox
        value={productName}
        onChange={setProductName}
        onSelect={handleProductSelect}
        storeProducts={storeProducts}
      />
      <input
        type="number"
        value={quantity}
        onChange={e => setQuantity(e.target.value)}
        placeholder="Qty"
        min="0.01"
        step="0.01"
        className="item-qty-input"
      />
      <input
        type="number"
        value={packQuantity}
        onChange={e => setPackQuantity(e.target.value)}
        placeholder="Pack size"
        min="0.01"
        step="0.01"
        className="item-pack-qty-input"
      />
      <input
        type="text"
        value={packUnit}
        onChange={e => setPackUnit(e.target.value)}
        placeholder="Unit (e.g. g, ml)"
        className="item-pack-unit-input"
      />
      <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
        {saving ? '…' : '+ Add'}
      </button>
    </form>
  );
}

// ─── Trip Item Row ─────────────────────────────────────────────────────────────

interface TripItemRowProps {
  item: ShoppingTripItem;
  onUpdate: (item: ShoppingTripItem) => void;
  onDelete: (id: string) => void;
}

function TripItemRow({ item, onUpdate, onDelete }: TripItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [productName, setProductName] = useState(item.productName);
  const [quantity, setQuantity] = useState(String(item.quantityPurchased));
  const [packQuantity, setPackQuantity] = useState(item.packQuantity != null ? String(item.packQuantity) : '');
  const [packUnit, setPackUnit] = useState(item.packUnit ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateShoppingTripItem(item.id, {
        productName: productName.trim(),
        quantityPurchased: parseFloat(quantity) || 1,
        packQuantity: packQuantity ? parseFloat(packQuantity) : null,
        packUnit: packUnit.trim() || null,
      });
      onUpdate(updated);
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove "${item.productName}"?`)) return;
    try {
      await deleteShoppingTripItem(item.id);
      onDelete(item.id);
    } catch (err) {
      console.error(err);
    }
  };

  if (editing) {
    return (
      <div className="trip-item editing">
        <input
          type="text"
          value={productName}
          onChange={e => setProductName(e.target.value)}
          className="item-name-input"
        />
        <input
          type="number"
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          min="0.01"
          step="0.01"
          className="item-qty-input"
        />
        <input
          type="number"
          value={packQuantity}
          onChange={e => setPackQuantity(e.target.value)}
          min="0.01"
          step="0.01"
          placeholder="Pack size"
          className="item-pack-qty-input"
        />
        <input
          type="text"
          value={packUnit}
          onChange={e => setPackUnit(e.target.value)}
          placeholder="Unit"
          className="item-pack-unit-input"
        />
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? '…' : '✓ Save'}
        </button>
        <button className="btn btn-sm" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    );
  }

  const packLabel = item.packQuantity
    ? `${item.packQuantity}${item.packUnit ? item.packUnit : ''}`
    : null;

  return (
    <div className="trip-item">
      <span className="item-check">☑</span>
      <span className="item-product-name">{item.productName}</span>
      <span className="item-qty-badge">×{item.quantityPurchased}</span>
      {packLabel && <span className="item-pack-label">{packLabel}</span>}
      <div className="item-actions">
        <button className="icon-btn" onClick={() => setEditing(true)} title="Edit">✏️</button>
        <button className="icon-btn danger" onClick={handleDelete} title="Remove">🗑️</button>
      </div>
    </div>
  );
}

// ─── Trip Card ─────────────────────────────────────────────────────────────────

interface TripCardProps {
  trip: ShoppingTrip;
  onUpdate: (trip: ShoppingTrip) => void;
  onDelete: (id: string) => void;
  storeProducts: StoreProduct[];
}

function TripCard({ trip, onUpdate, onDelete, storeProducts }: TripCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingTrip, setEditingTrip] = useState(false);
  const [store, setStore] = useState(trip.store);
  const [purchasedAt, setPurchasedAt] = useState(
    trip.purchasedAt.slice(0, 16)
  );
  const [notes, setNotes] = useState(trip.notes ?? '');
  const [savingTrip, setSavingTrip] = useState(false);

  const handleTripSave = async () => {
    setSavingTrip(true);
    try {
      const updated = await updateShoppingTrip(trip.id, {
        store: store.trim(),
        purchasedAt: new Date(purchasedAt).toISOString(),
        notes: notes.trim() || undefined,
      });
      onUpdate(updated);
      setEditingTrip(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingTrip(false);
    }
  };

  const handleTripDelete = async () => {
    if (!confirm(`Delete trip at ${trip.store} on ${formatDate(trip.purchasedAt)}?`)) return;
    try {
      await deleteShoppingTrip(trip.id);
      onDelete(trip.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleItemAdded = (item: ShoppingTripItem) => {
    onUpdate({ ...trip, items: [...trip.items, item] });
  };

  const handleItemUpdated = (updated: ShoppingTripItem) => {
    onUpdate({ ...trip, items: trip.items.map(i => i.id === updated.id ? updated : i) });
  };

  const handleItemDeleted = (id: string) => {
    onUpdate({ ...trip, items: trip.items.filter(i => i.id !== id) });
  };

  return (
    <div className={`trip-card ${expanded ? 'expanded' : ''}`}>
      <div className="trip-card-header" onClick={() => !editingTrip && setExpanded(prev => !prev)}>
        {editingTrip ? (
          <div className="trip-edit-inline" onClick={e => e.stopPropagation()}>
            <input
              type="text"
              value={store}
              onChange={e => setStore(e.target.value)}
              placeholder="Store"
              className="trip-store-input"
            />
            <input
              type="datetime-local"
              value={purchasedAt}
              onChange={e => setPurchasedAt(e.target.value)}
              className="trip-date-input"
            />
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes"
              className="trip-notes-input"
            />
            <button className="btn btn-primary btn-sm" onClick={handleTripSave} disabled={savingTrip}>
              {savingTrip ? '…' : '✓ Save'}
            </button>
            <button className="btn btn-sm" onClick={() => setEditingTrip(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="trip-info">
              <span className="trip-store">🛒 {trip.store}</span>
              <span className="trip-date">{formatDate(trip.purchasedAt)}</span>
              {trip.notes && <span className="trip-notes">{trip.notes}</span>}
            </div>
            <div className="trip-meta">
              <span className="trip-item-count">{trip.items.length} item{trip.items.length !== 1 ? 's' : ''}</span>
              <button
                className="icon-btn"
                onClick={e => { e.stopPropagation(); setEditingTrip(true); setExpanded(true); }}
                title="Edit trip"
              >
                ✏️
              </button>
              <button
                className="icon-btn danger"
                onClick={e => { e.stopPropagation(); handleTripDelete(); }}
                title="Delete trip"
              >
                🗑️
              </button>
              <span className="expand-icon">{expanded ? '▲' : '▼'}</span>
            </div>
          </>
        )}
      </div>

      {expanded && (
        <div className="trip-card-body">
          <div className="items-list">
            {trip.items.length === 0 ? (
              <p className="empty-items">No items yet. Add the first one below.</p>
            ) : (
              trip.items.map(item => (
                <TripItemRow
                  key={item.id}
                  item={item}
                  onUpdate={handleItemUpdated}
                  onDelete={handleItemDeleted}
                />
              ))
            )}
          </div>
          <div className="add-item-section">
            <h4>Add Item</h4>
            <div className="add-item-labels">
              <span>Product name</span>
              <span>Qty</span>
              <span>Pack size</span>
              <span>Unit</span>
            </div>
            <AddItemForm tripId={trip.id} onSave={handleItemAdded} storeProducts={storeProducts} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ShoppingTripsPage() {
  const [trips, setTrips] = useState<ShoppingTrip[]>([]);
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    Promise.all([getShoppingTrips(), getStoreProducts()])
      .then(([fetchedTrips, fetchedProducts]) => {
        setTrips(fetchedTrips);
        setStoreProducts(fetchedProducts);
      })
      .catch(err => {
        setError('Failed to load shopping trips or products.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleTripCreated = (trip: ShoppingTrip) => {
    setTrips(prev => [trip, ...prev]);
    setShowNewForm(false);
  };

  const handleTripUpdated = (updated: ShoppingTrip) => {
    setTrips(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  const handleTripDeleted = (id: string) => {
    setTrips(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="shopping-trips-page">
      <div className="page-header">
        <h1>🧾 Shopping Trips</h1>
        {!showNewForm && (
          <button className="btn btn-primary" onClick={() => setShowNewForm(true)}>
            + New Trip
          </button>
        )}
      </div>

      {showNewForm && (
        <NewTripForm
          onSave={handleTripCreated}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {loading ? (
        <p className="loading-msg">Loading trips…</p>
      ) : error ? (
        <p className="error-msg">{error}</p>
      ) : trips.length === 0 && !showNewForm ? (
        <div className="empty-state">
          <p>No shopping trips recorded yet.</p>
          <button className="btn btn-primary" onClick={() => setShowNewForm(true)}>
            Record Your First Trip
          </button>
        </div>
      ) : (
        <div className="trips-list">
          {trips.map(trip => (
            <TripCard
              key={trip.id}
              trip={trip}
              onUpdate={handleTripUpdated}
              onDelete={handleTripDeleted}
              storeProducts={storeProducts}
            />
          ))}
        </div>
      )}

      <section className="shopping-trips-links">
        <h2>Plan and inventory</h2>
        <div className="button-group">
          <Link to="/shopping" className="btn">
            Open Shopping List
          </Link>
          <Link to="/inventory" className="btn">
            View Inventory
          </Link>
          <Link to="/plan" className="btn btn-secondary">
            Weekly Plan
          </Link>
        </div>
      </section>
    </div>
  );
}
