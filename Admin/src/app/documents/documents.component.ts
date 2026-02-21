import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, LoadingController, ToastController } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AvatarService } from 'src/app/services/avatar.service';

@Component({
  selector: 'app-documents',
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule]
})
export class DocumentsComponent implements OnInit {
  @Input() info: any;
  form: FormGroup;
  isEditMode = false;
  selectedFile: File | null = null;
  selectedFileName: string = '';

  constructor(
    private fb: FormBuilder,
    private dataService: AvatarService,
    private modalCtrl: ModalController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {
    this.isEditMode = !!this.info;

    this.form = this.fb.group({
      name: [this.info?.name || '', Validators.required],
      type: [this.info?.type || 'text', Validators.required],
      content: [this.info?.content || ''],
      description: [this.info?.description || '']
    });

    this.onTypeChange(); // Set initial validators
  }

  onTypeChange() {
    const type = this.form.get('type').value;
    if (type === 'text') {
      this.form.get('content').setValidators([Validators.required]);
    } else {
      this.form.get('content').clearValidators();
    }
    this.form.get('content').updateValueAndValidity();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.selectedFileName = file.name;
    }
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const type = this.form.get('type').value;

    if (type !== 'text' && !this.selectedFile && !this.isEditMode) {
      this.presentToast('Please select a file');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Saving...'
    });
    await loading.present();

    try {
      let content = this.form.get('content').value;

      if (this.selectedFile) {
        const path = `documents/${new Date().getTime()}_${this.selectedFile.name}`;
        content = await this.dataService.uploadFile(this.selectedFile, path);
      }

      if (this.isEditMode) {
        await this.dataService.DocumentComponentUpdate(
          this.info.id,
          this.form.get('name').value,
          type,
          content,
          this.form.get('description').value
        );
      } else {
        await this.dataService.DocumentSave(
          this.form.get('name').value,
          type,
          content,
          this.form.get('description').value
        );
      }

      loading.dismiss();
      this.modalCtrl.dismiss({ saved: true });
    } catch (error) {
      console.error('Error saving document:', error);
      loading.dismiss();
      this.presentToast('Error saving document: ' + error.message);
    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async presentToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color: 'danger'
    });
    toast.present();
  }
}
