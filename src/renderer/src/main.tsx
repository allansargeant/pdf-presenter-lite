import './App.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Output from './Output'

const isOutput = new URLSearchParams(window.location.search).get('mode') === 'output'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isOutput ? <Output /> : <App />}</StrictMode>
)
