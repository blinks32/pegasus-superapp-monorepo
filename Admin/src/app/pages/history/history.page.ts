import { Component, OnInit } from '@angular/core';
import { NavController, InfiniteScrollCustomEvent } from '@ionic/angular';
import { AvatarService } from 'src/app/services/avatar.service';
import { SettingsService } from 'src/app/services/settings.service';

interface Trip {
  Driver_name?: string;
  Driver_phone?: string;
  driverDetails?: {
    Driver_name?: string;
    Driver_phone?: string;
  };
  Rider_name: string;
  Rider_phone: string;
  pickup?: string;
  dropoff?: string;
  Rider_Location?: string;
  Rider_Destination?: string;
  price: number;
  reason?: string;
}

@Component({
  selector: 'app-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
})
export class HistoryPage implements OnInit {
  isLoading = false;
  hasData = false;
  segmentModel = "default";
  currencySymbol: string = '$';

  tripHistory: Trip[] = [];
  cancelledHistory: Trip[] = [];
  
  displayedTripHistory: Trip[] = [];
  displayedCancelledHistory: Trip[] = [];

  public pageSize = 10;
  public currentTripPage = 0;
  public currentCancelledPage = 0;

  skeletOns: {}[] = [{}, {}, {}, {}];
  hideSkeleton = true;
  hasNoData = false;

  constructor(
    private nav: NavController,
    private chatService: AvatarService,
    private settingsService: SettingsService
  ) {}

  ngOnInit() {
    this.loadTripHistory();
    this.loadCancelledHistory();

    this.settingsService.getSettings().subscribe(settings => {
      if (settings && settings.currencySymbol) {
        this.currencySymbol = settings.currencySymbol;
      }
    });
  }

  loadTripHistory() {
    this.isLoading = true;
    this.chatService.getTrips().subscribe(
      (data: Trip[]) => {
        this.tripHistory = data;
        this.displayedTripHistory = data;
        this.hasData = this.tripHistory.length > 0;
        this.hasNoData = !this.hasData;
        this.isLoading = false;
        this.hideSkeleton = false;
      },
      (error) => {
        console.error('Error loading trip history:', error);
        this.isLoading = false;
        this.hideSkeleton = false;
      }
    );
  }

  loadCancelledHistory() {
    this.isLoading = true;
    this.chatService.getCancelledTrips().subscribe(
      (data: Trip[]) => {
        this.cancelledHistory = data;
        this.displayedCancelledHistory = data;
        this.hasData = this.hasData || this.cancelledHistory.length > 0;
        this.hasNoData = !this.hasData;
        this.isLoading = false;
        this.hideSkeleton = false;
      },
      (error) => {
        console.error('Error loading cancelled history:', error);
        this.isLoading = false;
        this.hideSkeleton = false;
      }
    );
  }

  nextPage() {
    if (this.segmentModel === 'default') {
      if ((this.currentTripPage + 1) * this.pageSize < this.displayedTripHistory.length) {
        this.currentTripPage++;
      }
    } else {
      if ((this.currentCancelledPage + 1) * this.pageSize < this.displayedCancelledHistory.length) {
        this.currentCancelledPage++;
      }
    }
  }

  previousPage() {
    if (this.segmentModel === 'default') {
      if (this.currentTripPage > 0) {
        this.currentTripPage--;
      }
    } else {
      if (this.currentCancelledPage > 0) {
        this.currentCancelledPage--;
      }
    }
  }

  applyFilter(event: any) {
    const filterValue = event.target.value.toLowerCase();
    if (this.segmentModel === 'default') {
      this.currentTripPage = 0;
      this.displayedTripHistory = this.tripHistory.filter(trip =>
        this.getDriverName(trip).toLowerCase().includes(filterValue) ||
        trip.Rider_name.toLowerCase().includes(filterValue) ||
        this.getPickup(trip).toLowerCase().includes(filterValue) ||
        this.getDropoff(trip).toLowerCase().includes(filterValue)
      );
    } else {
      this.currentCancelledPage = 0;
      this.displayedCancelledHistory = this.cancelledHistory.filter(trip =>
        this.getDriverName(trip).toLowerCase().includes(filterValue) ||
        trip.Rider_name.toLowerCase().includes(filterValue) ||
        this.getPickup(trip).toLowerCase().includes(filterValue) ||
        this.getDropoff(trip).toLowerCase().includes(filterValue)
      );
    }
  }

  get totalTripPages(): number {
    return Math.ceil(this.displayedTripHistory.length / this.pageSize);
  }

  get totalCancelledPages(): number {
    return Math.ceil(this.displayedCancelledHistory.length / this.pageSize);
  }

  getDriverName(trip: Trip): string {
    return trip.Driver_name || trip.driverDetails?.Driver_name || 'Unknown';
  }

  getDriverPhone(trip: Trip): string {
    return trip.Driver_phone || trip.driverDetails?.Driver_phone || 'Unknown';
  }

  getPickup(trip: Trip): string {
    return trip.pickup || trip.Rider_Location || 'Unknown';
  }

  getDropoff(trip: Trip): string {
    return trip.dropoff || trip.Rider_Destination || 'Unknown';
  }

  goBack() {
    this.nav.pop();
  }
}
