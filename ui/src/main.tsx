import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { Toast } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerClaudeModule } from './modules/claude/register';
import { registerDatabaseModule } from './modules/database/register';
import { registerSearchModule } from './modules/search/register';
import { registerTerminalModule } from './modules/terminal/register';
import { registerScratchpadModule } from './modules/scratchpad/register';
import { registerGitModule } from './modules/git/register';
import { registerActionsModule } from './modules/actions/register';
import './styles/global.css';

// Registration order determines activity bar order
registerClaudeModule();
registerDatabaseModule();
registerSearchModule();
registerTerminalModule();
registerScratchpadModule();
registerGitModule();
registerActionsModule();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Toast />
    </ErrorBoundary>
  </React.StrictMode>,
);
