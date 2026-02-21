declare namespace google {
    namespace maps {
        class DirectionsService {
            route(request: any, callback: any): void;
        }
        enum TravelMode {
            DRIVING = 'DRIVING',
            WALKING = 'WALKING',
            BICYCLING = 'BICYCLING',
            TRANSIT = 'TRANSIT'
        }
        class DirectionsRenderer {
            setMap(map: any): void;
            setDirections(directions: any): void;
        }
        class LatLng {
            constructor(lat: number, lng: number);
        }
    }
}
