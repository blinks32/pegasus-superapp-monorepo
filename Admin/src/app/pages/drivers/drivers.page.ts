import { Component, OnInit } from '@angular/core';
import { AlertController, LoadingController, ModalController, ModalOptions } from '@ionic/angular';
import { DriverDocumentsComponent } from 'src/app/driver-documents/driver-documents.component';
import { DriverComponent } from 'src/app/driver/driver.component';
import { OnesignalService } from 'src/app/one-signal.service';
import { AvatarService } from 'src/app/services/avatar.service';
import { FcmService } from 'src/app/services/fcm.service';
import { combineLatest } from 'rxjs';

interface Driver {
  Approved: boolean;
  Driver_id: string;
  Driver_name: string;
  Driver_phone: string;
  Driver_car: string;
  Driver_carType: string;
  Driver_email: string;
  Driver_plate: string;
  Driver_rating: number;
  Driver_earnings: number;
  Driver_latitude: number;
  Driver_longitude: number;
  Driver_image: string;
  isApproved: boolean;
  Driver_num_rides: number;
  license: string;
  mileage: number;
  onlineState: boolean;
  submissionDate: any;
  Document: boolean;
  notificationID?: string;
  onesignalExternalId?: string;
  fcmToken?: string;
}

@Component({
  selector: 'app-drivers',
  templateUrl: './drivers.page.html',
  styleUrls: ['./drivers.page.scss'],
})
export class DriversPage implements OnInit {
  skeletOns: {}[] = [{}, {}, {}, {}];
  hideSkeleton: boolean = true;
  hasNoData: boolean = false;
  segmentModel = "default";

  records = { data: [] as Driver[] };
  records2 = { data: [] as Driver[] };
  allRecords: Driver[] = [];
  allRecords2: Driver[] = [];

  constructor(
    private chatService: AvatarService,
    private onesignalService: OnesignalService,
    private fcmService: FcmService,
    public modalCtrl: ModalController,
    private loadingController: LoadingController,
    public alertController: AlertController
  ) { }

  async ionViewDidEnter() {
    this.hideSkeleton = true;
    const drivers = this.chatService.getDrivers();
  
    drivers.subscribe((d: Driver[]) => {
      this.records.data = [];
      this.records2.data = [];
      this.allRecords = [];
      this.allRecords2 = [];
      
      d.forEach(element => {
        if (element.isApproved||element.Approved) {
          this.records.data.push(element);
          this.allRecords.push(element);
        } else {
          this.records2.data.push(element);
          this.allRecords2.push(element);
        }
      });

      if (d.length === 0) {
        this.hasNoData = true;
      }
      this.hideSkeleton = false;
    });
  }

    applyFilter(event: any) {
    
      const filterValue = event.target.value.toLowerCase();

      if (!filterValue) {
        this.records.data = [...this.allRecords];
        return;
      }

      this.records.data = this.allRecords.filter(driver => 
        (driver.Driver_name && driver.Driver_name.toLowerCase().includes(filterValue)) ||
        (driver.Driver_phone && driver.Driver_phone.toLowerCase().includes(filterValue)) ||
        (driver.Driver_email && driver.Driver_email.toLowerCase().includes(filterValue))
      );
    }

    applyFilter2(event: any) {
    
      const filterValue = event.target.value.toLowerCase();

      if (!filterValue) {
        this.records2.data = [...this.allRecords2];
        return;
      }

      this.records2.data = this.allRecords2.filter(driver => 
        (driver.Driver_name && driver.Driver_name.toLowerCase().includes(filterValue)) ||
        (driver.Driver_phone && driver.Driver_phone.toLowerCase().includes(filterValue)) ||
        (driver.Driver_email && driver.Driver_email.toLowerCase().includes(filterValue))
      );
    }

  async AddDriver() {
    const options: ModalOptions = {
      component: DriverComponent
    };
    const modal = await this.modalCtrl.create(options);
    modal.present();
    await modal.onWillDismiss();
  }

  async EditDriver(item: Driver) {
    const options: ModalOptions = {
      component: DriverComponent,
      componentProps: {
        info: item,
      }
    };
    const modal = await this.modalCtrl.create(options);
    modal.present();
    await modal.onWillDismiss();
  }

  async BlockDriver(element: Driver) {
    await this.chatService.DriverBlock(true, element.Driver_id);
  }

  async UnBlockDriver(element: Driver) {
    await this.chatService.DriverBlock(false, element.Driver_id);
  }

  async gotoDocs(e: Driver) {
    const options: ModalOptions = {
      component: DriverDocumentsComponent,
      componentProps: {
        info: e,
      }
    };
    const modal = await this.modalCtrl.create(options);
    modal.present();
    await modal.onWillDismiss();
  }

  async toggleApproval(driver: Driver) {
    const loading = await this.loadingController.create();
    await loading.present();

    try {
      const nextIsApproved = !driver.isApproved;
      const nextApprovedFlag = !driver.Approved;

      await this.chatService.UpdateDriverApprove(nextIsApproved, nextApprovedFlag, driver.Driver_id);
      driver.isApproved = nextIsApproved;
      driver.Approved = nextApprovedFlag;

     // this.sendStatusNotification(driver, nextIsApproved);
      
      const alert = await this.alertController.create({
        header: `Driver ${nextIsApproved ? 'Approved' : 'Disapproved'}`,
        message: `${driver.Driver_name} has been ${nextIsApproved ? 'approved' : 'disapproved'} successfully.`,
        buttons: ['OK'],
      });
      await alert.present();
    } catch (error) {
      const alert = await this.alertController.create({
        header: 'Error',
        message: 'There was an error updating the driver status.',
        buttons: ['OK'],
      });
      await alert.present();
    } finally {
      loading.dismiss();
    }
  }

  ngOnInit() {}

  private sendStatusNotification(element: Driver, isApproved: boolean) {
    const statusText = isApproved ? 'approved' : 'disapproved';
    const body = `Hi ${element.Driver_name || 'driver'}, your account has been ${statusText}.`;
    const dataPayload = {
      driverId: element.Driver_id,
      status: statusText,
    };

    let delivered = false;

    if (element.fcmToken) {
      this.fcmService
        .sendToToken(element.fcmToken, 'Driver Status Updated', body, dataPayload)
        .subscribe({
          next: () => {},
          error: (notificationError) => console.warn('Failed to send FCM notification', notificationError),
        });
      delivered = true;
    }

    const onesignalTarget = element.notificationID || element.onesignalExternalId || element.Driver_id;
    if (onesignalTarget) {
      this.onesignalService
        .sendNotification(body, 'Driver Status Updated', dataPayload, onesignalTarget)
        .subscribe({
          error: (notificationError) => console.warn('Failed to send OneSignal notification', notificationError),
        });
      delivered = true;
    }

    if (!delivered) {
      console.warn('Driver has no push identifiers configured', element.Driver_id);
    }
  }
}
