// Guardar el ID estable en SQL. El catálogo visual se puede ampliar después.
export const productIcons = [
  { id: 'food', symbol: '🥫', label: 'Alimentos' },
  { id: 'dairy', symbol: '🥛', label: 'Lácteos' },
  { id: 'produce', symbol: '🥕', label: 'Frutas y verduras' },
  { id: 'cleaning', symbol: '🧹', label: 'Aseo' },
  { id: 'pet', symbol: '🐶', label: 'Mascotas' },
  { id: 'paper', symbol: '🧻', label: 'Papel higiénico' },
  { id: 'hygiene', symbol: '🧼', label: 'Higiene' },
  { id: 'other', symbol: '📦', label: 'Otros' },
] as const;

export type ProductIconId = typeof productIcons[number]['id'];
