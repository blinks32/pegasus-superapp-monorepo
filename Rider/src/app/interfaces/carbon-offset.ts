// Carbon Offset / Eco Mode Interfaces

export interface CarbonFootprint {
  footprintId: string;
  userId: string;
  rideId: string;
  
  // Trip details
  distance: number; // km
  duration: number; // minutes
  vehicleType: string;
  fuelType: 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'cng';
  
  // Emissions
  co2Emissions: number; // kg CO2
  co2Saved?: number; // kg CO2 saved vs driving alone
  
  // Offset
  offsetPurchased: boolean;
  offsetAmount?: number;
  offsetCost?: number;
  offsetProjectId?: string;
  
  createdAt: Date;
}

export interface UserCarbonStats {
  userId: string;
  
  // Totals
  totalRides: number;
  totalDistance: number; // km
  totalCo2Emitted: number; // kg
  totalCo2Offset: number; // kg
  totalCo2Saved: number; // kg (vs driving alone)
  
  // Eco rides
  ecoRidesCount: number;
  electricRidesCount: number;
  hybridRidesCount: number;
  sharedRidesCount: number;
  
  // Offset spending
  totalOffsetSpent: number;
  currency: string;
  
  // Badges
  badges: EcoBadge[];
  
  // Monthly breakdown
  monthlyStats: MonthlyCarbonStats[];
  
  updatedAt: Date;
}

export interface MonthlyCarbonStats {
  month: string; // YYYY-MM
  rides: number;
  distance: number;
  co2Emitted: number;
  co2Offset: number;
  co2Saved: number;
}

export interface EcoBadge {
  badgeId: string;
  name: string;
  description: string;
  iconUrl: string;
  earnedAt: Date;
  level: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface OffsetProject {
  projectId: string;
  name: string;
  description: string;
  location: string;
  imageUrl: string;
  
  // Project type
  type: 'reforestation' | 'renewable_energy' | 'methane_capture' | 'ocean_cleanup' | 'conservation';
  
  // Pricing
  pricePerTon: number; // Price per ton of CO2
  currency: string;
  
  // Impact
  totalCo2Offset: number; // tons
  totalContributors: number;
  
  // Verification
  verificationBody: string;
  certificationUrl?: string;
  
  isActive: boolean;
  createdAt: Date;
}

export interface EcoVehiclePreference {
  preferenceId: string;
  userId: string;
  
  // Preferences
  preferEcoVehicles: boolean;
  preferElectric: boolean;
  preferHybrid: boolean;
  autoOffset: boolean; // Automatically offset all rides
  
  // Notifications
  showCarbonFootprint: boolean;
  ecoTipsEnabled: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleEmissionFactor {
  vehicleType: string;
  fuelType: 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'cng';
  co2PerKm: number; // kg CO2 per km
  isEcoFriendly: boolean;
  ecoRating: number; // 1-5 stars
}
