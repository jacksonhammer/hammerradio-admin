export interface ChatMessage {
  id: string;
  text: string;
  nickname: string;
  userId: string;
  source: 'app' | 'web' | 'admin';
  ts: number;
  banned?: boolean;
}

export interface SongRequest {
  id: string;
  song: string;
  artist?: string;
  message?: string;
  userId?: string;
  uid?: string;
  requestedBy?: string;
  nickname?: string;
  createdAt?: any;
  ts?: number;
  status: 'pending' | 'played' | 'skipped';
}

export interface BannedUser {
  userId: string;
  nickname?: string;
  bannedAt: number;
  reason?: string;
}

export interface AppUser {
  userId: string;
  nickname?: string;
  pushToken?: string;
  lastSeen?: number;
  platform?: string;
}
