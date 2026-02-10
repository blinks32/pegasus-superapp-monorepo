import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AvatarService } from '../services/avatar.service';
import { AuthService } from '../services/auth.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-waiting',
  templateUrl: './waiting.page.html',
  styleUrls: ['./waiting.page.scss'],
})
export class WaitingPage implements OnInit {
  profile: any;

  constructor(
    private router: Router,
    private avatarService: AvatarService,
    private authService: AuthService,
    private translate: TranslateService
  ) {}

  ngOnInit() {
    this.checkApprovalStatus();
  }

  private checkApprovalStatus() {
    if (this.authService.currentUser) {
      this.avatarService.getUserProfile(this.authService.currentUser).subscribe(
        (profile) => {
          if (profile?.isApproved === true) {
            this.router.navigateByUrl('/tabs', { replaceUrl: true });
          } else if (profile?.isApproved === false) {
            this.router.navigateByUrl('/rejected', { replaceUrl: true });
          }
        }
      );
    }
  }

  async logout() {
    await this.authService.logout();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
