import type { AppConfig } from '../types/index';

export async function getConfig(): Promise<AppConfig> {
  const response = await fetch('/api/config');
  if (!response.ok) {
    throw new Error('Failed to get config');
  }
  return response.json();
}

export async function updateConfig(partial: Partial<AppConfig>): Promise<AppConfig> {
  const response = await fetch('/api/config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(partial)
  });
  if (!response.ok) {
    throw new Error('Failed to update config');
  }
  return response.json();
}
