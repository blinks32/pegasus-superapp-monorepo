import { Component, OnInit, OnDestroy } from '@angular/core';
import { Auth, updateEmail, updateProfile, User, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, PhoneAuthProvider, reauthenticateWithCredential, signInWithPhoneNumber, sendEmailVerification } from '@angular/fire/auth';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AvatarService } from 'src/app/services/avatar.service';
import { OverlayService } from 'src/app/services/overlay.service';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { ActionSheetController, AlertController, LoadingController, Platform, ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { distinctUntilChanged, debounceTime } from 'rxjs/operators';
import { doc, setDoc, serverTimestamp, Firestore, getDoc, collection, collectionData, onSnapshot } from '@angular/fire/firestore';
import { getDownloadURL, ref, Storage, uploadString } from '@angular/fire/storage';
import { Drivers } from './../../interfaces/drivers';
import { geohashForLocation } from 'geofire-common';
import { Subscription } from 'rxjs';

// Document interfaces
export interface RequiredDocument {
  id?: string;
  name: string;
  type: 'text' | 'image' | 'pdf';
  description: string;
  content?: string; // Instructional text or sample
}

export interface DriverDocument {
  id?: string;
  name: string;
  type: 'text' | 'image' | 'pdf';
  value: string; // Text content or URL
  date: any;
  status: 'Pending' | 'Submitted' | 'Approved' | 'Rejected';
}

@Component({
  selector: 'app-details',
  templateUrl: './details.page.html',
  styleUrls: ['./details.page.scss'],
})
export class DetailsPage implements OnInit, OnDestroy {
  [x: string]: any;
  form: FormGroup;
  imageUrl: string;
  imageDisplayUrl: string = '';
  licenseDisplayUrl: string = '';
  approve: boolean;
  approve2: boolean;
  user: User;
  cartypes: import("@angular/fire/firestore").DocumentData[] = [];
  backButtonSubscription: any;
  isSubmitting = false;
  isUploading = false;
  isUploadingLicense = false;

  // Document-related properties
  requiredDocuments: RequiredDocument[] = [];
  driverDocuments: Map<string, DriverDocument> = new Map();
  documentSubscriptions: Subscription[] = [];
  uploadingDocumentId: string | null = null;
  private requiredDocsUnsubscribe: (() => void) | null = null;
  private driverDocsUnsubscribe: (() => void) | null = null;

  constructor(
    private overlay: OverlayService,
    private authy: Auth,
    private avatar: AvatarService,
    private router: Router,
    private actionSheetController: ActionSheetController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private platform: Platform,
    private translate: TranslateService,
    private firestore: Firestore,
    private storage: Storage
  ) {
    // Ensure the user is authenticated
    this.authy.onAuthStateChanged((user) => {
      if (user) {
        this.user = user;
        this.avatar.profile = user; // Ensure the profile is set
        console.log(user.uid);
        this.form.patchValue({
          fullname: user.displayName?.split(' ')[0] || '',
          lastname: user.displayName?.split(' ')[1] || '',
          email: user.email || ''
        });
        // Subscribe to documents when user is authenticated
        this.subscribeToDocuments();
      }
    });
    this.avatar.getCartypes().subscribe({
      next: (d) => {
        console.log('Cartypes received:', d);
        this.cartypes = d;
      },
      error: (error) => {
        console.error('Failed to fetch cartypes:', error);
        // Fallback to mock data if service fails
        this.cartypes = [
          { id: 'sedan', name: 'Sedan' },
          { id: 'suv', name: 'SUV' },
          { id: 'hatchback', name: 'Hatchback' },
          { id: 'pickup', name: 'Pickup Truck' },
          { id: 'van', name: 'Van' },
          { id: 'coupe', name: 'Coupe' }
        ];
      }
    });
  }

  ngOnInit() {
    this.initForm();
    // Initialize with local default images for Android compatibility
    if (!this.imageDisplayUrl) {
      this.imageDisplayUrl = 'assets/imgs/about.svg';
      this.imageUrl = 'assets/imgs/about.svg'; // Set the imageUrl for validation
    }
    // if (!this.licenseDisplayUrl) {
    //   this.licenseDisplayUrl = 'assets/icon/favicon.png';
    //   // Set the form control value for license image
    //   this.form.patchValue({
    //     driverLicenseImage: 'assets/icon/favicon.png'
    //   });
    // }

    // Test connectivity on page load
    this.testConnectivity();
  }

  async testConnectivity() {
    try {
      console.log('Testing Firebase connectivity...');
      const isConnected = await this.avatar.testConnectivity();
      console.log('Connectivity test result:', isConnected ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      console.error('Connectivity test error:', error);
    }
  }

  // Helper method to add timeout to promises
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      )
    ]);
  }

  // Method to reset form state in case of errors
  private resetFormState() {
    this.isSubmitting = false;
    this.isUploading = false;
    this.isUploadingLicense = false;
  }

  // Method to check if all required data is present for submission
  isFormCompleteForSubmission(): boolean {
    const formValid = this.form.valid;

    // Accept both uploaded images (img_) and default images (assets/)
    const hasProfileImage = this.imageUrl &&
      (this.imageUrl.startsWith('img_') || this.imageUrl.startsWith('assets/'));

    const licenseImageValue = this.form.get('driverLicenseImage')?.value;
    const hasLicenseImage = licenseImageValue &&
      (licenseImageValue.startsWith('img_') || licenseImageValue.startsWith('assets/'));

    // Check if all required documents have been submitted
    const allDocumentsSubmitted = this.areAllDocumentsSubmitted();

    console.log('Form validation check:', {
      formValid,
      hasProfileImage,
      hasLicenseImage,
      //allDocumentsSubmitted,
      imageUrl: this.imageUrl,
      licenseImageValue: licenseImageValue
    });

    // return formValid && hasProfileImage && hasLicenseImage && allDocumentsSubmitted;

    return formValid && hasProfileImage && hasLicenseImage ;
  }

  // Method to check if all required documents are submitted
  areAllDocumentsSubmitted(): boolean {
    // If no required documents exist, return true
    if (this.requiredDocuments.length === 0) {
      return true;
    }

    // Check if every required document has been submitted
    return this.requiredDocuments.every(doc => this.driverDocuments.has(doc.id));
  }

  // Get list of missing documents for display
  getMissingDocuments(): RequiredDocument[] {
    return this.requiredDocuments.filter(doc => !this.driverDocuments.has(doc.id));
  }

  private initForm() {
    this.form = new FormGroup({
      fullname: new FormControl('', {
        validators: [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(50),
          Validators.pattern('^[a-zA-Z ]*$')
        ],
        updateOn: 'change'
      }),
      lastname: new FormControl('', {
        validators: [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(50),
          Validators.pattern('^[a-zA-Z ]*$')
        ],
        updateOn: 'change'
      }),
      email: new FormControl('', {
        validators: [
          Validators.required,
          Validators.email,
          Validators.maxLength(100)
        ],
        updateOn: 'change'
      }),
      plateNumber: new FormControl('', {
        validators: [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(10),
          Validators.pattern('^[A-Z0-9- ]*$')
        ]
      }),
      carType: new FormControl('', {
        validators: [Validators.required]
      }),
      carName: new FormControl('', {
        validators: [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(50)
        ]
      }),
      mileage: new FormControl('', {
        validators: [
          Validators.required,
          Validators.min(0),
          Validators.max(999999)
        ]
      }),
      driverLicense: new FormControl('', {
        validators: [
          Validators.required,
          Validators.minLength(5),
          Validators.maxLength(20),
          Validators.pattern('^[A-Z0-9-]*$')
        ]
      }),
      driverLicenseImage: new FormControl('')
    });

    // Monitor form changes with shorter debounce time
    this.form.valueChanges
      .pipe(
        debounceTime(100),
        distinctUntilChanged()
      )
      .subscribe(() => {
        console.log('Form validity:', this.form.valid);
      });

    // Add status changes monitoring for immediate validation feedback
    this.form.statusChanges
      .pipe(
        distinctUntilChanged()
      )
      .subscribe(status => {
        console.log('Form status:', status);
      });
  }

  async presentImageSourceActionSheet() {
    const actionSheet = await this.actionSheetController.create({
      header: await this.translate.get('DETAILS.PROFILE_INFO.UPLOAD_PHOTO').toPromise() || 'Upload Profile Photo',
      buttons: [
        {
          text: await this.translate.get('DETAILS.BUTTONS.CAMERA').toPromise(),
          icon: 'camera',
          handler: () => {
            this.getImage(CameraSource.Camera);
          }
        },
        {
          text: await this.translate.get('DETAILS.BUTTONS.GALLERY').toPromise(),
          icon: 'images',
          handler: () => {
            this.getImage(CameraSource.Photos);
          }
        },
        {
          text: await this.translate.get('DETAILS.BUTTONS.FILE').toPromise(),
          icon: 'document',
          handler: () => {
            this.getImage(CameraSource.Photos);
          }
        },
        {
          text: await this.translate.get('DETAILS.BUTTONS.CANCEL').toPromise(),
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async getImage(source: CameraSource) {
    const loading = await this.loadingController.create({
      message: await this.translate.get('DETAILS.UPLOAD_STATUS.UPLOADING').toPromise() || 'Uploading image...'
    });

    try {
      console.log('Getting profile photo from camera/gallery...');
      const image = await Camera.getPhoto({
        quality: 70,
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source: source,
        width: 400 // Limit width to reduce size
      });

      if (image.base64String) {
        await loading.present();
        this.isUploading = true;

        console.log('Compressing and storing image...');
        // Store image and get reference with timeout
        const imageReference = await this.withTimeout(
          this.compressImageForFirebase(image, 'profile'),
          30000,
          'Image processing timed out. Please try with a smaller image.'
        );
        this.imageUrl = imageReference;

        console.log('Getting display URL...');
        // Get display URL for immediate preview
        this.imageDisplayUrl = await this.getImageDataUrl(imageReference, 'profile');

        // Trigger change detection for form validation
        this.form.updateValueAndValidity();

        console.log('Profile image stored successfully with reference:', imageReference);

        const successAlert = await this.alertController.create({
          header: await this.translate.get('COMMON.SUCCESS').toPromise() || 'Success',
          message: await this.translate.get('DETAILS.ALERTS.PROFILE_UPLOAD_SUCCESS').toPromise() || 'Profile image uploaded successfully!',
          buttons: ['OK']
        });
        await successAlert.present();
      } else {
        throw new Error('No image data received from camera');
      }
    } catch (error: any) {
      console.error('getImage error:', error);

      let message = 'Upload failed. Please try again.';

      if (error.message?.includes('User cancelled')) {
        // Don't show error for user cancellation
        return;
      } else if (error.message?.includes('Photo URL is required') || error.message?.includes('too big')) {
        message = await this.translate.get('DETAILS.ALERTS.IMAGE_TOO_BIG').toPromise() || 'The image is too big. Please try another image with a smaller size.';
      } else if (error.message?.includes('Permission')) {
        message = 'Camera permission is required. Please enable camera access in your device settings.';
      } else if (error.message?.includes('network') || error.message?.includes('Network')) {
        message = 'Network error. Please check your internet connection and try again.';
      } else {
        message = await this.translate.get('DETAILS.ALERTS.UPLOAD_FAILED').toPromise() || `Upload failed: ${error.message || 'Unknown error'}`;
      }

      const alert = await this.alertController.create({
        header: await this.translate.get('DETAILS.ALERTS.UPLOAD_FAILED').toPromise() || 'Upload Failed',
        message: message,
        buttons: ['OK'],
      });
      await alert.present();
    } finally {
      this.isUploading = false;
      try {
        await loading.dismiss();
      } catch (dismissError) {
        console.warn('Error dismissing loading:', dismissError);
      }
    }
  }

  async updateProfile() {
    if (!this.isFormCompleteForSubmission() || this.isSubmitting) {
      this.markFormGroupTouched(this.form);
      return;
    }

    this.isSubmitting = true;
    let loading = await this.loadingController.create({
      message: await this.translate.get('COMMON.PLEASE_WAIT').toPromise() || 'Please wait...'
    });

    try {
      await loading.present();
      console.log('Starting profile update process...');

      // Validate profile image (accept both uploaded and default images)
      if (!this.imageUrl || (!this.imageUrl.startsWith('img_') && !this.imageUrl.startsWith('assets/'))) {
        throw new Error('Profile photo is required');
      }

      // Validate license image (accept both uploaded and default images)
      const licenseImageUrl = this.form.get('driverLicenseImage')?.value;
      if (!licenseImageUrl || (!licenseImageUrl.startsWith('img_') && !licenseImageUrl.startsWith('assets/'))) {
        throw new Error('Driver license photo is required');
      }

      // Store current user reference
      const currentUser = this.authy.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user found. Please log in again.');
      }

      console.log('Updating Firebase Auth profile...');
      // Update profile (use a local asset for Firebase Auth since we store actual images in Firestore)
      await updateProfile(currentUser, {
        displayName: `${this.form.value.fullname} ${this.form.value.lastname}`,
        photoURL: `assets/imgs/about.svg`,
      });

      const carInfo = {
        plateNumber: this.form.value.plateNumber,
        carType: this.form.value.carType,
        carName: this.form.value.carName,
        mileage: this.form.value.mileage,
      };

      const driverInfo = {
        driverLicense: this.form.value.driverLicense,
        driverLicenseImage: this.form.value.driverLicenseImage,
      };

      console.log('Checking location permissions...');
      const permissionStatus = await Geolocation.checkPermissions();
      console.log('Location permission status:', permissionStatus);

      if (permissionStatus.location !== 'granted') {
        console.log('Requesting location permissions...');
        const requestResult = await Geolocation.requestPermissions();
        if (requestResult.location !== 'granted') {
          throw new Error('Location permission is required to register as a driver. Please enable location access in your device settings.');
        }
      }

      console.log('Getting current location...');
      const coordinates = await this.withTimeout(
        Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 15000
        }),
        20000,
        'Location request timed out. Please ensure GPS is enabled and try again.'
      );
      console.log('Location obtained:', coordinates);

      console.log('Creating driver profile...');
      // Use stored user reference with timeout
      await this.withTimeout(
        this.avatar.createNewDriver(
          coordinates,
          this.form.value.fullname + ' ' + this.form.value.lastname,
          this.form.value.email,
          currentUser.phoneNumber,
          carInfo.carName,
          carInfo.carType,
          carInfo.plateNumber,
          this.imageUrl,
          driverInfo.driverLicenseImage,
          driverInfo.driverLicense,
          carInfo.mileage
        ),
        30000,
        'Driver profile creation timed out. Please check your internet connection and try again.'
      );

      console.log('Creating payment card...');
      await this.withTimeout(
        this.avatar.createCard('Cash', '0', 'cash', 'None'),
        10000,
        'Payment card creation timed out. Please try again.'
      );
      this.approve2 = false;

      console.log('Profile update completed successfully. Navigating to tabs...');
      // Navigate after successful update
      await this.router.navigateByUrl('tabs', { replaceUrl: true });

    } catch (error: any) {
      console.error('Profile update error:', error);

      // Determine specific error message
      let errorMessage = 'An unexpected error occurred. Please try again.';

      if (error.message) {
        errorMessage = error.message;
      } else if (error.code) {
        switch (error.code) {
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection and try again.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many requests. Please wait a moment and try again.';
            break;
          case 'permission-denied':
            errorMessage = 'Permission denied. Please check your account permissions.';
            break;
          case 'unavailable':
            errorMessage = 'Service temporarily unavailable. Please try again later.';
            break;
          default:
            errorMessage = `Error (${error.code}): ${error.message || 'Unknown error occurred'}`;
        }
      }

      // Show detailed error alert
      const alert = await this.alertController.create({
        header: 'Registration Failed',
        message: errorMessage,
        buttons: [
          {
            text: 'OK',
            role: 'cancel'
          },
          {
            text: 'Retry',
            handler: () => {
              // Allow user to retry
              setTimeout(() => {
                this.updateProfile();
              }, 1000);
            }
          }
        ]
      });
      await alert.present();

    } finally {
      this.resetFormState();
      if (loading) {
        try {
          await loading.dismiss();
        } catch (dismissError) {
          console.warn('Error dismissing loading:', dismissError);
        }
      }
    }
  }

  async selectDriverLicenseImage() {
    const actionSheet = await this.actionSheetController.create({
      header: await this.translate.get('DETAILS.LICENSE_INFO.UPLOAD_PHOTO').toPromise(),
      buttons: [
        {
          text: await this.translate.get('DETAILS.BUTTONS.CAMERA').toPromise(),
          icon: 'camera',
          handler: () => {
            this.getLicenseImage(CameraSource.Camera);
          }
        },
        {
          text: await this.translate.get('DETAILS.BUTTONS.GALLERY').toPromise(),
          icon: 'images',
          handler: () => {
            this.getLicenseImage(CameraSource.Photos);
          }
        },
        {
          text: await this.translate.get('DETAILS.BUTTONS.FILE').toPromise(),
          icon: 'document',
          handler: () => {
            this.getLicenseImage(CameraSource.Photos);
          }
        },
        {
          text: await this.translate.get('DETAILS.BUTTONS.CANCEL').toPromise(),
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async getLicenseImage(source: CameraSource) {
    const loading = await this.loadingController.create({
      message: await this.translate.get('DETAILS.UPLOAD_STATUS.UPLOADING').toPromise() || 'Uploading image...'
    });

    try {
      console.log('Getting license photo from camera/gallery...');
      const image = await Camera.getPhoto({
        quality: 70,
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source: source,
        width: 400 // Limit width to reduce size
      });

      if (image.base64String) {
        await loading.present();
        this.isUploadingLicense = true;

        // Store image and get reference
        const imageReference = await this.compressImageForFirebase(image, 'license');
        this.form.patchValue({
          driverLicenseImage: imageReference
        });

        // Get display URL for immediate preview
        this.licenseDisplayUrl = await this.getImageDataUrl(imageReference, 'license');

        // Trigger change detection for form validation
        this.form.updateValueAndValidity();

        console.log('License image stored successfully with reference:', imageReference);

        const successAlert = await this.alertController.create({
          header: await this.translate.get('COMMON.SUCCESS').toPromise() || 'Success',
          message: await this.translate.get('DETAILS.ALERTS.LICENSE_UPLOAD_SUCCESS').toPromise() || 'License image uploaded successfully!',
          buttons: ['OK']
        });
        await successAlert.present();
      }
    } catch (error) {
      console.error('getLicenseImage error:', error);
      const message = error.message?.includes('Photo URL is required')
        ? await this.translate.get('DETAILS.ALERTS.IMAGE_TOO_BIG').toPromise() || 'The image is too big. Please try another image with a smaller size.'
        : await this.translate.get('DETAILS.ALERTS.UPLOAD_FAILED').toPromise() || `Upload failed: ${error.message || 'Unknown error'}`;

      const alert = await this.alertController.create({
        header: await this.translate.get('DETAILS.ALERTS.UPLOAD_FAILED').toPromise() || 'Upload Failed',
        message: message,
        buttons: ['OK'],
      });
      await alert.present();
    } finally {
      this.isUploadingLicense = false;
      await loading.dismiss();
    }
  }

  private async compressImageForFirebase(image: Photo, type: 'profile' | 'license'): Promise<string> {
    try {
      if (!image.base64String) {
        throw new Error('No image data provided');
      }

      if (!this.user?.uid) {
        throw new Error('User not authenticated');
      }

      // Store the full-quality compressed image in Firestore for actual use
      const fullQualityBase64 = await this.compressImage(image.base64String, 0.8, 800, 600);

      // Store full image in Firestore
      const timestamp = Date.now();
      const imageId = `${type}_${timestamp}`;
      const imageDocRef = doc(this.firestore, `drivers/${this.user.uid}/images/${imageId}`);

      await setDoc(imageDocRef, {
        imageData: fullQualityBase64,
        type: type,
        uploadedAt: serverTimestamp(),
        uploadedBy: this.user.uid
      });

      // Return a reference ID that we can use to retrieve the full image
      const imageReference = `img_${this.user.uid}_${imageId}`;

      console.log('Image stored in Firestore with ID:', imageReference);
      console.log('Full quality image size:', fullQualityBase64.length, 'characters');

      return imageReference;
    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    }
  }

  // Method to retrieve actual image data for display
  async getImageDataUrl(imageReference: string, type: 'profile' | 'license' = 'profile'): Promise<string> {
    try {
      // Handle default images
      if (!imageReference || imageReference === 'default_profile') {
        return 'assets/imgs/about.svg';
      }

      if (imageReference === 'default_license') {
        return 'assets/icon/favicon.png';
      }

      if (!imageReference.startsWith('img_')) {
        // Return appropriate default based on type
        return type === 'profile' ? 'assets/imgs/about.svg' : 'assets/icon/favicon.png';
      }

      // Extract user ID and image ID from reference
      const parts = imageReference.split('_');
      if (parts.length < 3) {
        return type === 'profile' ? 'assets/imgs/about.svg' : 'assets/icon/favicon.png';
      }

      const userId = parts[1];
      const imageId = parts.slice(2).join('_');

      // Get image from Firestore
      const imageDocRef = doc(this.firestore, `drivers/${userId}/images/${imageId}`);
      const imageDoc = await getDoc(imageDocRef);

      if (imageDoc.exists()) {
        const data = imageDoc.data();
        return `data:image/jpeg;base64,${data.imageData}`;
      }

      // Return default if image not found
      return type === 'profile' ? 'assets/imgs/about.svg' : 'assets/icon/favicon.png';
    } catch (error) {
      console.error('Error retrieving image:', error);
      // Return default on error
      return type === 'profile' ? 'assets/imgs/about.svg' : 'assets/icon/favicon.png';
    }
  }

  private async compressImage(base64: string, quality: number = 0.7, maxWidth: number = 800, maxHeight: number = 600): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];

        console.log('Image compressed from', base64.length, 'to', compressedBase64.length, 'characters');
        resolve(compressedBase64);
      };

      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = `data:image/jpeg;base64,${base64}`;
    });
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  private getErrorMessage(error: any): string {
    if (error.message) {
      return error.message;
    }

    switch (error.code) {
      case 'auth/requires-recent-login':
        return 'Please re-authenticate to update your email';
      case 'auth/email-already-in-use':
        return 'This email is already registered';
      case 'auth/invalid-email':
        return 'Please enter a valid email address';
      case 'auth/operation-not-allowed':
        return 'Email verification is required before changing email';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection.';
      case 'auth/too-many-requests':
        return 'Too many requests. Please wait and try again.';
      case 'permission-denied':
        return 'Permission denied. Please check your account permissions.';
      case 'unavailable':
        return 'Service temporarily unavailable. Please try again later.';
      case 'failed-precondition':
        return 'Database operation failed. Please try again.';
      default:
        return error.toString() || 'An unexpected error occurred';
    }
  }

  ngOnDestroy() {
    // Unsubscribe from document subscriptions
    this.documentSubscriptions.forEach(sub => sub.unsubscribe());
    if (this.requiredDocsUnsubscribe) {
      this.requiredDocsUnsubscribe();
    }
    if (this.driverDocsUnsubscribe) {
      this.driverDocsUnsubscribe();
    }
  }

  // ==================== DOCUMENT MANAGEMENT METHODS ====================

  /**
   * Subscribe to both required documents and driver's submitted documents
   */
  private subscribeToDocuments() {
    if (!this.user?.uid) {
      console.log('No user authenticated, cannot subscribe to documents');
      return;
    }

    // Subscribe to required documents from Documents collection
    const requiredDocsRef = collection(this.firestore, 'Documents');
    this.requiredDocsUnsubscribe = onSnapshot(requiredDocsRef, (snapshot) => {
      this.requiredDocuments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RequiredDocument));
      console.log('Required documents loaded:', this.requiredDocuments);
    }, (error) => {
      console.error('Error fetching required documents:', error);
    });

    // Subscribe to driver's submitted documents
    const driverDocsRef = collection(this.firestore, `Drivers/${this.user.uid}/Documents`);
    this.driverDocsUnsubscribe = onSnapshot(driverDocsRef, (snapshot) => {
      this.driverDocuments.clear();
      snapshot.docs.forEach(doc => {
        const data = doc.data() as DriverDocument;
        this.driverDocuments.set(doc.id, {
          id: doc.id,
          ...data
        });
      });
      console.log('Driver documents loaded:', this.driverDocuments);
    }, (error) => {
      console.error('Error fetching driver documents:', error);
    });
  }

  /**
   * Get the submission status for a required document (returns translation key)
   */
  getDocumentStatus(docId: string): string {
    const submission = this.driverDocuments.get(docId);
    if (!submission) {
      return 'DETAILS.DOCUMENTS.STATUS.NOT_SUBMITTED';
    }
    // Map status to translation key
    switch (submission.status) {
      case 'Approved':
        return 'DETAILS.DOCUMENTS.STATUS.APPROVED';
      case 'Pending':
        return 'DETAILS.DOCUMENTS.STATUS.PENDING';
      case 'Rejected':
        return 'DETAILS.DOCUMENTS.STATUS.REJECTED';
      default:
        return 'DETAILS.DOCUMENTS.STATUS.NOT_SUBMITTED';
    }
  }

  /**
   * Get raw status value (for color logic)
   */
  private getRawDocumentStatus(docId: string): string {
    const submission = this.driverDocuments.get(docId);
    return submission?.status || 'Not Submitted';
  }

  /**
   * Check if document is approved (used to disable editing)
   */
  isDocumentApproved(docId: string): boolean {
    const submission = this.driverDocuments.get(docId);
    return submission?.status === 'Approved';
  }

  /**
   * Get the status color for display
   */
  getStatusColor(docId: string): string {
    const status = this.getRawDocumentStatus(docId);
    switch (status) {
      case 'Approved':
        return 'success';
      case 'Pending':
        return 'warning';
      case 'Rejected':
        return 'danger';
      default:
        return 'medium';
    }
  }

  /**
   * Check if document has been submitted
   */
  isDocumentSubmitted(docId: string): boolean {
    return this.driverDocuments.has(docId);
  }

  /**
   * Get the submitted value for a document
   */
  getSubmittedValue(docId: string): string {
    const submission = this.driverDocuments.get(docId);
    return submission?.value || '';
  }

  /**
   * Handle document action (upload/edit) based on type
   */
  async handleDocumentAction(requiredDoc: RequiredDocument) {
    switch (requiredDoc.type) {
      case 'text':
        await this.showTextInputDialog(requiredDoc);
        break;
      case 'image':
        await this.showImageUploadOptions(requiredDoc);
        break;
      case 'pdf':
        await this.uploadPdfDocument(requiredDoc);
        break;
      default:
        console.error('Unknown document type:', requiredDoc.type);
    }
  }

  /**
   * Show text input dialog for text documents
   */
  async showTextInputDialog(requiredDoc: RequiredDocument) {
    const currentValue = this.getSubmittedValue(requiredDoc.id);
    
    const alert = await this.alertController.create({
      header: requiredDoc.name,
      message: requiredDoc.description || 'Please enter the required information.',
      inputs: [
        {
          name: 'textValue',
          type: 'textarea',
          placeholder: requiredDoc.content || 'Enter text here...',
          value: currentValue,
          attributes: {
            rows: 4
          }
        }
      ],
      buttons: [
        {
          text: await this.translate.get('DETAILS.BUTTONS.CANCEL').toPromise() || 'Cancel',
          role: 'cancel'
        },
        {
          text: await this.translate.get('DETAILS.BUTTONS.SUBMIT').toPromise() || 'Submit',
          handler: async (data) => {
            if (data.textValue && data.textValue.trim()) {
              await this.saveDocument(requiredDoc, data.textValue.trim());
            } else {
              this.showErrorAlert('Please enter the required text.');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Show image upload options (camera/gallery)
   */
  async showImageUploadOptions(requiredDoc: RequiredDocument) {
    const actionSheet = await this.actionSheetController.create({
      header: requiredDoc.name,
      subHeader: requiredDoc.description,
      buttons: [
        {
          text: await this.translate.get('DETAILS.BUTTONS.CAMERA').toPromise() || 'Take Photo',
          icon: 'camera',
          handler: () => {
            this.captureDocumentImage(requiredDoc, CameraSource.Camera);
          }
        },
        {
          text: await this.translate.get('DETAILS.BUTTONS.GALLERY').toPromise() || 'Choose from Gallery',
          icon: 'images',
          handler: () => {
            this.captureDocumentImage(requiredDoc, CameraSource.Photos);
          }
        },
        {
          text: await this.translate.get('DETAILS.BUTTONS.CANCEL').toPromise() || 'Cancel',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  /**
   * Capture and upload document image
   */
  async captureDocumentImage(requiredDoc: RequiredDocument, source: CameraSource) {
    const loading = await this.loadingController.create({
      message: await this.translate.get('DETAILS.UPLOAD_STATUS.UPLOADING').toPromise() || 'Uploading...'
    });

    try {
      this.uploadingDocumentId = requiredDoc.id;
      
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: source,
        width: 1200
      });

      if (!image.base64String) {
        throw new Error('No image data received');
      }

      await loading.present();

      // Upload to Firebase Storage
      const timestamp = Date.now();
      const fileName = `documents/${this.user.uid}/${requiredDoc.id}_${timestamp}.jpg`;
      const storageRef = ref(this.storage, fileName);

      await uploadString(storageRef, image.base64String, 'base64', {
        contentType: 'image/jpeg'
      });

      const downloadUrl = await getDownloadURL(storageRef);

      // Save document reference to Firestore
      await this.saveDocument(requiredDoc, downloadUrl);

      const successAlert = await this.alertController.create({
        header: await this.translate.get('COMMON.SUCCESS').toPromise() || 'Success',
        message: `${requiredDoc.name} uploaded successfully!`,
        buttons: ['OK']
      });
      await successAlert.present();

    } catch (error: any) {
      console.error('Error uploading document image:', error);
      
      if (!error.message?.includes('User cancelled')) {
        await this.showErrorAlert(
          error.message || 'Failed to upload image. Please try again.'
        );
      }
    } finally {
      this.uploadingDocumentId = null;
      await loading.dismiss().catch(() => {});
    }
  }

  /**
   * Upload PDF document using file input
   */
  async uploadPdfDocument(requiredDoc: RequiredDocument) {
    // Create a hidden file input for PDF selection
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/pdf';
    
    fileInput.onchange = async (event: any) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        await this.showErrorAlert('File size must be less than 10MB.');
        return;
      }

      const loading = await this.loadingController.create({
        message: await this.translate.get('DETAILS.UPLOAD_STATUS.UPLOADING').toPromise() || 'Uploading...'
      });

      try {
        this.uploadingDocumentId = requiredDoc.id;
        await loading.present();

        // Convert file to base64
        const base64 = await this.fileToBase64(file);
        
        // Upload to Firebase Storage
        const timestamp = Date.now();
        const fileName = `documents/${this.user.uid}/${requiredDoc.id}_${timestamp}.pdf`;
        const storageRef = ref(this.storage, fileName);

        await uploadString(storageRef, base64.split(',')[1], 'base64', {
          contentType: 'application/pdf'
        });

        const downloadUrl = await getDownloadURL(storageRef);

        // Save document reference to Firestore
        await this.saveDocument(requiredDoc, downloadUrl);

        const successAlert = await this.alertController.create({
          header: await this.translate.get('COMMON.SUCCESS').toPromise() || 'Success',
          message: `${requiredDoc.name} uploaded successfully!`,
          buttons: ['OK']
        });
        await successAlert.present();

      } catch (error: any) {
        console.error('Error uploading PDF:', error);
        await this.showErrorAlert(
          error.message || 'Failed to upload PDF. Please try again.'
        );
      } finally {
        this.uploadingDocumentId = null;
        await loading.dismiss().catch(() => {});
      }
    };

    fileInput.click();
  }

  /**
   * Convert file to base64 string
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  /**
   * Save document submission to Firestore
   */
  async saveDocument(requiredDoc: RequiredDocument, value: string) {
    if (!this.user?.uid) {
      throw new Error('User not authenticated');
    }

    const documentData: DriverDocument = {
      name: requiredDoc.name,
      type: requiredDoc.type,
      value: value,
      date: serverTimestamp(),
      status: 'Pending'
    };

    const docRef = doc(this.firestore, `Drivers/${this.user.uid}/Documents/${requiredDoc.id}`);
    await setDoc(docRef, documentData);

    console.log(`Document ${requiredDoc.name} saved successfully`);
  }

  /**
   * Show error alert helper
   */
  private async showErrorAlert(message: string) {
    const alert = await this.alertController.create({
      header: await this.translate.get('COMMON.ERROR').toPromise() || 'Error',
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }

  /**
   * View submitted document (for images and PDFs)
   */
  async viewDocument(docId: string) {
    const submission = this.driverDocuments.get(docId);
    if (!submission || submission.type === 'text') return;

    // Open URL in browser or show in modal
    if (submission.value) {
      window.open(submission.value, '_blank');
    }
  }
}