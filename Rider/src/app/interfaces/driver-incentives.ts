// Driver Incentives Interfaces

export interface DriverIncentive {
  incentiveId: string;
  name: string;
  description: string;
  type: 'bonus' | 'streak' | 'peak_hour' | 'quest' | 'referral' | 'rating';
  
  // Conditions
  conditions: IncentiveCondition[];
  
  // Reward
  rewardType: 'fixed' | 'percentage' | 'multiplier';
  rewardAmount: number;
  maxReward?: number;
  currency: string;
  
  // Validity
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  
  // Targeting
  targetDrivers: 'all' | 'new' | 'inactive' | 'top_rated' | 'specific';
  targetDriverIds?: string[];
  targetCities?: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IncentiveCondition {
  conditionType: 'min_rides' | 'min_hours' | 'min_rating' | 'acceptance_rate' | 'completion_rate' | 'time_range' | 'area';
  operator: 'gte' | 'lte' | 'eq' | 'between';
  value: number | string;
  value2?: number | string; // For 'between' operator
}

export interface DriverStreak {
  streakId: string;
  driverId: string;
  streakType: 'daily' | 'weekly' | 'rides_consecutive' | 'acceptance';
  
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  
  // Rewards earned
  totalRewardsEarned: number;
  currency: string;
  
  // Current progress
  targetForNextReward: number;
  rewardAtTarget: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverQuest {
  questId: string;
  driverId: string;
  incentiveId: string;
  questName: string;
  
  // Progress
  targetRides: number;
  completedRides: number;
  progress: number; // percentage
  
  // Time window
  startTime: Date;
  endTime: Date;
  
  // Reward
  rewardAmount: number;
  currency: string;
  
  // Status
  status: 'active' | 'completed' | 'failed' | 'expired';
  completedAt?: Date;
  rewardPaidAt?: Date;
  
  createdAt: Date;
}

export interface PeakHourMultiplier {
  multiplierId: string;
  name: string;
  
  // Time configuration
  dayOfWeek: number[]; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:mm format
  endTime: string;
  
  // Multiplier
  multiplier: number; // e.g., 1.5x, 2x
  
  // Area (optional)
  areaId?: string;
  areaName?: string;
  geofence?: {
    lat: number;
    lng: number;
    radius: number; // meters
  };
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverEarnings {
  earningsId: string;
  driverId: string;
  period: 'daily' | 'weekly' | 'monthly';
  periodStart: Date;
  periodEnd: Date;
  
  // Earnings breakdown
  rideEarnings: number;
  tips: number;
  bonuses: number;
  incentives: number;
  peakHourExtra: number;
  
  // Deductions
  commissionDeducted: number;
  
  // Totals
  grossEarnings: number;
  netEarnings: number;
  currency: string;
  
  // Stats
  totalRides: number;
  totalHoursOnline: number;
  averageRating: number;
  acceptanceRate: number;
  completionRate: number;
  
  createdAt: Date;
}

export interface DriverLeaderboard {
  leaderboardId: string;
  period: 'daily' | 'weekly' | 'monthly';
  periodStart: Date;
  periodEnd: Date;
  city?: string;
  
  rankings: DriverRanking[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverRanking {
  rank: number;
  driverId: string;
  driverName: string;
  driverImage?: string;
  
  // Metrics
  totalRides: number;
  totalEarnings: number;
  averageRating: number;
  
  // Rewards
  rewardAmount?: number;
  rewardType?: string;
}
