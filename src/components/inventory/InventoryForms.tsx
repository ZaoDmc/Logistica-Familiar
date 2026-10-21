import { useId, useState, type FormEvent } from 'react';
import { productIcons, type ProductIconId } from '../../catalogs/icons';
import { parseStock, type Category, type Mutation } from '../../lib/inventory-model';

export function IconPicker({ value, onChange, disabled }: { value: ProductIconId; onChange: (value: ProductIconId) => void; disabled: boolean }) {
  const id = useId();
  return <fieldset className="icon-picker" disabled={disabled}><legend>Icono</legend><div className="icon-options">{productIcons.map(icon => <label key={icon.id} className={value === icon.id ? 'selected' : ''}>
    <input type="radio" name={`${id}-icon`} value={icon.id} checked={value === icon.id} onChange={() => onChange(icon.id)} /><span aria-hidden="true">{icon.symbol}</span><span>{icon.label}</span>{value === icon.id && <span className="icon-check" aria-hidden="true">✓</span>}
  </label>)}</div></fieldset>;
}
export function InventoryForm({ kind, categories, disabled, mutate, onClose }: {
  kind: 'category' | 'product'; categories: Category[]; disabled: boolean;
  mutate: (intent: Mutation) => Promise<void>; onClose: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(''), [description, setDescription] = useState('');
  const [icon, setIcon] = useState<ProductIconId>('other'), [category, setCategory] = useState(categories[0]?.id || '');
  const [stock, setStock] = useState('0'), [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault(); if (disabled) return;
    if (!name.trim()) { setError('Escribe un nombre para continuar.'); return; }
    const quantity = parseStock(stock);
    if (kind === 'product' && (quantity === null || !categories.some(item => item.id === category))) { setError('Revisa la categoría y la cantidad inicial.'); return; }
    setError('');
    try {
      await mutate(kind === 'category' ? { type: 'category', name: name.trim(), icon_id: icon } : {
        type: 'product', operation_id: crypto.randomUUID(), product: { category_id: category, name: name.trim(), description: description.trim(), icon_id: icon, stock: quantity! },
      });
      onClose();
    } catch (error) { setError(error instanceof Error ? error.message : 'No pudimos guardar los datos.'); }
  }
  return <section className="card inventory-form" aria-labelledby={`${id}-title`}>
    <div className="section-heading"><h2 id={`${id}-title`}>{kind === 'category' ? 'Nueva categoría' : 'Nuevo producto'}</h2><button className="text-button" type="button" onClick={onClose} disabled={disabled}>Cerrar</button></div>
    <form onSubmit={save} className="form-stack" aria-busy={disabled}>
      <label htmlFor={`${id}-name`}>Nombre {kind === 'category' ? 'de la categoría' : 'del producto'}</label><input id={`${id}-name`} autoFocus required maxLength={kind === 'category' ? 80 : 100} value={name} onChange={event => setName(event.target.value)} disabled={disabled} placeholder={kind === 'category' ? 'Por ejemplo, Mascotas' : 'Por ejemplo, Comida del Logan Cannes'} />
      {kind === 'product' && <><label htmlFor={`${id}-category`}>Categoría del producto</label><select id={`${id}-category`} value={category} onChange={event => setCategory(event.target.value)} required disabled={disabled}>{categories.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
        <label htmlFor={`${id}-description`}>Descripción breve <span className="optional">(opcional)</span></label><textarea id={`${id}-description`} rows={2} maxLength={240} value={description} onChange={event => setDescription(event.target.value)} disabled={disabled} placeholder="Formato, marca o algún detalle útil" /><p className="small character-count">{description.length}/240 caracteres</p>
        <label htmlFor={`${id}-stock`}>Cantidad inicial en casa</label><input id={`${id}-stock`} type="number" inputMode="numeric" min={0} max={1000000} step={1} required value={stock} onChange={event => setStock(event.target.value)} disabled={disabled} /><p className="small">Cuenta unidades, envases o paquetes completos. Cero indica que hace falta comprar.</p></>}
      <IconPicker value={icon} onChange={setIcon} disabled={disabled} />
      {error && <p className="alert error" role="alert">{error}</p>}
      <button className="primary" disabled={disabled}>{disabled ? 'Guardando…' : kind === 'category' ? 'Guardar categoría' : 'Agregar producto al hogar'}</button>
    </form>
  </section>;
}
