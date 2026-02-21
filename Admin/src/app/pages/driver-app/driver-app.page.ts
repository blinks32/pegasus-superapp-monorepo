import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-driver-app',
  templateUrl: './driver-app.page.html',
  styleUrls: ['./driver-app.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class DriverAppPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
