// src/app/components/enroute-chat/enroute-chat.component.ts

import { Component, OnInit, ViewChild, Input } from '@angular/core';
import { Router } from '@angular/router';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { IonContent } from '@ionic/angular';
import { Observable } from 'rxjs';
import { AvatarService } from 'src/app/services/avatar.service';

import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-enroute-chat',
  templateUrl: './enroute-chat.component.html',
  styleUrls: ['./enroute-chat.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class EnrouteChatComponent implements OnInit {

  @ViewChild(IonContent) content: IonContent;
  @Input() chatData: any;  // Define an input property to receive data

  newMsg = '';
  messages: Observable<import("@angular/fire/firestore").DocumentData[]>;
  hasNoData: any;
  skeletOns: {}[];
  hideSkeleton: boolean;

  constructor(private chatService: AvatarService, private router: Router) { }

  async ionViewDidEnter() {
    this.skeletOns = [
      {}, {}, {}, {}
    ]
    this.hideSkeleton = true;
    this.messages = this.chatService.getMessage(this.chatData.userId);
    this.messages.subscribe((d) => {
      if (d.length == 0) {
        this.hasNoData = true;
        this.hideSkeleton = false;
      } else {
        this.hideSkeleton = false;
        this.hasNoData = false;
      }
    });
  }

  async Show() {
    if (Capacitor.isNativePlatform()) {
      await StatusBar.setOverlaysWebView({ overlay: false });
    }
  }

  async Hide() {
    if (Capacitor.isNativePlatform()) {
      await StatusBar.setOverlaysWebView({ overlay: true });
    }
  }

  ngOnInit() {
    // Use the passed data if needed
    console.log(this.chatData);
  }

  async sendMessage() {
    await this.chatService.addChatMessage(this.newMsg, this.chatData.userId);
    this.newMsg = '';
    this.content.scrollToBottom();
    this.chatService.updateMessageInfo(this.chatData.userId);
  }
}
