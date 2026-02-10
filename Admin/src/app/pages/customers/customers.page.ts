import { Component, OnInit } from '@angular/core';
import { LoadingController, ModalController, ModalOptions, InfiniteScrollCustomEvent } from '@ionic/angular';
import { RiderComponent } from 'src/app/rider/rider.component';
import { AvatarService } from 'src/app/services/avatar.service';

// Define the Rider interface
interface Rider {
  Rider_id: string;
  Rider_imgUrl: string;
  Rider_name: string;
  Rider_phone: string;
  Rider_email: string;
  Rider_rating: number;
  photoUrl?: string;
  photoURL?: string;
}

@Component({
  selector: 'app-customers',
  templateUrl: './customers.page.html',
  styleUrls: ['./customers.page.scss'],
})
export class CustomersPage implements OnInit {
  skeletOns: {}[];
  hideSkeleton: boolean;
  hasNoData: boolean;
  segmentModel = "default";
  
  records = { data: [] as Rider[] };
  allRecords = [] as Rider[]; // Store original data
  currentPage = 0;
  pageSize = 10;
  
  constructor(
    private chatService: AvatarService, 
    public modalCtrl: ModalController, 
    private loadingController: LoadingController
  ) { }

  async ionViewDidEnter() {
    this.skeletOns = [{}, {}, {}, {}];
    this.hideSkeleton = true;
    
    this.chatService.getRiders().subscribe((d: Rider[]) => {
      const normalized = d.map((rider: Rider) => ({
        ...rider,
        photoUrl: this.resolveRiderPhoto(rider)
      }));

      this.allRecords = normalized; // Store original data
      this.records.data = [...normalized];
      this.logRiderPhotoUrls(this.records.data);
      if (d.length === 0) {
        this.hasNoData = true;
        this.hideSkeleton = false;
      } else {
        this.hideSkeleton = false;
        this.hasNoData = false;
      }
    });
  }

  applyFilter(event: any) {
    const filterValue = event.target.value.toLowerCase();
    // Reset to original data first
    this.records.data = this.allRecords;
    // Then apply filter
    if (filterValue) {
      this.records.data = this.records.data.filter((rider: Rider) =>
        rider.Rider_name.toLowerCase().includes(filterValue) ||
        rider.Rider_phone.toLowerCase().includes(filterValue) ||
        rider.Rider_email.toLowerCase().includes(filterValue)
      );
    }
    this.currentPage = 0;
  }

  openFilter() {
    // Implement filter logic here
    console.log('Filter opened');
  }

  async loadMore(event: InfiniteScrollCustomEvent) {
    this.currentPage++;
    // Add your load more logic here
    event.target.complete();

    // Optionally disable infinite scroll
    if (this.currentPage * this.pageSize >= this.records.data.length) {
      event.target.disabled = true;
    }
  }

  async BlockDriver(rider: Rider) {
    const loading = await this.loadingController.create();
    await loading.present();
    // Implement your block logic here
    await this.chatService.CustomerBlock(true, rider.Rider_id);
    loading.dismiss();
  }

  async EditDriver(item: Rider) {
    const options: ModalOptions = {
      component: RiderComponent,
      componentProps: {
        info: item,
      },
      backdropDismiss: true
    };
    const modal = await this.modalCtrl.create(options);
    modal.present();
    await modal.onWillDismiss();
  }

  async gotoDocs(e: Rider) {
    const loading = await this.loadingController.create();
    await loading.present();
    await this.chatService.CustomerBlock(true, e.Rider_id);
    loading.dismiss();
  }

  async AddDriver() {
    const options: ModalOptions = {
      component: RiderComponent,
      backdropDismiss: true
    };
    const modal = await this.modalCtrl.create(options);
    modal.present();
    await modal.onWillDismiss();
  }

  ngOnInit() {}

  private logRiderPhotoUrls(riders: Rider[]): void {
    riders.forEach(rider => {
      const photoPath = this.resolveRiderPhoto(rider) || 'N/A';
      console.log(`Rider ${rider.Rider_id} photoUrl:`, photoPath);
    });
  }

  private resolveRiderPhoto(rider: Rider): string {
    const candidate = (
      rider.photoUrl ||
      rider.photoURL ||
      rider.Rider_imgUrl ||
      (rider as any)?.imageUrl ||
      (rider as any)?.imgUrl ||
      (rider as any)?.avatar ||
      ''
    ).trim();

    if (!candidate) {
      return '';
    }

    if (candidate.startsWith('gs://')) {
      // Display placeholder for gs:// URLs until converted to https downloads
      return '';
    }

    if (candidate.startsWith('http') || candidate.startsWith('data:image')) {
      return candidate;
    }

    return '';
  }
}
