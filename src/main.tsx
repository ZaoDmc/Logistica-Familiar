import React from 'react';
import ReactDOM from 'react-dom/client';
import { productIcons } from './catalogs/icons';
import './styles.css';

function App() {
  return (
    <main>
      <header><span className="mark" aria-hidden="true">⌂</span><span>Logística Familiar</span></header>
      <section className="intro" aria-labelledby="title">
        <p className="eyebrow">UN HOGAR, TODOS AL DÍA</p>
        <h1 id="title">Lo que hay en casa,<br />a mano.</h1>
        <p>Un lugar compartido para saber qué queda y qué hace falta, estés donde estés.</p>
      </section>
      <section className="status" aria-labelledby="status-title">
        <span className="badge">Fase 0 · Preparación</span>
        <h2 id="status-title">La base de nuestro hogar</h2>
        <p>El proyecto está preparado para comenzar. Las cuentas, el inventario y los cambios en vivo se incorporarán en las próximas fases.</p>
        <p className="note">Esta pantalla no contiene stock real ni está conectada a una base de datos.</p>
      </section>
      <section aria-labelledby="catalog-title">
        <h2 id="catalog-title">Iconos para organizar lo cotidiano</h2>
        <p>Catálogo inicial para las futuras categorías y productos.</p>
        <ul className="catalog">{productIcons.map(icon => (
          <li key={icon.id}><span aria-hidden="true">{icon.symbol}</span>{icon.label}</li>
        ))}</ul>
      </section>
      <footer>Hecho para compartir las tareas de casa.</footer>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
