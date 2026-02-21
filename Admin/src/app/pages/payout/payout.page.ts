import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingController, AlertController, IonicModule } from '@ionic/angular';
import { AvatarService } from 'src/app/services/avatar.service';
import { SettingsService } from 'src/app/services/settings.service';

@Component({
  selector: 'app-payout',
  templateUrl: './payout.page.html',
  styleUrls: ['./payout.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class PayoutPage implements OnInit {
  skeletOns: {}[];
  hideSkeleton: boolean;
  drivers: any;
  hasNoData: boolean;
  filteredRecords: any[] = [];
  currentPage = 0;
  pageSize = 5;
  currencySymbol: string = '$';

  constructor(
    private chatService: AvatarService,
    public loadingController: LoadingController,
    private alertController: AlertController,
    private settingsService: SettingsService
  ) { }

  async ionViewDidEnter() {
    this.skeletOns = [{}, {}, {}, {}];
    this.hideSkeleton = true;
    this.drivers = this.chatService.getDrivers();

    this.drivers.subscribe((d) => {
      this.filteredRecords = [];
      d.forEach(element => {
        if (element.Approved === true) {
          this.filteredRecords.push(element);
        }
      });

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
    const query = event.target.value.toLowerCase();
    this.filteredRecords = this.filteredRecords.filter((item: any) =>
      item.Driver_name.toLowerCase().includes(query) ||
      item.Driver_phone.toLowerCase().includes(query) ||
      item.Driver_email.toLowerCase().includes(query)
    );
    this.currentPage = 0;
  }

  nextPage() {
    this.currentPage++;
  }

  previousPage() {
    this.currentPage--;
  }

  async gotoDocs(e) {
    const alert = await this.alertController.create({
      header: 'Confirm Payout',
      message: 'Are you sure you want to payout this driver? This will reset their earnings to 0.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary',
          handler: () => {
            console.log('Confirm Cancel');
          }
        }, {
          text: 'Yes',
          handler: async () => {
            const loading = await this.loadingController.create();
            await loading.present();
            await this.chatService.DriverUpdateEarnings(0, e.Driver_id);
            loading.dismiss();
          }
        }
      ]
    });

    await alert.present();
  }

  ngOnInit() {
    this.settingsService.getSettings().subscribe(settings => {
      if (settings && settings.currencySymbol) {
        this.currencySymbol = settings.currencySymbol;
      }
    });
  }
}
