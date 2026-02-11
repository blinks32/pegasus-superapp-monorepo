import { Injectable } from '@angular/core';
import { GoogleMap, Marker } from '@capacitor/google-maps';
import { environment } from 'src/environments/environment';
import { GeocodeService } from './geocode.service';
import { OverlayService } from './overlay.service';
import { HttpClient, HttpParams } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private _map: GoogleMap | null = null;

  get newMap(): GoogleMap {
    if (!this._map) {
      throw new Error('Map not initialized');
    }
    return this._map;
  }

  set newMap(map: GoogleMap) {
    this._map = map;
  }

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
      // Validate coords before using
      const lat = coords?.coords?.latitude || 3.1390; // Default to Kuala Lumpur, Malaysia
      const lng = coords?.coords?.longitude || 101.6869;

      // Destroy existing map if it exists
      this._map = await GoogleMap.create({
        id: 'my-cool-map',
        element: ref,
        apiKey: environment.apiKey,
        config: {
          center: {
            lat: lat,
            lng: lng
          },
          zoom: 15,
          styles: [],
          scaleControl: false,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: false,
        },
      });

      this.LatLng = {
        lat: lat,
        lng: lng
      };

      await Promise.all([
        this._map.enableTrafficLayer(true),
        this._map.enableCurrentLocation(true),
        this._map.setCamera({
          animate: true,
          animationDuration: 500,
          zoom: 15,
          coordinate: this.LatLng
        })
      ]);

      const address = await this.getAddress(this.LatLng.lat, this.LatLng.lng);
      this.processAddressResponse(address);

    } catch (error) {
      console.error('Error creating map:', error);
      throw error;
    }
  }

  async destroyMap() {
    if (this._map) {
      try {
        await this._map.destroy();
        this._map = null;
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
    if (!this._map) {
      console.error('Map not initialized');
      return;
    }

    try {
      await this._map.setCamera({
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
      await this._map.addMarker(marker);
      return marker;
    } catch (error) {
      console.error('Error adding marker:', error);
      return null;
    }
  }
}
