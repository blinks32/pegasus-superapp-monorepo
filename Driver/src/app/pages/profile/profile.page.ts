import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource,Photo } from '@capacitor/camera';

import { StatusBar } from '@capacitor/status-bar';
import { Auth, updateProfile } from '@angular/fire/auth';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { LoadingController, AlertController, NavController, ToastController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';
import { AvatarService } from 'src/app/services/avatar.service';
import { TranslateService } from '@ngx-translate/core';
import { RideSharingService } from 'src/app/services/ride-sharing.service';
import { RideSharingPreferences, RIDE_SHARING_CONFIG } from 'src/app/interfaces/shared-ride';
import { SettingsService } from 'src/app/services/settings.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit, OnDestroy {

  profile: any = null;
  currentLanguage: string = 'en';
  isLoading: boolean = true;
  user: import("@angular/fire/auth").User;
  totalRides: number = 0;
  currencySymbol: string = '$';
  private settingsSubscription: Subscription;

  // Ride sharing settings
  rideSharingEnabled: boolean = false;
  maxPassengers: number = RIDE_SHARING_CONFIG.MAX_PASSENGERS_DEFAULT;
  maxDetourPercent: number = RIDE_SHARING_CONFIG.MAX_DETOUR_PERCENT;

  constructor(
    public avatarService: AvatarService,
    private authService: AuthService,
    private auth: Auth,
    private firestore: Firestore,
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private nav: NavController,
    private translate: TranslateService,
    private rideSharingService: RideSharingService,
    private toastController: ToastController,
    private settingsService: SettingsService
  ) {
    
        // Load profile after user is confirmed authenticated
        this.loadProfile();
        
        // Subscribe to settings
        this.settingsSubscription = this.settingsService.settings$.subscribe(settings => {
          this.currencySymbol = settings.currencySymbol;
        });
  
    
  }

  ngOnDestroy() {
    if (this.settingsSubscription) {
      this.settingsSubscription.unsubscribe();
    }
  }

  async loadProfile() {
    this.isLoading = true;
    const currentUser = this.auth.currentUser;
    
    if (currentUser) {
      console.log('Loading profile for user:', currentUser.uid);
      
      // Load history count from Firestore
      await this.loadHistoryCount(currentUser.uid);
      
      this.avatarService.getUserProfile(currentUser).subscribe(
        (profile) => {
          console.log('Profile loaded:', profile);
          this.profile = profile;
          // Override Driver_num_rides with actual history count
          this.profile.Driver_num_rides = this.totalRides;
          this.isLoading = false;
          
          // Load ride sharing preferences
          if (profile.rideSharingPreferences) {
            this.rideSharingEnabled = profile.rideSharingPreferences.enabled || false;
            this.maxPassengers = profile.rideSharingPreferences.maxPassengers || RIDE_SHARING_CONFIG.MAX_PASSENGERS_DEFAULT;
            this.maxDetourPercent = profile.rideSharingPreferences.maxDetourPercent || RIDE_SHARING_CONFIG.MAX_DETOUR_PERCENT;
          } else {
            this.rideSharingEnabled = profile.rideSharingEnabled || false;
          }
        },
        (error) => {
          console.error('Error loading profile:', error);
          this.isLoading = false;
        }
      );
    } else {
      console.log('No current user found');
      this.isLoading = false;
    }
  }

  async loadHistoryCount(userId: string) {
    try {
      const historyRef = collection(this.firestore, `Drivers/${userId}/History`);
      const snapshot = await getDocs(historyRef);
      this.totalRides = snapshot.docs.length;
      console.log('Total rides from history:', this.totalRides);
    } catch (error) {
      console.error('Error loading history count:', error);
      this.totalRides = 0;
    }
  }

  async logout() {
    await this.authService.logout();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  goBack(){
    this.router.navigate(['tabs/home']); // Replace '/previous-page' with your desired route
  }

  ngOnInit() {
    // Backup profile load in case auth state was already set before constructor
    if (this.auth.currentUser && !this.profile) {
      this.loadProfile();
    }
  }
// --from rider pageasync changeImage(source: CameraSource) {
//     try {
//       const image = await Camera.getPhoto({
//         quality: 90,
//         allowEditing: false,
//         resultType: CameraResultType.Base64,
//         source: source,
//       });

//       if (image) {
//         const loading = await this.loadingController.create();
//         await loading.present();

//         if (!this.avatarService.profile?.uid) {
//           loading.dismiss();
//           const alert = await this.alertController.create({
//             header: await this.translate.get('UPLOAD_FAILED').toPromise(),
//             message: await this.translate.get('PROFILE_MISSING').toPromise(),
//             buttons: ['OK'],
//           });
//           await alert.present();
//           return;
//         }

//         const result = await this.avatarService.uploadImage(image, this.avatarService.profile.uid);
//         loading.dismiss();

//         if (!result) {
//           const alert = await this.alertController.create({
//             header: await this.translate.get('UPLOAD_FAILED').toPromise(),
//             message: await this.translate.get('UPLOAD_ERROR').toPromise(),
//             buttons: ['OK'],
//           });
//           await alert.present();
//         } else {
//           const alert = await this.alertController.create({
//             header: await this.translate.get('UPLOAD_SUCCESS').toPromise(),
//             message: await this.translate.get('AVATAR_UPDATED').toPromise(),
//             buttons: ['OK'],
//           });
//           await alert.present();

//           // Update the user profile
//           if (this.auth.currentUser) {
//             const result = await this.avatarService.uploadImage(image as Photo, this.avatarService.profile.uid);
//             await updateProfile(this.user, {
//               photoURL: result,
//             });
//             this.user = this.auth.currentUser; // Refresh the user object
//           }
//         }
//       }
//     } catch (error) {
//       const alert = await this.alertController.create({
//         header: await this.translate.get('UPLOAD_FAILED').toPromise(),
//         message: `${await this.translate.get('UPLOAD_ERROR').toPromise()}: ${error.message}`,
//         buttons: ['OK'],
//       });
//       await alert.present();
//     }
//   }
  async changeImage() {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera, // Camera, Photos or Prompt!
    });

    if (image) {
      const loading = await this.loadingController.create();
      await loading.present();

      const result = await this.avatarService.uploadImage(image, this.avatarService.profile.uid);
      loading.dismiss();

      if (!result) {
        const alert = await this.alertController.create({
          header: 'Upload failed',
          message: 'There was a problem uploading your avatar.',
          buttons: ['OK'],
        });
        await alert.present();
      }
    }
  }

  setLanguage(event: any) {
    const lang = event.detail.value;
    this.currentLanguage = lang;
    this.translate.use(lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('preferred_language', lang);
  }

  // Ride Sharing Settings Methods
  async toggleRideSharing(event: any) {
    this.rideSharingEnabled = event.detail.checked;
    await this.saveRideSharingPreferences();
  }

  async onMaxPassengersChange(event: any) {
    this.maxPassengers = event.detail.value;
    await this.saveRideSharingPreferences();
  }

  async onMaxDetourChange(event: any) {
    this.maxDetourPercent = event.detail.value;
    await this.saveRideSharingPreferences();
  }

  async saveRideSharingPreferences() {
    if (!this.auth.currentUser) return;

    const preferences: RideSharingPreferences = {
      enabled: this.rideSharingEnabled,
      maxPassengers: this.maxPassengers,
      maxDetourPercent: this.maxDetourPercent,
      preferredRouteTypes: [],
      minFareForSharing: 5 // Default minimum fare
    };

    try {
      await this.rideSharingService.updateRideSharingPreferences(
        this.auth.currentUser.uid,
        preferences
      );

      const toast = await this.toastController.create({
        message: await this.translate.get('PROFILE.RIDE_SHARING.SETTINGS_SAVED').toPromise() || 'Ride sharing settings saved',
        duration: 2000,
        color: 'success',
        position: 'bottom'
      });
      await toast.present();
    } catch (error) {
      console.error('Error saving ride sharing preferences:', error);
      const toast = await this.toastController.create({
        message: 'Failed to save settings',
        duration: 2000,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
    }
  }

  getProfileImageSrc(): string {
    console.log('Driver_imgUrl value:', this.profile?.Driver_imgUrl);
    
    if (!this.profile?.Driver_imgUrl) {
      return 'assets/imgs/about.svg';
    }
    
    const imgUrl = this.profile.Driver_imgUrl;
    
    // Check if it's a stored image reference (img_ prefix from details page)
    if (imgUrl.startsWith('img_')) {
      // This is a locally stored image reference, need to retrieve from storage
      // For now, return placeholder - the actual image should be retrieved from local storage
      console.log('Image reference found:', imgUrl);
      return 'assets/imgs/about.svg';
    }
    
    // Check if it's an external URL (ui-avatars.com, via.placeholder.com, etc.)
    if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
      // If it's an external URL, replace with local asset for Android compatibility
      return 'assets/imgs/about.svg';
    }
    
    // Check if it's a local asset path
    if (imgUrl.startsWith('assets/')) {
      return imgUrl;
    }
    
    // Check if it's base64 data
    if (imgUrl.startsWith('data:image')) {
      return imgUrl;
    }
    
    // Default fallback
    return 'assets/imgs/about.svg';
  }
}