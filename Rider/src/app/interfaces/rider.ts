export interface Rider {
    Loc_lat: number;
    Loc_lng: number;
    Rider_id: string;
    Rider_name: string;
    Rider_email: string;
    Rider_phone: any;
    Rider_imgUrl: string;
    Rider_rating: number;
    Des_lat: number;
    Des_lng: number;
    Rider_Location:  string;
    Rider_Destination: string;
    countDown: number;
    cancel: boolean;
    price: number;
    cash: boolean;
    // Shared ride fields
    sharedRideAccepted?: boolean;  // Rider opted in to share
    isSharedRide?: boolean;        // Matched with shared ride
    sharedRideId?: string;         // Reference to SharedRides document
    originalPrice?: number;        // Price before discount
    discountedPrice?: number;      // Final price after discount
    discountPercent?: number;      // Discount percentage (0-40%)
}

// Co-passenger info for shared rides
export interface CoPassenger {
    riderId: string;
    firstName: string;
    status: 'waiting' | 'picked_up' | 'dropped_off';
    generalArea: string;  // General area, not exact address (privacy)
    pickupOrder: number;  // Order in pickup queue
}

// SharedRides document structure
export interface SharedRide {
    sharedRideId: string;
    driverId: string;
    driverName: string;
    status: 'matching' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
    passengers: CoPassenger[];
    totalPassengers: number;
    maxPassengers: number;
    routeOptimized: boolean;
    createdAt: Date;
    updatedAt: Date;
}
