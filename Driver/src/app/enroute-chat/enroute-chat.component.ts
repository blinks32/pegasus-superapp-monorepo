// src/app/components/enroute-chat/enroute-chat.component.ts

import { Component, OnInit, ViewChild, Input, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { StatusBar } from '@capacitor/status-bar';
import { IonContent } from '@ionic/angular';
import { Observable, Subscription } from 'rxjs';
import { AvatarService } from 'src/app/services/avatar.service';
import { TranslateService } from '@ngx-translate/core';
import { tap, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-enroute-chat',
  templateUrl: './enroute-chat.component.html',
  styleUrls: ['./enroute-chat.component.scss'],
})
export class EnrouteChatComponent implements OnInit, OnDestroy {

  @ViewChild(IonContent, { static: false }) content: IonContent;
  @Input() chatData: any;
 
  newMsg = '';
  messages: Observable<import("@angular/fire/firestore").DocumentData[]>;
  hasNoData = false;
  isLoading = true;
  currentLanguage: string = 'en';
  private messageSubscription: Subscription;
  isTyping = false;

  constructor(
    private chatService: AvatarService, 
    private router: Router,
    private translate: TranslateService
  ) {
    this.currentLanguage = this.translate.currentLang || 'en';
  }
 
  ngOnInit() {
    console.log('Chat initialized with:', this.chatData);
    this.loadMessages();
  }

  ngOnDestroy() {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
  }
  
  loadMessages() {
    if (!this.chatData?.userId) {
      console.error('No userId provided to load messages');
      this.hasNoData = true;
      this.isLoading = false;
      return;
    }
    
    this.isLoading = true;
    this.messages = this.chatService.getChatMessage(this.chatData.userId);
    
    this.messageSubscription = this.messages.pipe(
      tap(messages => {
        if (messages.length === 0) {
          this.hasNoData = true;
        } else {
          this.hasNoData = false;
          setTimeout(() => this.scrollToBottom(), 300);
        }
      }),
      finalize(() => this.isLoading = false)
    ).subscribe();
  }

  async scrollToBottom() {
    try {
      await this.content.scrollToBottom(300);
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  async Show() {
    await StatusBar.setOverlaysWebView({ overlay: false });
  }

  async Hide() {
    await StatusBar.setOverlaysWebView({ overlay: true });
  }
 
  async sendMessage() {
    if (!this.newMsg.trim()) return;
    
    try {
      this.isTyping = true;
      await this.chatService.addChatEnRouteMessage(this.newMsg.trim(), this.chatData.userId);
      this.newMsg = '';
      await this.scrollToBottom();
      await this.chatService.updatChatMessageInfo(this.chatData.userId);
    } catch (error) {
      console.error('Error sending message:', error);
      // You could add a toast notification here for error feedback
    } finally {
      this.isTyping = false;
    }
  }

  setLanguage(lang: string) {
    this.currentLanguage = lang;
    this.translate.use(lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('preferred_language', lang);
  }

  closeChat() {
    this.router.navigate(['/home']);
  }
  
  formatTime(timestamp: any): string {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than 24 hours, show time only
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // More than 24 hours, show date and time
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
           ' ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
