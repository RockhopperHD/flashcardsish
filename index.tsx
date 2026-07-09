import './src/tailwind.css';
import './App';
import { registerFlashcardsishServiceWorker } from './src/pwa';

window.addEventListener('load', () => {
  void registerFlashcardsishServiceWorker();
});
