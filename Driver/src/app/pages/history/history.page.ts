import { Component, OnInit, OnDestroy } from '@angular/core';
import { NavController } from '@ionic/angular';
import { Firestore, collection, getDocs, query, where, orderBy } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { TranslateService } from '@ngx-translate/core';
import { SettingsService } from 'src/app/services/settings.service';
import { Subscription } from 'rxjs';

interface TripHistory {
  Rider_name: string;
  Rider_imgUrl: string;
  driverRating: number;
  driverComment?: string;
  time: any;
  price: number;
  status: string;
  requestId?: string;
}

interface HistoryGroup {
  date: Date;
  trips: TripHistory[];
  totalEarnings: number;
}

@Component({
  selector: 'app-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
})
export class HistoryPage implements OnInit, OnDestroy {
  histories: TripHistory[] = [];
  groupedHistories: HistoryGroup[] = [];
  loading: boolean = true;
  selectedPeriod: string = 'week';
  totalTrips: number = 0;
  averageRating: number = 0;
  totalEarnings: number = 0;
  currencySymbol: string = '$';
  private settingsSubscription: Subscription;

  constructor(
    private nav: NavController, 
    private firestore: Firestore, 
    private auth: Auth,
    private translate: TranslateService,
    private settingsService: SettingsService
  ) {
    this.settingsSubscription = this.settingsService.settings$.subscribe(settings => {
      this.currencySymbol = settings.currencySymbol;
    });
  }

  ngOnDestroy() {
    if (this.settingsSubscription) {
      this.settingsSubscription.unsubscribe();
    }
  }

  ngOnInit() {
    this.loadHistory();
  }

  async loadHistory() {
    try {
      this.loading = true;
      const userId = this.auth.currentUser.uid;
      const historyRef = collection(this.firestore, `Drivers/${userId}/History`);
      
      // Create query based on selected period
      const startDate = this.getStartDate();
      const historyQuery = query(
        historyRef,
        where('time', '>=', startDate),
        orderBy('time', 'desc')
      );

      const snapshot = await getDocs(historyQuery);
      this.histories = snapshot.docs.map(doc => {
        const data = doc.data() as TripHistory;
        return { ...data };
      });

      this.processHistoryData();
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      this.loading = false;
    }
  }

  private getStartDate(): Date {
    const now = new Date();
    switch (this.selectedPeriod) {
      case 'today':
        return new Date(now.setHours(0, 0, 0, 0));
      case 'week':
        const lastWeek = new Date(now);
        lastWeek.setDate(lastWeek.getDate() - 7);
        return lastWeek;
      case 'month':
        const lastMonth = new Date(now);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        return lastMonth;
      default:
        return new Date(now.setHours(0, 0, 0, 0));
    }
  }

  private processHistoryData() {
    // Calculate totals
    this.totalTrips = this.histories.length;
    this.totalEarnings = this.histories.reduce((sum, trip) => sum + (trip.price || 0), 0);
    
    // Only use driverRating for consistency
    const totalRating = this.histories.reduce((sum, trip) => {
      return sum + (trip.driverRating || 0);
    }, 0);
    
    this.averageRating = this.totalTrips > 0 ? totalRating / this.totalTrips : 0;

    // Group by date
    const groups = new Map<string, HistoryGroup>();
    
    this.histories.forEach(trip => {
      const date = new Date(trip.time.toDate()).toDateString();
      if (!groups.has(date)) {
        groups.set(date, {
          date: new Date(date),
          trips: [],
          totalEarnings: 0
        });
      }
      const group = groups.get(date);
      group.trips.push(trip);
      group.totalEarnings += trip.price || 0;
    });

    this.groupedHistories = Array.from(groups.values())
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  filterHistory() {
    this.loadHistory();
  }
}
