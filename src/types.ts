export interface Meeting {
  id: string;
  title: string;
  createdAt: number;
  duration: number;
  transcript: TranscriptSegment[];
  summary?: string;
  audioUrl?: string;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
  speaker?: string;
}

export type SubscriptionPlan = 'monthly' | 'annually' | 'free';
