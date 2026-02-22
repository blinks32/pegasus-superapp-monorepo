import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { IonicModule, LoadingController, AlertController, ModalController, ModalOptions } from '@ionic/angular';
import { DocumentsComponent } from 'src/app/documents/documents.component';
import { AvatarService } from 'src/app/services/avatar.service';

@Component({
  selector: 'app-documents',
  templateUrl: './documents.page.html',
  styleUrls: ['./documents.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, DocumentsComponent]
})
export class DocumentsPage implements OnInit {

  triphistory: any;
  hasNoData = false;
  hideSkeleton = true;
  cartypes: any[] = [];
  skeletOns: {}[];
  isLoading = true;
  constructor(private chatService: AvatarService, public loadingController: LoadingController, public modalCtrl: ModalController) { }

  ngOnInit() {
    this.skeletOns = [
      {}, {}, {}, {}
    ]

    this.loadDocuments();
  }

  private loadDocuments() {
    this.hideSkeleton = true;
    this.isLoading = true;

    this.triphistory = this.chatService.getDocuments();
    this.triphistory.subscribe({
      next: (d: any[]) => {
        this.cartypes = d || [];
        this.hasNoData = this.cartypes.length === 0;
        this.hideSkeleton = false;
        this.isLoading = false;
      },
      error: (err: unknown) => {
        console.error('Failed to load documents', err);
        this.cartypes = [];
        this.hasNoData = true;
        this.hideSkeleton = false;
        this.isLoading = false;
      }
    });
  }


  async EditBtn(item) {
    console.log(item);
    const options: ModalOptions = {
      component: DocumentsComponent,
      componentProps: {
        info: item,
      }
    };
    const modal = this.modalCtrl.create(options);
    (await modal).present();
    const data: any = (await modal).onWillDismiss();
  }


  async AddDoc() {
    const options: ModalOptions = {
      component: DocumentsComponent
    };
    const modal = this.modalCtrl.create(options);
    (await modal).present();
    const data: any = (await modal).onWillDismiss();
  }

  async Delete(item) {
    const loading = await this.loadingController.create();
    await loading.present();
    this.chatService.DocumentDelete(item.id)
    loading.dismiss();
  }

}
