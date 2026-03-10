import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Provider = 'google' | 'github'

interface ProviderConfig {
  label: string
  icon: string
}

const PROVIDERS: Record<Provider, ProviderConfig> = {
  google: {
    label: 'Continue with Google',
    icon: '🔵',
  },
  github: {
    label: 'Continue with GitHub',
    icon: '🐱',
  },
}

export default function SocialLoginButtons() {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleOAuth = async (provider: Provider) => {
    setLoadingProvider(provider)
    setError(null)

    const redirectTo = window.location.origin

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    })

    if (error) {
      let msg = error.message
      if (msg.toLowerCase().includes('popup')) {
        msg = 'Popup was blocked. Please allow popups and try again.'
      } else if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('denied')) {
        msg = 'Sign-in was cancelled.'
      }
      setError(msg)
      setLoadingProvider(null)
    }
    // On success Supabase redirects the browser, so no further action needed.
  }

  return (
    <div className="social-login">
      <div className="social-divider">
        <span>or</span>
      </div>

      {error && <div className="auth-error">{error}</div>}

      {(Object.entries(PROVIDERS) as [Provider, ProviderConfig][]).map(([provider, config]) => (
        <button
          key={provider}
          type="button"
          className="social-btn"
          disabled={loadingProvider !== null}
          onClick={() => handleOAuth(provider)}
          aria-label={loadingProvider === provider ? `Redirecting to ${provider}…` : config.label}
        >
          <span className="social-btn-icon" aria-hidden="true">{config.icon}</span>
          {loadingProvider === provider ? 'Redirecting…' : config.label}
        </button>
      ))}
    </div>
  )
}
