import { defineStore } from 'pinia'

export interface NavLink {
  label: string
  to: string
}

/**
 * Global navigation links, shared across the whole app shell.
 * Feature-specific state does NOT belong here — see ARCHITECTURE.md.
 */
export const useNavStore = defineStore('nav', {
  state: () => ({
    links: [
      { label: 'Home', to: '/' },
      { label: 'Character Builder', to: '/builder' },
      { label: 'Character Sheet', to: '/sheet' },
      { label: 'Compendium', to: '/compendium' },
    ] as NavLink[],
  }),
})
