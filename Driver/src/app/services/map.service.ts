import { Injectable, NgZone } from '@angular/core';
import { throwError } from 'rxjs';
import { GoogleMap, MapType } from '@capacitor/google-maps';
import { environment } from 'src/environments/environment';
import { GeocodeService } from './geocode.service';
import { OverlayService } from './overlay.service';

declare const google: any;

const GOOGLE_MAPS_DARK_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#d59563" }]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#d59563" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [{ "color": "#263c3f" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#6b9a76" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#38414e" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#212a37" }]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#9ca5b3" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#746855" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#1f2835" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#f3d19c" }]
  },
  {
    "featureType": "transit",
    "elementType": "geometry",
    "stylers": [{ "color": "#2f3948" }]
  },
  {
    "featureType": "transit.station",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#d59563" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#17263c" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#515c6d" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#17263c" }]
  }
];

@Injectable({
  providedIn: 'root'
})
export class MapService {
  LatLng: { lat: any; lng: any; };
  locationAddress: string = 'Loading..';
  showResetLocationButton: boolean;
  mapPinStage: any;
  D_LatLng: { lat: any; lng: any; };
  actualLocation: any;
  exampleMapId: any;
  newMap: GoogleMap;
  private directionsService: google.maps.DirectionsService | null = null;

  constructor(private overlay: OverlayService, private geocode: GeocodeService) {
  }

  //create google maps get the map movement listener
  async createMap(ref, coords) {
    try {
      const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

      this.newMap = await GoogleMap.create({
        id: 'my-cool-map',
        element: ref,
        apiKey: environment.apiKey,
        config: {
          center: {
            lat: 5.5122138,
            lng: 7.4919135
          },
          zoom: 8,
          styles: isDarkMode ? GOOGLE_MAPS_DARK_STYLE : [],
          disableDefaultUI: true,
        },
      });

      this.LatLng = {
        lat: coords.coords.latitude,
        lng: coords.coords.longitude
      }
      const promises: Promise<any>[] = [
        this.newMap.enableTrafficLayer(true)
      ];

      // enableCurrentLocation returns a Promise that rejects on web.
      // Wrapping with .catch() prevents the rejection from crashing Promise.all.
      promises.push(
        this.newMap.enableCurrentLocation(true).catch(err =>
          console.warn('enableCurrentLocation not supported on this platform:', err)
        )
      );

      promises.push(this.newMap.setCamera({
        animate: true,
        animationDuration: 500,
        zoom: 15,
        coordinate: this.LatLng
      }));

      await Promise.all(promises);
      try {
        const address = await this.geocode.getAddress(this.LatLng.lat, this.LatLng.lng).toPromise();
        this.actualLocation = address.results[0].formatted_address;
        this.locationAddress = address.results[1].address_components[0].long_name + ' ' + address.results[1].address_components[1].long_name;
      } catch (error) {
        console.error('Error fetching address:', error);
      }
      // Re-enable current location (guarded for web)
      this.newMap.enableCurrentLocation(true).catch(() => { });
    } catch (e) {
      this.overlay.showAlert('Error', e)
    }
  }




  calculateCenter(points) {
    const latitudes = points.map(p => p.geoCode.latitude);
    const longitudes = points.map(p => p.geoCode.longitude);

    const avgLat = latitudes.reduce((a, b) => a + b, 0) / latitudes.length;
    const avgLng = longitudes.reduce((a, b) => a + b, 0) / longitudes.length;

    return { latitude: avgLat, longitude: avgLng };
  }


  getBoundsZoomLevel(bounds, mapDim) {
    const WORLD_DIM = { height: 256, width: 256 };
    const ZOOM_MAX = 21;

    const latRad = lat => {
      const sin = Math.sin((lat * Math.PI) / 180);
      const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
      return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
    };

    const zoom = (mapPx, worldPx, fraction) =>
      Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    const latFraction = (latRad(ne.lat()) - latRad(sw.lat())) / Math.PI;

    const lngDiff = ne.lng() - sw.lng();
    const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

    const latZoom = zoom(mapDim.height, WORLD_DIM.height, latFraction);
    const lngZoom = zoom(mapDim.width, WORLD_DIM.width, lngFraction);

    return Math.min(latZoom, lngZoom, ZOOM_MAX);
  }


  async setCameraToLocation(coordinate: { lat: number; lng: number }, zoom: number, bearing: any) {
    if (this.newMap) {
      try {
        // Ensure zoom is within reasonable bounds
        const validZoom = Math.max(8, Math.min(zoom, 20)); // Clamp between 8 and 20

        await this.newMap.setCamera({
          animate: true,
          animationDuration: 500,
          zoom: validZoom,
          coordinate: coordinate,
          bearing: bearing || 0 // Default bearing to 0 if not provided
        });
        console.log(`Camera set to: lat ${coordinate.lat}, lng ${coordinate.lng}, zoom: ${validZoom}`);
      } catch (error) {
        console.error('Error setting camera:', error);
      }
    } else {
      console.error('Map is not initialized.');
    }
  }
  // Add other necessary methods like getAddress here


  calculateBearing(start, end) {
    const startLat = start.lat * (Math.PI / 180);
    const startLng = start.lng * (Math.PI / 180);
    const endLat = end.lat * (Math.PI / 180);
    const endLng = end.lng * (Math.PI / 180);

    const dLng = endLng - startLng;
    const y = Math.sin(dLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
    const bearing = Math.atan2(y, x) * (180 / Math.PI);

    return (bearing + 360) % 360;
  }

  private ensureDirectionsService(): google.maps.DirectionsService | null {
    if (!this.directionsService && typeof google !== 'undefined' && google?.maps) {
      this.directionsService = new google.maps.DirectionsService();
    }
    return this.directionsService;
  }

  async getRoutePath(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    travelMode: google.maps.TravelMode = google?.maps?.TravelMode?.DRIVING ?? 'DRIVING'
  ): Promise<{ lat: number; lng: number }[]> {
    const service = this.ensureDirectionsService();
    if (!service) {
      console.warn('DirectionsService unavailable, falling back to straight line');
      return [origin, destination];
    }

    return new Promise((resolve) => {
      service.route(
        {
          origin,
          destination,
          travelMode
        },
        (result, status) => {
          if (status === 'OK' && result?.routes?.length) {
            const overviewPath = result.routes[0].overview_path || [];
            const path = overviewPath.map((latLng: google.maps.LatLng) => ({
              lat: latLng.lat(),
              lng: latLng.lng()
            }));
            resolve(path);
          } else {
            console.warn('DirectionsService failed:', status, result);
            resolve([origin, destination]);
          }
        }
      );
    });
  }



}
