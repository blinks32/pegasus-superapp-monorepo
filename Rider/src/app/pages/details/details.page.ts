import { Component, OnInit } from '@angular/core';
import { Auth, updateEmail, updateProfile, User, signInWithPopup, reauthenticateWithCredential, signInWithPhoneNumber, sendEmailVerification } from '@angular/fire/auth';
import { GoogleAuthProvider, RecaptchaVerifier, PhoneAuthProvider, EmailAuthProvider } from 'firebase/auth';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { AvatarService } from 'src/app/services/avatar.service';
import { OverlayService } from 'src/app/services/overlay.service';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { ActionSheetController, AlertController, LoadingController, Platform } from '@ionic/angular';
import { ImageUploadService } from 'src/app/services/image-upload.service'; // Import the service
import { TranslateService } from '@ngx-translate/core'; // Add this import

@Component({
  selector: 'app-details',
  templateUrl: './details.page.html',
  styleUrls: ['./details.page.scss'],
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
  

  async reauthenticateWithPhoneNumber(): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const user = this.authy.currentUser;
        if (!user) throw new Error('User not authenticated');
  
        console.log('Creating reCAPTCHA container');
        const recaptchaContainerId = 'recaptcha-container';
        let recaptchaContainer = document.getElementById(recaptchaContainerId);
        if (!recaptchaContainer) {
          recaptchaContainer = document.createElement('div');
          recaptchaContainer.id = recaptchaContainerId;
          document.body.appendChild(recaptchaContainer);
        } else {
          recaptchaContainer.innerHTML = ''; // Clear any existing content
        }
  
        console.log('Initializing reCAPTCHA verifier');
        const recaptchaVerifier = new RecaptchaVerifier(recaptchaContainerId, {}, this.authy);
        const phoneNumber = user.phoneNumber;
  
        if (!phoneNumber) {
          throw new Error('User phone number is missing');
        }
  
        let verificationResult;
        try {
          console.log('Attempting to sign in with phone number');
          verificationResult = await signInWithPhoneNumber(this.authy, phoneNumber, recaptchaVerifier);
          console.log('Verification result:', verificationResult);
        } catch (error) {
          console.error('Error during signInWithPhoneNumber', error);
          
          let errorMessage = await this.translate.get('SIGN_IN_ERROR').toPromise();
          
          // Handle specific error codes
          if (error.code === 'auth/invalid-phone-number') {
            errorMessage = await this.translate.get('MOBILE_INVALID').toPromise();
          } else if (error.code === 'auth/network-request-failed') {
            errorMessage = await this.translate.get('NETWORK_ERROR').toPromise();
          } else if (error.code === 'auth/too-many-requests') {
            errorMessage = await this.translate.get('PLEASE_WAIT').toPromise();
          }
          
          this.overlay.showAlert(
            await this.translate.get('ERROR').toPromise(),
            errorMessage
          );
          reject(error);
          return;
        }
  
        if (!verificationResult.verificationId) {
          throw new Error('Verification ID is missing in the verification result');
        }
  
        const storedOTP = localStorage.getItem('defaultOTP');
        const userVerificationCode = storedOTP;
        console.log("This is number: " + userVerificationCode)
  
        console.log('Prompting user for verification code');
        const alert = await this.alertController.create({
          header: 'Verification',
          inputs: [
            {
              name: 'verificationCode',
              type: 'text',
              placeholder: 'Enter verification code',
              value: userVerificationCode // Set default value if isRandom is true
            }
          ],
          buttons: [
            {
              text: 'Cancel',
              role: 'cancel',
              handler: () => {
                console.log('Verification cancelled');
                reject(new Error('Verification cancelled'));
              }
            },
            {
              text: 'Verify',
              handler: async (data) => {
                const verificationCode = data.verificationCode;
                if (!verificationCode) {
                  reject(new Error('Verification code is required'));
                  return;
                }
                try {
                  console.log('Attempting to verify phone number with verification code');
                  const phoneCredential = PhoneAuthProvider.credential(verificationResult.verificationId, verificationCode);
                  await reauthenticateWithCredential(user, phoneCredential);
                  localStorage.removeItem('defaultOTP');
                  await this.updateProfile();
                  console.log('User re-authenticated with phone number');
                  resolve();
                } catch (error) {
                  console.error('Error verifying phone number', error);
                  reject(error);
                }
              }
            }
          ]
        });
        await alert.present();
  
      } catch (error) {
        console.error('Error during phone re-authentication', error);
        this.overlay.showAlert('Error', error.message || 'An error occurred during phone re-authentication');
        reject(error);
      }
    });
  }

  // Try to re-authenticate the user using available methods.
  // Returns true if re-authentication succeeded, false otherwise.
  async reauthenticateUser(): Promise<boolean> {
    try {
      const user = this.authy.currentUser;
      if (!user) return false;

      // Prefer phone-based re-authentication if phoneNumber exists
      if (user.phoneNumber) {
        try {
          await this.reauthenticateWithPhoneNumber();
          return true;
        } catch (e) {
          console.error('Phone re-authentication failed', e);
          // continue to password fallback
        }
      }

      // If user has an email, prompt for password to re-authenticate
      if (user.email) {
        return await new Promise<boolean>(async (resolve) => {
          const alert = await this.alertController.create({
            header: 'Re-authenticate',
            inputs: [
              {
                name: 'password',
                type: 'password',
                placeholder: 'Enter your password'
              }
            ],
            buttons: [
              {
                text: 'Cancel',
                role: 'cancel',
                handler: () => resolve(false)
              },
              {
                text: 'Verify',
                handler: async (data) => {
                  try {
                    const credential = EmailAuthProvider.credential(user.email!, data.password);
                    await reauthenticateWithCredential(user, credential);
                    resolve(true);
                  } catch (err) {
                    console.error('Password re-authentication failed', err);
                    this.overlay.showAlert(await this.translate.get('ERROR').toPromise(), err.message || await this.translate.get('GENERIC_ERROR').toPromise());
                    resolve(false);
                  }
                }
              }
            ]
          });
          await alert.present();
        });
      }

      return false;
    } catch (e) {
      console.error('reauthenticateUser error', e);
      return false;
    }
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

        // Check if email is provided before attempting to update it
        if (this.form.value.email && user.email !== this.form.value.email) {
          // Show confirmation dialog for email change
          const alert = await this.alertController.create({
            header: await this.translate.get('EMAIL_CHANGE').toPromise(),
            message: await this.translate.get('EMAIL_CHANGE_VERIFY').toPromise(),
            buttons: [
              {
                text: await this.translate.get('CANCEL').toPromise(),
                role: 'cancel'
              },
              {
                text: await this.translate.get('CONTINUE').toPromise(),
                handler: async () => {
                  try {
                    await updateEmail(user, this.form.value.email);
                    // Send verification email
                    await sendEmailVerification(user);

                    // Show success message
                    await this.alertController.create({
                      header: await this.translate.get('EMAIL_VERIFICATION_SENT').toPromise(),
                      message: await this.translate.get('CHECK_EMAIL').toPromise(),
                      buttons: ['OK']
                    }).then(alert => alert.present());
                  } catch (error) {
                    if (error && error.code === 'auth/requires-recent-login') {
                      const reauthOk = await this.reauthenticateUser();
                      if (reauthOk) {
                        try {
                          const freshUser = this.authy.currentUser;
                          if (freshUser) {
                            await updateEmail(freshUser, this.form.value.email);
                            await sendEmailVerification(freshUser);
                            await this.alertController.create({
                              header: await this.translate.get('EMAIL_VERIFICATION_SENT').toPromise(),
                              message: await this.translate.get('CHECK_EMAIL').toPromise(),
                              buttons: ['OK']
                            }).then(a => a.present());
                          }
                        } catch (err2) {
                          console.error('Failed to update email after reauthentication', err2);
                          this.overlay.showAlert(await this.translate.get('ERROR').toPromise(), err2.message || await this.translate.get('GENERIC_ERROR').toPromise());
                          return;
                        }
                      } else {
                        // Re-authentication failed or was cancelled by the user.
                        this.overlay.showAlert(await this.translate.get('ERROR').toPromise(), await this.translate.get('PLEASE_WAIT').toPromise());
                        return;
                      }
                    } else {
                      this.overlay.showAlert(await this.translate.get('ERROR').toPromise(), error?.message || await this.translate.get('GENERIC_ERROR').toPromise());
                      return;
                    }
                  }

                  // Only create/update avatar and navigate after email handling completes
                  try {
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
                  } catch (createErr) {
                    console.error('Error creating/updating avatar after email change', createErr);
                    this.overlay.showAlert(await this.translate.get('ERROR').toPromise(), createErr?.message || await this.translate.get('GENERIC_ERROR').toPromise());
                    this.approve2 = false;
                  }
                }
              }
            ]
          });
          await alert.present();
          // Stop further execution here; avatar.createUser will be handled in the alert handler.
          return;
        }

        // No email change required — proceed to create/update avatar and navigate
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
      } else if (e.code === 'auth/requires-recent-login') {
        this.reauthenticateWithPhoneNumber();
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
