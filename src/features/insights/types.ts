// Insights feature types
export interface AIInsight {
  id: string;
  type: 'analysis' | 'recommendation' | 'alert';
  title: string;
  content: string;
  confidence: number;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface JourneyStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  completedAt?: string;
  order: number;
}

export interface UserJourney {
  id: string;
  name: string;
  description: string;
  steps: JourneyStep[];
  progress: number;
}