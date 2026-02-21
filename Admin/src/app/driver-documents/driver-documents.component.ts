import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, LoadingController, AlertController } from '@ionic/angular';
import { AvatarService } from '../services/avatar.service';

@Component({
  selector: 'app-driver-documents',
  templateUrl: './driver-documents.component.html',
  styleUrls: ['./driver-documents.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class DriverDocumentsComponent implements OnInit {
  @Input() info: any;
  records: any[] = [];
  isLoading: boolean = true;
  hasNoData: boolean = false;
  driverName: string = '';

  constructor(
    private chatService: AvatarService,
    public modalCtrl: ModalController,
    private loadingController: LoadingController,
    public alertController: AlertController
  ) { }

  ngOnInit(): void {
    this.driverName = this.info?.Driver_name || 'Driver';
    this.loadDocuments();
  }

  loadDocuments() {
    this.isLoading = true;
    if (!this.info?.Driver_id) {
      this.isLoading = false;
      this.hasNoData = true;
      return;
    }

    this.chatService.getDocument(this.info.Driver_id).subscribe({
      next: (docs: any[]) => {
        this.records = docs || [];
        this.hasNoData = this.records.length === 0;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading documents:', err);
        this.records = [];
        this.hasNoData = true;
        this.isLoading = false;
      }
    });
  }

  closeModal() {
    this.modalCtrl.dismiss();
  }

  openDocument(url: string) {
    window.open(url, '_blank');
  }

  getDocumentIcon(type: string): string {
    switch (type) {
      case 'image':
        return 'image-outline';
      case 'pdf':
        return 'document-outline';
      case 'text':
      default:
        return 'document-text-outline';
    }
  }

  getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'danger';
      case 'pending':
      default:
        return 'warning';
    }
  }
}