import { Component, ElementRef, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { NavController, MenuController, Platform } from '@ionic/angular';
import { MapService } from '../services/map.service';
import { AvatarService } from '../services/avatar.service';
import { SettingsService } from '../services/settings.service';
import { Auth } from '@angular/fire/auth';
import { Geolocation, Position } from '@capacitor/geolocation';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('map') mapRef: ElementRef<HTMLElement>;
  @ViewChild('earningsChart') earningsChartRef: ElementRef;
  @ViewChild('driversChart') driversChartRef: ElementRef;
  @ViewChild('ridersChart') ridersChartRef: ElementRef;
  @ViewChild('tripsChart') tripsChartRef: ElementRef;

  earnings: number = 0;
  numDrivers: number = 0;
  numRiders: number = 0;
  numTrips: number = 0;
  coordinates: Position;
  LatLng: { lat: number; lng: number };
  currencySymbol: string = '$';

  showMap: boolean = true;
  isMobile: boolean = false;

  private resizeObserver: ResizeObserver;
  private isDragging = false;
  private startX: number;
  private startWidth: number;

  private platformSubscription: any;

  // Store chart instances to prevent memory leaks
  private charts: Map<string, Chart> = new Map();

  constructor(
    private auth: Auth,
    private menuCtrl: MenuController,
    public map: MapService,
    private database: AvatarService,
    public nav: NavController,
    private platform: Platform,
    private settingsService: SettingsService
  ) {
    this.checkPlatformSize();
  }

  async ngOnInit() {
    this.platformSubscription = this.platform.resize.subscribe(() => {
      this.checkPlatformSize();
    });

    // Initialize with default coordinates first
    this.setDefaultCoordinates();

    // Try to get user location with fallback strategy
    await this.getCurrentLocation();

    this.menuCtrl.enable(true);

    // Initialize data subscriptions
    this.initializeDataSubscriptions();

    this.settingsService.getSettings().subscribe(settings => {
      if (settings && settings.currencySymbol) {
        this.currencySymbol = settings.currencySymbol;
      }
    });
  }

  private setDefaultCoordinates() {
    this.coordinates = {
      coords: {
        latitude: 6.5244,
        longitude: 3.3792,
        accuracy: 0,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: Date.now()
    };

    this.LatLng = {
      lat: this.coordinates.coords.latitude,
      lng: this.coordinates.coords.longitude
    };
  }

  private async getCurrentLocation() {
    try {
      // Check if running on mobile
      if (this.platform.is('hybrid')) {
        // Request permissions explicitly for mobile
        const permResult = await Geolocation.requestPermissions();
        if (permResult.location !== 'granted') {
          console.warn('Location permission not granted, using default coordinates');
          return;
        }
      } else {
        console.log('Running on web, bypassing native Geolocation permission request');
      }

      // Try high accuracy first with shorter timeout
      try {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 60000 // Accept cached position up to 1 minute old
        });

        this.coordinates = position;
        this.LatLng = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        console.log('Got high accuracy location:', this.LatLng);

      } catch (highAccuracyError) {
        console.warn('High accuracy location failed, trying low accuracy:', highAccuracyError);

        // Fallback to low accuracy with longer timeout
        try {
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000 // Accept cached position up to 5 minutes old
          });

          this.coordinates = position;
          this.LatLng = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          console.log('Got low accuracy location:', this.LatLng);

        } catch (lowAccuracyError) {
          console.warn('All geolocation attempts failed, using default coordinates:', lowAccuracyError);
          // Keep default coordinates set in setDefaultCoordinates()
        }
      }

    } catch (e) {
      console.error('Error getting location:', e);
      // Keep default coordinates
    }
  }

  private initializeDataSubscriptions() {
    this.database.getTotalEarnings().subscribe({
      next: (d) => {
        console.log('Earnings data received:', d);
        this.earnings = d.Earnings || 0;
        this.updateChart(this.earningsChartRef, [this.earnings], 'Earnings');
      },
      error: (err) => {
        console.error('Error getting earnings:', err);
        this.earnings = 0;
      }
    });

    this.database.getDrivers().subscribe({
      next: (d) => {
        this.numDrivers = d.length;
        this.updateChart(this.driversChartRef, [this.numDrivers], 'Drivers');
        this.updateDriverMarkers(d);
      },
      error: (err) => {
        console.error('Error getting drivers:', err);
        this.numDrivers = 0;
      }
    });

    this.database.getRiders().subscribe({
      next: (d) => {
        this.numRiders = d.length;
        this.updateChart(this.ridersChartRef, [this.numRiders], 'Riders');
      },
      error: (err) => {
        console.error('Error getting riders:', err);
        this.numRiders = 0;
      }
    });

    // Assuming you have a method to get trips data
    this.database.getTrips().subscribe({
      next: (d) => {
        this.numTrips = d.length;
        this.updateChart(this.tripsChartRef, [this.numTrips], 'Trips');
      },
      error: (err) => {
        console.error('Error getting trips:', err);
        this.numTrips = 0;
      }
    });
  }

  async ngAfterViewInit() {
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (this.mapRef && this.mapRef.nativeElement) {
        await this.map.createMap(this.mapRef.nativeElement, this.coordinates);
        this.setupMapResize();
      } else {
        console.error('Map reference not found');
      }
    } catch (e) {
      console.error('Error creating map:', e);
    }
  }

  updateChart(chartRef: ElementRef, data: number[], label: string) {
    if (!chartRef || !chartRef.nativeElement) {
      console.warn(`Chart reference for ${label} not available yet`);
      return;
    }

    const chartId = label.toLowerCase();

    // Destroy existing chart if it exists
    if (this.charts.has(chartId)) {
      this.charts.get(chartId)?.destroy();
    }

    const ctx = chartRef.nativeElement.getContext('2d');

    // Define color schemes for different chart types
    const colorSchemes = {
      'earnings': {
        borderColor: 'rgb(52, 211, 153)',
        backgroundColor: 'rgba(52, 211, 153, 0.1)',
        pointBackgroundColor: 'rgb(52, 211, 153)',
        pointBorderColor: '#fff'
      },
      'drivers': {
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: '#fff'
      },
      'riders': {
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        pointBackgroundColor: 'rgb(168, 85, 247)',
        pointBorderColor: '#fff'
      },
      'trips': {
        borderColor: 'rgb(251, 146, 60)',
        backgroundColor: 'rgba(251, 146, 60, 0.1)',
        pointBackgroundColor: 'rgb(251, 146, 60)',
        pointBorderColor: '#fff'
      }
    };

    const colors = colorSchemes[chartId] || {
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.1)',
      pointBackgroundColor: 'rgb(75, 192, 192)',
      pointBorderColor: '#fff'
    };

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Current'],
        datasets: [{
          label: label,
          data: data,
          borderColor: colors.borderColor,
          backgroundColor: colors.backgroundColor,
          pointBackgroundColor: colors.pointBackgroundColor,
          pointBorderColor: colors.pointBorderColor,
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.4,
          fill: true,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14
            },
            bodyFont: {
              size: 13
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              font: {
                size: 11
              }
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                size: 11
              }
            }
          }
        }
      }
    });

    // Store the chart instance
    this.charts.set(chartId, chart);
  }

  async updateDriverMarkers(drivers) {
    if (!this.map.newMap) {
      console.warn('Map not initialized yet, skipping driver markers');
      return;
    }

    for (const driver of drivers) {
      const lat = parseFloat(driver.Driver_lat);
      const lng = parseFloat(driver.Driver_lng);

      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
        console.warn('Invalid coordinates for driver:', driver.Driver_name, 'lat:', driver.Driver_lat, 'lng:', driver.Driver_lng);
        continue;
      }

      const markerLatLng = { lat, lng };

      try {
        await this.map.newMap.addMarker({
          coordinate: markerLatLng,
          iconUrl: 'https://i.ibb.co/KDy365b/hatchback.png',
          iconSize: { width: 36, height: 36 },
          iconAnchor: { x: 18, y: 18 },
          title: driver.Driver_name || 'Driver',
        });
      } catch (error) {
        console.error('Error adding marker for driver:', driver.Driver_name, error);
      }
    }
  }

  gotoProfile() {
    this.nav.navigateForward('profile');
  }

  toggleMap() {
    this.showMap = !this.showMap;
  }

  private checkPlatformSize() {
    this.isMobile = this.platform.width() < 768;
    this.showMap = !this.isMobile;
  }

  private setupMapResize() {
    const mapElement = this.mapRef?.nativeElement;
    if (!mapElement) return;

    const resizeHandle = mapElement.querySelector('.dashboard-map::after');
    if (!resizeHandle) return;

    const handleMouseDown = (e: MouseEvent) => {
      this.isDragging = true;
      this.startX = e.clientX;
      this.startWidth = mapElement.offsetWidth;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;
      const delta = e.clientX - this.startX;
      const newWidth = Math.max(200, Math.min(600, this.startWidth + delta));
      mapElement.style.width = `${newWidth}px`;
    };

    const handleMouseUp = () => {
      this.isDragging = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    resizeHandle.addEventListener('mousedown', handleMouseDown);
  }

  ngOnDestroy() {
    // Destroy all chart instances
    this.charts.forEach((chart) => {
      chart.destroy();
    });
    this.charts.clear();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.platformSubscription) {
      this.platformSubscription.unsubscribe();
    }
  }
}
