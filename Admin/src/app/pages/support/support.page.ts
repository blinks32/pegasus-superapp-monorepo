import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, IonContent, ModalController, ModalOptions, NavController } from '@ionic/angular';
import { Firestore, onSnapshot, doc, collection } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { Observable } from 'rxjs';
import { AvatarService } from 'src/app/services/avatar.service';
import { SupportComponent } from 'src/app/support/support.component';

@Component({
  selector: 'app-support',
  templateUrl: './support.page.html',
  styleUrls: ['./support.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, SupportComponent]
})
export class SupportPage implements OnInit {

  skeletOns: {}[];
  hideSkeleton: boolean;
  drivers: any;
  hasNoData: boolean;
  segmentModel = "default";
  triphistory: any;

  filteredRecords: any[] = [];
  currentPage = 0;
  pageSize = 5;
  redy: number = 3;
  cancelledhistory: any;
  constructor(private chatService: AvatarService, private firestore: Firestore, private modalCtrl: ModalController) { }

  async ionViewDidEnter() {
    this.skeletOns = [
      {}, {}, {}, {}
    ]


    this.hideSkeleton = true;
    this.drivers = (this.chatService.getMessages())

    console.log(this.drivers);

    this.drivers.subscribe((d) => {
      this.filteredRecords = [];
      this.filteredRecords = d;
      console.log(d);
      const recordLength = this.filteredRecords.length;
      if (d.length === 0) {
        this.hasNoData = true;
        this.hideSkeleton = false;
      } else {
        this.hideSkeleton = false;
        this.hasNoData = false;
      }

    })


  }

  handleSearch(event: any) {
    const query = event.target.value.toLowerCase();
    this.filteredRecords = this.filteredRecords.filter((item: any) =>
      item.name.toLowerCase().includes(query) ||
      item.phone.toLowerCase().includes(query) ||
      item.email.toLowerCase().includes(query)
    );
    this.currentPage = 0;
  }

  nextPage() {
    this.currentPage++;
  }

  previousPage() {
    this.currentPage--;
  }

  ngOnInit() {
  }


  async gotoDocs(item) {
    console.log(item);
    const options: ModalOptions = {
      component: SupportComponent,
      componentProps: {
        info: item
      }
    };
    const modal = await this.modalCtrl.create(options);
    modal.present();
    const data: any = await modal.onWillDismiss();

  }

}