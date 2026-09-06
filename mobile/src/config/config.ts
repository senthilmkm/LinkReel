export interface AppConfig {
  env: 'development' | 'staging' | 'production';
  api: {
    baseUrl: string;
    timeoutMs: number;
  };
  firebase: {
    projectId: string;
  };
}

export const Config: AppConfig = {
  env: (process.env.EXPO_PUBLIC_APP_ENV as any) || 'development',
  api: {
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://linkreel-api-500289079249.us-central1.run.app',
    timeoutMs: Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS) || 30000,
  },
  firebase: {
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'linkreel-app-3190',
  },
};
