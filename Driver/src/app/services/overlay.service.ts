import { Injectable } from '@angular/core';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class OverlayService {
  isLoading: any;
  private currentAlert: HTMLIonAlertElement;
  constructor(private loadingCtrl: LoadingController,private toast: ToastController,  private alertController: AlertController) { }


  showLoader(msg) {
    if(!this.isLoading) this.isLoading = true;
    return this.loadingCtrl.create({
      message: msg,
      spinner: 'lines-sharp',
      cssClass: 'default-alert'
    }).then(res => {
      res.present().then(() => {
        if(!this.isLoading) {
          res.dismiss().then(() => {
            console.log('abort presenting');
          });
        }
      })
    })
    .catch(e => {
      this.isLoading = false;
      console.log(e);
    })
  }

  hideLoader() {
    if(this.isLoading) this.isLoading = false;
    return this.loadingCtrl.dismiss()
    .then(() => console.log('dismissed'))
    .catch(e => console.log(e));
  }

  async showToast(message) {
    const alert = await this.toast.create({
      message: message,
      position: 'top',
      duration: 500,
      cssClass: 'default-alert'
      
    });
    await alert.present();
  }


async showAlert(header: string, message: string) {
  const alert = await this.alertController.create({
    header,
    message,
    cssClass: 'default-alert',
    buttons: ['OK'],
  });
  this.currentAlert = alert;
  await this.currentAlert.present();
}

hideAlert() {
  if (this.currentAlert) {
    this.currentAlert.dismiss();
    this.currentAlert = null;
  }
}

async showPrompt(header: string, message: string): Promise<string> {
  const alert = await this.alertController.create({
    header,
    message,
    inputs: [
      {
        name: 'amount',
        type: 'number',
        placeholder: '0.00'
      }
    ],
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel'
      },
      {
        text: 'OK',
        handler: (data) => data.amount
      }
    ]
  });

  await alert.present();
  const result = await alert.onDidDismiss();
  return result.role !== 'cancel' ? result.data.values.amount : null;
}

}
