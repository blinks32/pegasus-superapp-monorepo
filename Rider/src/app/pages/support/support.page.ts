import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { StatusBar } from '@capacitor/status-bar';
import { IonContent } from '@ionic/angular';
import { Observable, Subscription } from 'rxjs';
import { AvatarService } from 'src/app/services/avatar.service';
import { TranslateService } from '@ngx-translate/core';
import { Auth } from '@angular/fire/auth';
import { authState } from 'rxfire/auth';

@Component({
  selector: 'app-support',
  templateUrl: './support.page.html',
  styleUrls: ['./support.page.scss'],
})
export class SupportPage implements OnInit, OnDestroy {

  @ViewChild(IonContent) content: IonContent;
 
  newMsg = '';
  messages: Observable<import("@angular/fire/firestore").DocumentData[]>;
  hasNoData: boolean = false;
  skeletOns: Array<{}> = [{}, {}, {}, {}];
  hideSkeleton: boolean = false;
  loading = true;
  private messageSubscription: Subscription;

  constructor(
    private chatService: AvatarService,
    private router: Router,
    private translate: TranslateService,
    private auth: Auth
  ) { }
 
  ngOnInit() {
    // Check authentication status
    authState(this.auth).subscribe((user) => {
      if (user) {
        this.initializeChat();
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  private initializeChat() {
    this.hideSkeleton = true;
    this.loading = true;
    this.messages = this.chatService.getMessage();
    
    // Store subscription for cleanup
    this.messageSubscription = this.messages.subscribe({
      next: (messages) => {
        this.loading = false;
        this.hideSkeleton = false;
        this.hasNoData = messages.length === 0; 
        if(messages.length > 0){
          requestAnimationFrame(() => this.content.scrollToBottom(300));
        
        }

      },
      error: (error) => {
        console.error('Error loading messages:', error);
        this.loading = false;
        this.hideSkeleton = false;
        this.hasNoData = true;
        
        // Handle permission error specifically
        if (error.code === 'permission-denied') {
          // You might want to show a user-friendly message or redirect
          this.router.navigate(['/error'], { 
            queryParams: { 
              message: 'You do not have permission to access this chat.' 
            }
          });
        }
      }
    });
  }

  async Show(){
    await StatusBar.setOverlaysWebView({ overlay: false });
   
  }

  async Hide(){
    await StatusBar.setOverlaysWebView({ overlay: true });
   
  }

  async sendMessage() {
    if (this.newMsg.trim()) {
      try {
        await this.chatService.addChatMessage(this.newMsg);
        this.newMsg = '';
        this.content.scrollToBottom();
        await this.chatService.updateMessageInfo();
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  }
 
  changeLanguage(lang: string) {
    this.translate.use(lang);
  }

  ngOnDestroy() {
    // Cleanup subscriptions
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
  }
}
