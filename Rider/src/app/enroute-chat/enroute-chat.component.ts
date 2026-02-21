import { Component, OnInit, ViewChild, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, IonContent } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { StatusBar } from '@capacitor/status-bar';
import { AvatarService } from 'src/app/services/avatar.service';

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
  loading: boolean = true;

  constructor(private chatService: AvatarService, private router: Router, private modalCtrl: ModalController) { }

  async ionViewDidEnter() {
    this.skeletOns = [
      {}, {}, {}, {}
    ]
    this.hideSkeleton = true;
    this.messages = this.chatService.getChatMessage(this.chatData.userId);
    this.messages.subscribe((d) => {
      this.loading = false;
      if (d.length == 0) {
        this.hasNoData = true;
        this.hideSkeleton = false;
      } else {
        this.hideSkeleton = false;
        this.hasNoData = false;
        this.content.scrollToBottom();
      }
    });
  }

  async Show() {
    await StatusBar.setOverlaysWebView({ overlay: false });
  }

  async Hide() {
    await StatusBar.setOverlaysWebView({ overlay: true });
  }

  ngOnInit() {
    // Use the passed data if needed
    console.log(this.chatData);
  }

  async sendMessage() {
    await this.chatService.addChatEnRouteMessage(this.newMsg, this.chatData.userId);
    this.newMsg = '';
    this.content.scrollToBottom();
    this.chatService.updatChatMessageInfo(this.chatData.userId);
  }

  closeChat() {
    this.modalCtrl.dismiss();
  }
}
