import { Component, OnInit } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { AvatarService } from 'src/app/services/avatar.service';
import { OverlayService } from 'src/app/services/overlay.service';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { AlertController } from '@ionic/angular';
import { take } from 'rxjs/operators';

export interface RoleType {
  id?: string;
  name: string;
  // add other role properties if needed
}

@Component({
  selector: 'app-details',
  templateUrl: './details.page.html',
  styleUrls: ['./details.page.scss'],
})
export class DetailsPage implements OnInit {

  form: FormGroup;
  coordinates: any = null;
  approve2: boolean;
  selected: any = 'Select Role';
  roletypes: RoleType[] = [];
  currentRole: any;
  imageURl: any;
  licenseURl: any;
  licenseImage: any;
  profileImage: any;
  private pendingRoleName?: string;
  isGoogleUser: boolean = false;
  phoneNumber: string = '';

  constructor(
    private overlay: OverlayService, private authy: Auth, private auth: AuthService, private avatar: AvatarService, private router: Router, private alertController: AlertController
  ) { }

  get user() {
    return this.authy.currentUser;
  }

  ngOnInit() {
    this.avatar.getRoles().subscribe({
      next: (roles) => {
        if (roles && roles.length > 0) {
          this.roletypes = roles as RoleType[];
          console.log('Roles loaded:', this.roletypes);
          this.setSelectedRoleFromProfile();
        } else {
          console.log('No roles found');
        }
      },
      error: (error) => {
        console.error('Error fetching roles:', error);
        this.overlay.showAlert('Error', 'Failed to load roles');
      }
    });

    // Check if user signed in with Google
    const googlePhoneNumber = localStorage.getItem('googlePhoneNumber');
    const currentUser = this.authy.currentUser;

    // Determine if user is a Google user (no phone number from Firebase auth)
    if (currentUser && !currentUser.phoneNumber) {
      this.isGoogleUser = true;
      // Pre-fill phone from stored Google data if available
      if (googlePhoneNumber) {
        this.phoneNumber = googlePhoneNumber;
      }
    } else if (currentUser && currentUser.phoneNumber) {
      this.phoneNumber = currentUser.phoneNumber;
    }

    this.form = new FormGroup({
      fullname: new FormControl(null, {
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(200)]
      }),
      lastname: new FormControl(null, {
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(200)]
      }),
      email: new FormControl(null, {
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(200)]
      }),
      phone: new FormControl(this.phoneNumber, {
        validators: this.isGoogleUser ? [Validators.required, Validators.minLength(10)] : []
      }),
    });

    // Pre-fill email from Google user
    if (currentUser && currentUser.email) {
      this.form.patchValue({ email: currentUser.email });
    }

    // Pre-fill name from Google user's display name
    if (currentUser && currentUser.displayName) {
      const [firstName, ...rest] = currentUser.displayName.split(' ');
      const lastName = rest.join(' ').trim();
      this.form.patchValue({
        fullname: firstName,
        lastname: lastName || ''
      });
    }

    // Pre-fill profile image from Google
    if (currentUser && currentUser.photoURL) {
      this.profileImage = currentUser.photoURL;
    }

    this.loadAdminDetails();
  }


  async chooseCarType(event) {
    console.log('Selected role:', event.detail.value);
    this.selected = event.detail.value;
    this.currentRole = event.detail.value?.name;
  }

  private loadAdminDetails(): void {
    this.authy.onAuthStateChanged((user) => {
      if (!user) {
        return;
      }

      this.avatar.getUserProfile(user).pipe(take(1)).subscribe({
        next: (profile: any) => {
          if (!profile) {
            return;
          }
          this.prefillForm(profile);
          this.pendingRoleName = profile.role;
          this.currentRole = profile.role;
          this.setSelectedRoleFromProfile();
        },
        error: (error) => {
          console.error('Error loading admin profile:', error);
          this.overlay.showAlert('Error', 'Failed to load admin profile');
        }
      });
    });
  }

  private prefillForm(profile: any): void {
    if (!this.form) {
      return;
    }

    const fullName = profile?.name || '';
    const [firstName, ...rest] = fullName.split(' ');
    const lastName = rest.join(' ').trim();

    this.form.patchValue({
      fullname: firstName || fullName,
      lastname: lastName || '',
      email: profile?.email || ''
    });

    if (profile?.imageUrl) {
      this.profileImage = profile.imageUrl;
    }
  }

  private setSelectedRoleFromProfile(): void {
    if (!this.roletypes.length) {
      return;
    }

    // Try to match pending role from profile first
    let matchingRole = this.roletypes.find((role) => role.name === this.pendingRoleName);

    // If no profile role, fallback to "Admin" as default
    if (!matchingRole && !this.pendingRoleName) {
      matchingRole = this.roletypes.find((role) => role.name === 'Admin' || role.name === 'ADMIN');
    }

    if (matchingRole) {
      this.selected = matchingRole;
      this.currentRole = matchingRole.name;
    }
  }

  async presentImageSourceChoice() {
    const alert = await this.alertController.create({
      header: 'Select Image Source',
      buttons: [
        {
          text: 'Camera',
          handler: () => {
            this.getImage(CameraSource.Camera);
          }
        },
        {
          text: 'Photo Library',
          handler: () => {
            this.getImage(CameraSource.Photos);
          }
        },
        {
          text: 'URL',
          handler: () => {
            this.promptForImageURL();
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });
    await alert.present();
  }

  async promptForImageURL() {
    const alert = await this.alertController.create({
      header: 'Enter Image URL',
      inputs: [
        {
          name: 'imageUrl',
          type: 'url',
          placeholder: 'https://example.com/image.jpg'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'OK',
          handler: (data) => {
            if (data.imageUrl) {
              this.loadImageFromURL(data.imageUrl);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async getImage(source: CameraSource) {
    try {
      const image = await Camera.getPhoto({
        quality: 70,
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source: source,
        width: 400 // Limit width to reduce size
      });

      if (image.base64String) {
        //           const blob = this.base64ToBlob(this.profileImage);
        // await this.avatar.uploadProfileImage(blob);


        this.profileImage = `data:image/${image.format};base64,${image.base64String}`;
        // Handle the image upload to your service here
      }
    } catch (error) {
      console.error('Error capturing image:', error);
    }
  }


  private base64ToBlob(dataUrl: string): Blob {
    const [meta, base64Data] = dataUrl.split(',');
    const contentType = meta.match(/data:(.*);base64/)?.[1] || 'image/jpeg';
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  }

  async loadImageFromURL(url: string) {
    try {
      // You might want to add validation for the URL here
      this.profileImage = url;
      // Handle the image upload to your service here
    } catch (error) {
      console.error('Error loading image from URL:', error);
    }
  }

  async changeLicense() {
    try {
      const image = await Camera.getPhoto({
        quality: 20,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera, // Camera, Photos or Prompt!
      });
      this.licenseURl = image.dataUrl
      this.licenseImage = image.dataUrl;
    } catch (e) {
      this.overlay.showAlert('Error', e)
    }
  }




  async signIn() {
    try {
      // First get coordinates
      const coordinates = await Geolocation.getCurrentPosition();
      this.coordinates = {
        lat: coordinates.coords.latitude,
        lng: coordinates.coords.longitude
      };

      this.overlay.showAlert('Success', 'Location captured successfully!');
      this.approve2 = true;

      // Check form completeness with profileImage instead of imageURl
      if (this.profileImage &&
        this.currentRole &&
        this.form.value.fullname &&
        this.form.value.lastname &&
        this.form.value.email) {

        // Use form phone number for Google users, otherwise use Firebase auth phone
        const userPhone = this.form.value.phone || this.authy.currentUser.phoneNumber || '';

        await this.avatar.CreateAdmin(
          this.form.value.fullname + ' ' + this.form.value.lastname,
          this.form.value.email,
          userPhone,
          this.currentRole,
          this.profileImage, // Use profileImage instead of imageURl
          true,
          this.coordinates
        );

        // Clear stored Google phone number
        localStorage.removeItem('googlePhoneNumber');

        this.approve2 = false;
        this.router.navigateByUrl('home');
      } else {
        let missingFields = [];
        if (!this.profileImage) missingFields.push('Profile Image');
        if (!this.currentRole) missingFields.push('Role');
        if (!this.form.value.fullname) missingFields.push('First Name');
        if (!this.form.value.lastname) missingFields.push('Last Name');
        if (!this.form.value.email) missingFields.push('Email');

        this.overlay.showAlert(
          'Incomplete Form',
          `Please complete the following fields: ${missingFields.join(', ')}`
        );
      }
    } catch (e) {
      console.error('Sign in error:', e);
      if (e.message === 'User denied Geolocation') {
        this.overlay.showAlert(
          'Location Permission Required',
          'Please enable location services to continue. This is required for the registration process.'
        );
      } else {
        const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
        this.overlay.showAlert('Error', errorMessage);
      }
    }
  }




}
