import { rows } from '../data/generated-catalog.js';
export default function Catalog() {
  return <ul id="catalog">{rows.map(row => <li key={row.id}>{row.name}</li>)}</ul>;
}
