import { Component, Input, OnInit } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AvatarService } from '../services/avatar.service';
import { OverlayService } from '../services/overlay.service';

@Component({
  selector: 'app-rider',
  templateUrl: './rider.component.html',
  styleUrls: ['./rider.component.scss'],
})
export class RiderComponent implements OnInit {

  @Input() info;
  form: FormGroup;
  coordinates: any;
  approve2: boolean;
  selected: any = 'Select Car Type';
  cartypes: import("@angular/fire/firestore").DocumentData[];
  currentcar: any;
  imageURl: any = '';
  licenseURl: any ='';
  licenseImage: any = '';
  profileImage: any = '';
  images: any[];
  texts: any[];
  signedIn: boolean = true;
  subscription: Subscription;
  subscription2: Subscription;
  docs: import("@angular/fire/firestore").DocumentData[];
  value: any;
  addDocs: import("@angular/fire/firestore").DocumentData[];
  docus: any;
  constructor(
    private overlay: OverlayService, public modalCtrl: ModalController, private authy: Auth, private auth: AuthService, private avatar: AvatarService, private router: Router
  ) { 

 }

  ngOnInit() {
    this.images = [];
    this.texts = []

     this.subscription = this.avatar.getCartypes().subscribe((d)=>{
      console.log(d);
      this.cartypes = d
      this.subscription.unsubscribe();
     })

     this.subscription2 = this.avatar.getDocuments().subscribe((d)=>{
      console.log(d);
      this.docs = d
      this.subscription2.unsubscribe();
     })

     this.avatar.getDocs().subscribe((d)=>{
      console.log(d);
      this.addDocs = d
 })

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
      password: new FormControl(null, {
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(200)]
      }),
      car: new FormControl(null, {
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(200)]
      }),
      phone: new FormControl(null, {
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(200)]
      }),
      plate: new FormControl(null, {
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(200)]
      }),
    });
  }
  
  async chooseCarType(even){
    console.log(even.detail.value);
      this.currentcar = even.detail.value.name
  }


  closeModal(){
    this.modalCtrl.dismiss();
  }

  async changeImage(g) {
    try{
    const image = await Camera.getPhoto({
      quality: 20,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos, // Camera, Photos or Prompt!
    });
 
    for (let index = 0; index < this.docs.length; index++) {
      const element = this.docs[index];
      console.log(element);
      if (element.name == g.name){
      console.log(element);
      this.docs[index].image = image.dataUrl;
      this.overlay.showLoader('');
      const bol = await this.avatar.createDocument(g.name, g.type, g.id, image.dataUrl, '');
      console.log(bol)
      this.overlay.hideLoader()
      } 
    }

  }catch(e){
    this.overlay.showAlert('Error', e)
  }
 
  }





  async changeProfile() {
    try{
    const image = await Camera.getPhoto({
      quality: 20,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos, // Camera, Photos or Prompt!
    });
    this.imageURl = image.dataUrl

  }catch(e){
    this.overlay.showAlert('Error', e)
  }
 
  }

  async chooseText(e, value) {
    await this.avatar.createDocument(e.name, e.type, e.id, '', value.detail);
  }


  async createUser() {
    this.approve2 = true;
    try {
      const user = await this.auth.signInWithEmailAndPassword(this.form.value.email, this.form.value.password);
      this.signedIn = false;
      console.log('User signed in:', user);
      // Handle successful sign-in (e.g., navigate to a new page)
    } catch (error) {
      console.error('Sign-in error:', error);
      // Handle the error (e.g., show an alert to the user)
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        // Show an alert or message for invalid credentials
        // For example:
        // this.showAlert('Invalid credentials', 'Please check your email and password and try again.');
      } else {
        // Show a generic error message
        // this.showAlert('Error', 'An unexpected error occurred. Please try again later.');
      }
    } finally {
      this.approve2 = false;
    }
  }

async EditNow(){
  this.approve2 = true
   this.approve2 = false;
  this.modalCtrl.dismiss();
}

  async signIn() {
    try {
        this.approve2 = true
        await this.avatar.createUser(this.form.value.fullname + '' + this.form.value.lastname, this.form.value.email, this.imageURl, this.form.value.phone, this.authy.currentUser.uid)
        this.approve2 = false;
        this.modalCtrl.dismiss();
        // this.router.navigateByUrl('waiting');
       
    } catch(e) {
      this.overlay.showAlert('Error', e)
    }
  }




}
