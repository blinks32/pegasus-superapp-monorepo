import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusBar } from '@capacitor/status-bar';
import { Client } from '@googlemaps/google-maps-services-js';
import { IonicModule, ModalController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { environment } from 'src/environments/environment';
import { AvatarService } from '../services/avatar.service';
import { HttpClient } from '@angular/common/http';
declare let google;



@Component({
  selector: 'app-autocomplete',
  templateUrl: './autocomplete.component.html',
  styleUrls: ['./autocomplete.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class AutocompleteComponent implements OnInit {
  @Input() LatLng;
  @Input() locationAddress;
  autocompleteItems;
  service = new google.maps.places.AutocompleteService();
  autocomplete: { query2: any; query: any; };
  data: any[];
  autocompleteItems2: any[];
  skeleton: boolean = true;
  skeletOns: any[];
  hideImage: boolean;
  countryCode: any = 'NG';
  editedPickupLocation: any = null;
  constructor(private modalCtrl: ModalController, private http: HttpClient, private avatar: AvatarService, private viewCtrl: ModalController, private client: Client) {
    this.autocompleteItems = [];
    this.autocompleteItems2 = [];
  }

  ngOnInit() {

    this.http.get("https://ipinfo.io").subscribe((res: any) => {

      console.log('res ', res);


      this.countryCode = res.country || 'NG';

    })

    this.skeletOns = [
      {}, {}, {}, {}
    ]
    this.autocomplete = {
      query2: this.locationAddress,
      query: "",
    };
    console.log(this.locationAddress);
  }

  closeModal() {
    let data = {
      home: true
    }
    this.modalCtrl.dismiss(data)
  }

  closeSearch() {

  }


  async Show() {
    await StatusBar.setOverlaysWebView({ overlay: false });

    this.hideImage = true;
  }

  async Hide() {
    await StatusBar.setOverlaysWebView({ overlay: true });

    this.hideImage = false;
  }

  async updateSearch2() {

    if (this.autocomplete.query2 == "") {
      this.autocompleteItems2 = [];
      return;
    }
    console.log(this.autocomplete.query2, this.LatLng)

    var place = new google.maps.LatLng(this.LatLng.lat, this.LatLng.lng);

    this.skeleton = false;

    this.service.getPlacePredictions(
      {
        input: this.autocomplete.query2,
        location: place,
        strictbounds: true,
        radius: "2000",
        zoom: 15,
        types: ["geocode"],
        componentRestrictions: { country: [this.countryCode] },
      },
      (predictions, status) => {
        this.autocompleteItems2 = [];
        console.log(predictions, status);

        this.skeleton = true;

        if (predictions != null)
          predictions.forEach((prediction) => {
            this.autocompleteItems2.push({
              whole: prediction,
              full: prediction.description,
              place: prediction.structured_formatting.main_text,
              city: prediction.structured_formatting.secondary_text,
              searching: true
            });
          });
      });
  }


  async updateSearch() {

    if (this.autocomplete.query == "") {
      this.autocompleteItems = [];
      return;
    }
    console.log(this.autocomplete.query, this.LatLng)

    var place = new google.maps.LatLng(this.LatLng.lat, this.LatLng.lng);

    this.skeleton = false;

    this.service.getPlacePredictions(
      {
        input: this.autocomplete.query,
        location: place,
        strictbounds: true,
        radius: "2000",
        zoom: 15,
        types: ["geocode"],
        componentRestrictions: { country: [this.countryCode] },
      },
      (predictions, status) => {
        this.autocompleteItems = [];
        console.log(predictions, status);

        this.skeleton = true;

        if (predictions != null)
          predictions.forEach((prediction) => {
            this.autocompleteItems.push({
              whole: prediction,
              full: prediction.description,
              place: prediction.structured_formatting.main_text,
              city: prediction.structured_formatting.secondary_text,
              searching: true
            });
          });
      });
  }



  async chooseItem(item: any) {
    // Include edited pickup location if user changed it
    if (this.editedPickupLocation) {
      item.editedPickup = this.editedPickupLocation;
    }
    await this.viewCtrl.dismiss(item);
    console.log(item);
  }


  async chooseOnMap() {
    let data = {
      pinOnMap: true
    }
    await this.viewCtrl.dismiss(data);
  }

  async chooseItem2(item: any) {
    this.autocomplete.query2 = item.full;
    this.autocompleteItems2 = []; // Clear pickup suggestions

    try {
      const results = await this.client
        .geocode({
          params: {
            address: item.full,
            key: environment.apiKey,
          },
          timeout: 5000, // milliseconds
        });
      console.log(results);

      if (results.data && results.data.results && results.data.results.length > 0) {
        const position = results.data.results[0].geometry.location;
        this.editedPickupLocation = {
          location: item.full,
          lat: position.lat,
          lng: position.lng,
          edited: true,
        };
        console.log('Edited pickup location:', this.editedPickupLocation);
      }
    } catch (error) {
      console.error('Error geocoding pickup location:', error);
    }
  }

}

