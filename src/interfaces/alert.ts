export interface AlertConfig {
  title: string
  body?: string
  status: 'success' | 'error' | 'info' | 'warning'
  icon?: string
}
