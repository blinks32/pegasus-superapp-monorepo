import { Injectable } from '@angular/core';
import { GoogleMap, Marker } from '@capacitor/google-maps';
import { environment } from 'src/environments/environment';
import { GeocodeService } from './geocode.service';
import { OverlayService } from './overlay.service';
import { HttpClient, HttpParams } from '@angular/common/http';

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
  public newMap: GoogleMap;
  LatLng: { lat: any; lng: any; };
  locationAddress: string = 'Loading..';
  showResetLocationButton: boolean;
  mapPinStage: any;
  D_LatLng: { lat: any; lng: any; };
  actualLocation: any;
  exampleMapId: any;

  constructor(private overlay: OverlayService, private geocode: GeocodeService, private http: HttpClient) { }

  async createMap(ref: HTMLElement, coords: { coords: { latitude: number; longitude: number } }) {
    try {
      const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const lat = coords?.coords?.latitude || 3.1390;
      const lng = coords?.coords?.longitude || 101.6869;

      this.newMap = await GoogleMap.create({
        id: 'my-cool-map',
        element: ref,
        apiKey: environment.apiKey,
        config: {
          center: {
            lat: lat,
            lng: lng
          },
          zoom: 15,
          styles: isDarkMode ? GOOGLE_MAPS_DARK_STYLE : [],
          disableDefaultUI: true,
        },
      });

      this.LatLng = {
        lat: lat,
        lng: lng
      };

      const promises: Promise<any>[] = [
        this.newMap.enableTrafficLayer(true)
      ];

      // enableCurrentLocation returns a Promise that rejects on web with
      // "Geolocation not supported on web browser". Wrapping with .catch()
      // prevents the rejection from crashing Promise.all.
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

      const address = await this.getAddress(this.LatLng.lat, this.LatLng.lng);
      this.processAddressResponse(address);

    } catch (error) {
      console.error('Error creating map:', error);
      throw error;
    }
  }

  async destroyMap() {
    if (this.newMap) {
      try {
        await this.newMap.destroy();
      } catch (error) {
        console.error('Error destroying map:', error);
      }
    }
  }

  private processAddressResponse(address: any) {
    if (address?.results?.length > 0) {
      this.actualLocation = address.results[0].formatted_address;

      // Try to get a shorter address for the search bar from results[1] or fallback to results[0]
      const bestResult = address.results.length > 1 ? address.results[1] : address.results[0];
      const components = bestResult.address_components;

      if (components?.length >= 2) {
        this.locationAddress = `${components[0].long_name} ${components[1].long_name}`;
      } else if (components?.length >= 1) {
        this.locationAddress = components[0].long_name;
      } else {
        this.locationAddress = this.actualLocation;
      }

      console.log('Processed address:', this.locationAddress, 'Full address:', this.actualLocation);
    } else {
      console.warn('Geocoding result empty or invalid:', address);
      this.locationAddress = 'Unknown Address';
    }
  }

  calculateCenter(points) {
    const latitudes = points.map(p => p.geoCode.latitude);
    const longitudes = points.map(p => p.geoCode.longitude);

    const avgLat = latitudes.reduce((a, b) => a + b, 0) / latitudes.length;
    const avgLng = longitudes.reduce((a, b) => a + b, 0) / longitudes.length;

    return { latitude: avgLat, longitude: avgLng };
  }

  async setCameraToLocation(coordinate: { lat: number; lng: number }, zoom: number, bearing: number) {
    if (!this.newMap) {
      console.error('Map not initialized');
      return;
    }

    try {
      await this.newMap.setCamera({
        animate: true,
        animationDuration: 500,
        zoom,
        coordinate,
        bearing
      });
    } catch (error) {
      console.error('Error setting camera:', error);
    }
  }

  // Add other necessary methods like getAddress here



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
  async getDirections(from: string, to: string): Promise<any> {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${from}&destination=${to}&key=${environment.apiKey}`;
      const response = await this.http.get(url).toPromise();
      return response;
    } catch (error) {
      console.error('Error in getting directions:', error);
      return null;
    }
  }

  getAddress(lat: number, lng: number): Promise<any> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json`;
    const params = new HttpParams()
      .set('latlng', `${lat},${lng}`)
      .set('key', environment.apiKey);

    return this.http.get(url, { params }).toPromise();
  }

  // Add the addMarker method to the MapService class
  async addMarker(lat: number, lng: number, title: string): Promise<Marker> {
    try {
      const marker: Marker = {
        coordinate: { lat, lng },
        title,
      };
      await this.newMap.addMarker(marker);
      return marker;
    } catch (error) {
      console.error('Error adding marker:', error);
      return null;
    }
  }
}
