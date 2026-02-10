import { Component, OnInit } from '@angular/core';
import { NavController, ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { AvatarService } from '../../services/avatar.service';
import { Firestore, collection, query, where, orderBy, getDocs } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { format, subDays, subMonths, isAfter, parseISO } from 'date-fns';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
})
export class HistoryPage implements OnInit {
  loading = true;
  histories = [];
  filteredHistories = [];
  groupedHistories = {};
  selectedTimeFilter = 'all';
  histories$ = this.database.getRideHistory();
  
  constructor(
    private firestore: Firestore,
    private navCtrl: NavController,
    private translateService: TranslateService,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private database: AvatarService,
    private router: Router,
    private settingsService: SettingsService
  ) {}

  ngOnInit() {
    this.loadRideHistory();
  }

  async loadRideHistory() {
    try {
      this.loading = true;
      
      // Get current user ID
      const userId = this.database.user?.uid;
      if (!userId) {
        console.error('No user ID found');
        return;
      }
      
      console.log('Loading ride history for user:', userId);
      
      // Query the RideHistory collection
      const historyRef = collection(this.firestore, 'RideHistory');
      // Note: We're querying by driverId now since that's what we're saving
      const q = query(
        historyRef,
        where('riderId', '==', userId), // Match the field name we're saving in createHistory
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      this.histories = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Ensure timestamp is properly handled
          time: data.timestamp,
          // Format price for display using dynamic currency
          formattedPrice: data.price ? this.settingsService.formatPrice(parseFloat(data.price)) : this.settingsService.formatPrice(0),
          // Ensure we have default values for required fields
          Driver_name: data.Driver_name || 'Unknown Driver',
          Driver_car: data.Driver_car || 'Unknown Vehicle',
          Driver_plate: data.Driver_plate || 'No Plate',
          Driver_imgUrl: data.Driver_imgUrl || 'assets/default-driver.png',
          Driver_rating: data.Driver_rating || 0,
          Rider_Location: data.Rider_Location || 'Unknown pickup location',
          Rider_Destination: data.Rider_Destination || 'Unknown destination'
        };
      });
      
      console.log('Loaded histories:', this.histories);
      
      this.filterByTime();
      this.groupHistoriesByDate();
      
    } catch (error) {
      console.error('Error loading ride history:', error);
    } finally {
      this.loading = false;
    }
  }

  filterByTime() {
    const now = new Date();
    
    switch (this.selectedTimeFilter) {
      case 'week':
        const oneWeekAgo = subDays(now, 7);
        this.filteredHistories = this.histories.filter(history => {
          const historyDate = history.time?.toDate ? history.time.toDate() : new Date(history.time);
          return isAfter(historyDate, oneWeekAgo);
        });
        break;
        
      case 'month':
        const oneMonthAgo = subMonths(now, 1);
        this.filteredHistories = this.histories.filter(history => {
          const historyDate = history.time?.toDate ? history.time.toDate() : new Date(history.time);
          return isAfter(historyDate, oneMonthAgo);
        });
        break;
        
      case 'all':
      default:
        this.filteredHistories = [...this.histories];
        break;
    }
    
    this.groupHistoriesByDate();
  }

  groupHistoriesByDate() {
    this.groupedHistories = {};
    
    this.filteredHistories.forEach(history => {
      let date;
      if (history.time?.toDate) {
        date = history.time.toDate();
      } else if (history.time) {
        date = new Date(history.time);
      } else {
        date = new Date();
      }
      
      const dateKey = format(date, 'MMMM d, yyyy');
      
      if (!this.groupedHistories[dateKey]) {
        this.groupedHistories[dateKey] = [];
      }
      
      this.groupedHistories[dateKey].push(history);
    });
    
    console.log('Grouped histories:', this.groupedHistories);
  }

  async presentFilterOptions() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: this.translateService.instant('HISTORY.FILTER_OPTIONS'),
      buttons: [
        {
          text: this.translateService.instant('HISTORY.ALL_RIDES'),
          handler: () => {
            this.selectedTimeFilter = 'all';
            this.filterByTime();
          }
        },
        {
          text: this.translateService.instant('HISTORY.THIS_WEEK'),
          handler: () => {
            this.selectedTimeFilter = 'week';
            this.filterByTime();
          }
        },
        {
          text: this.translateService.instant('HISTORY.THIS_MONTH'),
          handler: () => {
            this.selectedTimeFilter = 'month';
            this.filterByTime();
          }
        },
        {
          text: this.translateService.instant('COMMON.CANCEL'),
          role: 'cancel'
        }
      ]
    });
    
    await actionSheet.present();
  }

  async viewRideDetails(history: any) {
    const rideTime = history.time?.toDate ? history.time.toDate() : new Date(history.time);
    const formattedDateTime = format(rideTime, 'MMM d, yyyy h:mm a');

    const alert = await this.alertCtrl.create({
      header: this.translateService.instant('HISTORY.RIDE_DETAILS'),
      cssClass: 'ride-details-alert',
      message: `
        <div class="ride-details">
          <p><strong>${this.translateService.instant('HISTORY.DRIVER')}:</strong> ${history.Driver_name || 'Unknown'}</p>
          <p><strong>${this.translateService.instant('HISTORY.VEHICLE')}:</strong> ${history.Driver_car || 'Unknown'}</p>
          <p><strong>${this.translateService.instant('HISTORY.PLATE')}:</strong> ${history.Driver_plate || 'Unknown'}</p>
          <p><strong>${this.translateService.instant('HISTORY.PICKUP')}:</strong> ${history.Rider_Location || 'Unknown'}</p>
          <p><strong>${this.translateService.instant('HISTORY.DESTINATION')}:</strong> ${history.Rider_Destination || 'Unknown'}</p>
          <p><strong>${this.translateService.instant('HISTORY.PRICE')}:</strong> ${history.formattedPrice}</p>
          <p><strong>${this.translateService.instant('HISTORY.DATE_TIME')}:</strong> ${formattedDateTime}</p>
          <p><strong>${this.translateService.instant('HISTORY.RATING')}:</strong> ${history.Driver_rating?.toFixed(1) || '0.0'} ⭐</p>
          ${history.notes ? `<p><strong>${this.translateService.instant('HISTORY.NOTES')}:</strong> ${history.notes}</p>` : ''}
        </div>
      `,
      buttons: [
        {
          text: this.translateService.instant('COMMON.CLOSE'),
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  async bookAgain(history) {
    // Check if the history has the necessary location data
    if (!history.Rider_Location || !history.Rider_Destination) {
      const alert = await this.alertCtrl.create({
        header: this.translateService.instant('HISTORY.MISSING_DATA'),
        message: this.translateService.instant('HISTORY.MISSING_LOCATION_DATA'),
        buttons: ['OK']
      });
      await alert.present();
      return;
    }
    
    console.log('Booking again with history:', history);
    
    // Create a toast to confirm the action
    const toast = await this.toastCtrl.create({
      message: this.translateService.instant('HISTORY.LOADING_PREVIOUS_RIDE'),
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
    
    // Navigate to home page with the ride details
    this.router.navigate(['/home'], {
      state: {
        bookAgain: true,
        pickup: {
          address: history.Rider_Location,
          lat: history.Loc_lat || 0,
          lng: history.Loc_lng || 0
        },
        destination: {
          address: history.Rider_Destination,
          lat: history.Des_lat || 0,
          lng: history.Des_lng || 0
        }
      }
    });
  }

  navigateToHome() {
    this.navCtrl.navigateRoot('/home');
  }

  changeLanguage(lang: string) {
    this.translateService.use(lang);
  }

  handleImageError(event: any): void {
    const img = event.target as HTMLIonImgElement;
    if (img) {
      img.src = 'assets/icon/car.png';
    }
  }
}
