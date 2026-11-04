import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  return (
    <main>
      <span className="eyebrow">CHESS ANALYZER · EARLY DEVELOPMENT</span>
      <h1>Learn from every game.</h1>
      <p>A shared home for your Lichess and Chess.com history, statistics, and post-game analysis.</p>
      <section aria-labelledby="development-status">
        <h2 id="development-status">The foundation is ready.</h2>
        <p>Game imports, statistics, and analysis are coming next. This initial version does not connect or verify chess accounts yet.</p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
