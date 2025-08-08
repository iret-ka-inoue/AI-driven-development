import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Amplify } from 'aws-amplify'
import awsConfig from './aws-exports'

Amplify.configure(awsConfig)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App signOut={function (): void {
      throw new Error('Function not implemented.')
    } } user={undefined} />
  </StrictMode>,
)