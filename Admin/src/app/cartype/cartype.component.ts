import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { AlertController, LoadingController, ModalController } from '@ionic/angular';
import { AvatarService } from '../services/avatar.service';

@Component({
  selector: 'app-cartype',
  templateUrl: './cartype.component.html',
  styleUrls: ['./cartype.component.scss'],
})
export class CartypeComponent implements OnInit {
  approve2: boolean = true;
  @Input() info;
  form: FormGroup;
  profileImage: Photo | null = null;
  previewImage: string | null = null;
  constructor(private loadingController: LoadingController, private avatarService: AvatarService, private alertController: AlertController, public modalCtrl: ModalController) { }


  async ngOnInit() {
    this.form = new FormGroup({
      name: new FormControl(this.info?.name ?? '', {
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(50)]
      }),
      seats : new FormControl(this.info?.seatNum ?? 0, {
        validators: [Validators.required, Validators.min(1), Validators.max(20)]
      }),
      // surcharge: new FormControl(this.info?.surcharge ?? '', {
      //   validators: [Validators.required, Validators.minLength(1), Validators.maxLength(50)]
      // }),
      // mileage: new FormControl(this.info?.mileage ?? '', {
      //   validators: [Validators.required, Validators.minLength(1), Validators.maxLength(50)]
      // }),
    });

    this.previewImage = this.info?.image ?? null;
  }


  async changeImage() {

    const image = await Camera.getPhoto({
      quality: 20,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
    });

    if (image) {
      this.profileImage = image;
      this.previewImage = `data:${image.format ? `image/${image.format}` : 'image/jpeg'};base64,${image.base64String}`;
    }
  }

  closeModal(){
    this.modalCtrl.dismiss();
  }


  async processNow(){
    if (this.profileImage){
      
    const loading = await this.loadingController.create();
    await loading.present();

    const nameExists = await this.avatarService.checkCartypeNameExists(this.form.value.name);
    if (nameExists) {
      loading.dismiss();
      const alert = await this.alertController.create({
        header: 'Name Taken',
        message: 'This car type name is already taken. Please choose another one.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    const fk = await this.avatarService.CartypeSave(
      this.form.value.name,
      this.form.value.seats,
      // this.form.value.surcharge,
      // this.form.value.mileage
    );
    console.log(fk.id);

    const result = await this.avatarService.uploadCartype(this.profileImage, fk.id);
    loading.dismiss();
      
      this.modalCtrl.dismiss();

      if (!result) {
        const alert = await this.alertController.create({
          header: 'Upload failed',
          message: 'There was a problem uploading your avatar.',
          buttons: ['OK'],
        });
        await alert.present();
      }
    }else{
      const alert = await this.alertController.create({
        header: 'Upload An Icon',
        message: 'No icon detected',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  

  async EditNow(){
      
    const loading = await this.loadingController.create();
    await loading.present();

    const nameExists = await this.avatarService.checkCartypeNameExists(this.form.value.name, this.info.id);
    if (nameExists) {
      loading.dismiss();
      const alert = await this.alertController.create({
        header: 'Name Taken',
        message: 'This car type name is already taken by another entry. Please choose another one.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    await this.avatarService.CartypeUpdate(
      this.info.id,
      this.form.value.name,
      this.form.value.seats,
      // this.form.value.surcharge,
      // this.form.value.mileage
    );

    if (this.profileImage){
      const result = await this.avatarService.uploadCartype(this.profileImage, this.info.id);
      if (!result) {
        await loading.dismiss();
        const alert = await this.alertController.create({
          header: 'Upload failed',
          message: 'There was a problem uploading the icon.',
          buttons: ['OK'],
        });
        await alert.present();
        return;
      }
    }

    loading.dismiss();
    this.modalCtrl.dismiss();
    if (!this.profileImage) {
      // ensure preview reflects persisted values
      this.previewImage = this.info?.image ?? null;
    }
    
  }






}
