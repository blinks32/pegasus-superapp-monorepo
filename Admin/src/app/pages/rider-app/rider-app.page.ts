import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-rider-app',
  templateUrl: './rider-app.page.html',
  styleUrls: ['./rider-app.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class RiderAppPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
