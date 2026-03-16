import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { Toast } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerGalactaModule } from './modules/galacta/register';
import { registerDatabaseModule } from './modules/database/register';
import { registerSearchModule } from './modules/search/register';
import { registerTerminalModule } from './modules/terminal/register';
import { registerScratchpadModule } from './modules/scratchpad/register';
import { registerGitModule } from './modules/git/register';
import { registerActionsModule } from './modules/actions/register';
import { registerKanbanModule } from './modules/kanban/register';
import { registerProductModule } from './modules/product/register';
import './styles/global.css';

// Registration order determines activity bar order
registerGalactaModule();
registerDatabaseModule();
registerSearchModule();
registerTerminalModule();
registerScratchpadModule();
registerGitModule();
registerActionsModule();
registerKanbanModule();
registerProductModule();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Toast />
    </ErrorBoundary>
  </React.StrictMode>,
);
