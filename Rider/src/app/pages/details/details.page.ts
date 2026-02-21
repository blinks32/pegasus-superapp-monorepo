import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ActionSheetController, AlertController, LoadingController, Platform } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Auth, updateProfile, User, signInWithPhoneNumber, signInWithPopup } from '@angular/fire/auth';
import { GoogleAuthProvider, RecaptchaVerifier } from 'firebase/auth';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { AvatarService } from 'src/app/services/avatar.service';
import { OverlayService } from 'src/app/services/overlay.service';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { ImageUploadService } from 'src/app/services/image-upload.service';

@Component({
  selector: 'app-details',
  templateUrl: './details.page.html',
  styleUrls: ['./details.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule, TranslateModule]
})
export class DetailsPage implements OnInit {

  form: FormGroup;
  imageUrl: string;
  approve: boolean;
  approve2: boolean;
  user: User;
  backButtonSubscription: any;

  constructor(
    private overlay: OverlayService,
    private authy: Auth,
    private authService: AuthService,
    private avatar: AvatarService,
    private router: Router,
    private actionSheetController: ActionSheetController,
    private alertController: AlertController,
    private imageUploadService: ImageUploadService, // Inject the service
    private loadingController: LoadingController,
    private platform: Platform,
    private translate: TranslateService // Add TranslateService
  ) {
    // Ensure the user is authenticated
    this.authy.onAuthStateChanged((user) => {
      if (user) {
        this.user = user;
        this.avatar.profile = user; // Ensure the profile is set
        this.form.patchValue({
          fullname: user.displayName?.split(' ')[0] || '',
          lastname: user.displayName?.split(' ')[1] || '',
          email: user.email || ''
        });
      }
    });
  }

  ngOnInit() {
    this.form = new FormGroup({
      fullname: new FormControl(null, {
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(200)]
      }),
      lastname: new FormControl(null, {
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(200)]
      }),
      email: new FormControl(null, {
        validators: [Validators.email, Validators.maxLength(200)]
      })
    });
  }

  async changeImage(source: CameraSource) {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: source,
      });

      if (image) {
        const loading = await this.loadingController.create();
        await loading.present();

        if (!this.avatar.profile?.uid) {
          loading.dismiss();
          const alert = await this.alertController.create({
            header: 'Upload failed',
            message: 'Profile UID is missing.',
            buttons: ['OK'],
          });
          await alert.present();
          return;
        }

        try {
          const result = await this.avatar.uploadImage(image, this.avatar.profile.uid);
          loading.dismiss();

          if (!result) {
            const alert = await this.alertController.create({
              header: 'Upload failed',
              message: 'There was a problem uploading your avatar.',
              buttons: ['OK'],
            });
            await alert.present();
          } else {
            this.imageUrl = result; // Ensure imageUrl is updated
            const alert = await this.alertController.create({
              header: 'Upload Successful',
              message: 'Your avatar has been successfully uploaded.',
              buttons: ['OK'],
            });
            await alert.present();
          }
        } catch (uploadError) {
          loading.dismiss();
          if (uploadError.message.includes('Photo URL is required and must be less than 1000 characters')) {
            const alert = await this.alertController.create({
              header: 'Upload failed',
              message: 'The image is too big. Please try another image with a smaller size.',
              buttons: ['OK'],
            });
            await alert.present();
          } else {
            const alert = await this.alertController.create({
              header: 'Upload failed',
              message: `There was a problem uploading your avatar: ${uploadError.message}`,
              buttons: ['OK'],
            });
            await alert.present();
          }
        }
      }
    } catch (error) {
      const alert = await this.alertController.create({
        header: await this.translate.get('ERROR').toPromise(),
        message: `${await this.translate.get('UPLOAD_ERROR').toPromise()}: ${error.message}`,
        buttons: ['OK'],
      });
      await alert.present();
    }
  }


  initializeBackButtonCustomHandler() {
    this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(10, () => {
      this.handleBackButton();
    });
  }

  async handleBackButton() {
    try {
      await this.showExitConfirmation();
    } catch (error) {
      console.error('Error handling back button:', error);
    }
  }

  async showExitConfirmation() {
    const alert = await this.alertController.create({
      header: await this.translate.get('EXIT_APP').toPromise(),
      message: await this.translate.get('EXIT_CONFIRM').toPromise(),
      buttons: [
        {
          text: await this.translate.get('CANCEL').toPromise(),
          role: 'cancel'
        },
        {
          text: await this.translate.get('EXIT').toPromise(),
          handler: () => {
            navigator['app'].exitApp();
          }
        }
      ]
    });
    await alert.present();
  }



  async presentImageSourceActionSheet() {
    const actionSheet = await this.actionSheetController.create({
      header: await this.translate.get('SELECT_IMAGE_SOURCE').toPromise(),
      buttons: [
        {
          text: await this.translate.get('CAMERA').toPromise(),
          icon: 'camera',
          handler: () => {
            this.changeImage(CameraSource.Camera);
          }
        },
        {
          text: await this.translate.get('GALLERY').toPromise(),
          icon: 'images',
          handler: () => {
            this.changeImage(CameraSource.Photos);
          }
        },
        {
          text: await this.translate.get('FILE').toPromise(),
          icon: 'document',
          handler: () => {
            this.selectFile();
          }
        },
        {
          text: await this.translate.get('CANCEL').toPromise(),
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }


  async selectFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (event: any) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (e: any) => {
          const image = {
            base64String: e.target.result.split(',')[1]
          };


          const result = await this.avatar.uploadImage(image as Photo, this.avatar.profile.uid);

          if (!result) {
            const alert = await this.alertController.create({
              header: 'Upload failed',
              message: 'There was a problem uploading your avatar.',
              buttons: ['OK'],
            });
            await alert.present();
          } else {
            this.imageUrl = result; // Ensure imageUrl is updated
            // const alert = await this.alertController.create({
            //   header: 'Upload Successful',
            //   message: 'Your avatar has been successfully uploaded.',
            //   buttons: ['OK'],
            // });
            // await alert.present();
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }






  async updateProfile() {
    try {
      if (!this.form.valid) {
        this.form.markAllAsTouched();
        return;
      }
      this.approve2 = true;

      const user = this.authy.currentUser;
      if (user) {
        console.log('User authenticated', user);

        // First update display name and photo
        console.log('Updating profile...');
        await updateProfile(user, {
          displayName: `${this.form.value.fullname} ${this.form.value.lastname}`,
          photoURL: this.imageUrl,
        });

        // Always proceed to create/update avatar and navigate
        // No more email change verification flow to avoid friction
        await this.avatar.createUser(
          `${this.form.value.fullname} ${this.form.value.lastname}`,
          this.form.value.email,
          this.imageUrl,
          user.phoneNumber,
          user.uid
        );

        this.approve2 = false;
        this.router.navigateByUrl('home');
        console.log('Profile updated');
      }
    } catch (e: any) {
      console.error('An error occurred during profile update', e);
      this.approve2 = false;
      if (e.code === 'auth/email-already-in-use') {
        this.overlay.showAlert(
          await this.translate.get('ERROR').toPromise(),
          await this.translate.get('EMAIL_IN_USE').toPromise()
        );
      } else {
        this.overlay.showAlert(
          await this.translate.get('ERROR').toPromise(),
          e.message || await this.translate.get('GENERIC_ERROR').toPromise()
        );
      }
    }
  }








  async signInWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.authy, provider);
      const user = result.user;

      if (user) {
        this.imageUrl = user.photoURL || ''; // Update imageUrl with photoURL from Google

        this.form.patchValue({
          fullname: user.displayName?.split(' ')[0] || '',
          lastname: user.displayName?.split(' ')[1] || '',
          email: user.email || ''
        });

        console.log("User signed in with Google", user);
        console.log("Email:", user.email);
        console.log("Display Name:", user.displayName);
        console.log("Photo URL:", user.photoURL);

        // Call updateProfile to update user details in Firebase
        await this.updateProfile();
      }
    } catch (error) {
      console.error("Error during Google sign-in", error);
      this.overlay.showAlert('Sign-in failed', 'There was a problem signing in with Google.');
    }
  }

  changeLanguage(lang: string) {
    this.translate.use(lang);
    localStorage.setItem('language', lang);
  }

}
