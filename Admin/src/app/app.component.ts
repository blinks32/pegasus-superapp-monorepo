import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AvatarService } from './services/avatar.service';
import { AuthService } from './services/auth.service';
import { AlertController, Platform, MenuController } from '@ionic/angular';
import { filter } from 'rxjs/operators';
import { NavigationEnd } from '@angular/router';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit {
  public appPages = [
    { title: 'Dashboard', url: '/home', icon: 'home', color: 'primary' },
    { title: 'All Trips', url: '/history', icon: 'cellular', color: 'primary' },
    { title: 'Drivers', url: '/drivers', icon: 'car', color: 'primary' },
    { title: 'Riders', url: '/customers', icon: 'person', color: 'primary' },
    { title: 'Car Types', url: '/cartypes', icon: 'car-sport', color: 'primary' },
    { title: 'Prices', url: '/prices', icon: 'cash', color: 'primary' },
    { title: 'Documents', url: '/documents', icon: 'document-text', color: 'primary' },
    { title: 'Live Support', url: '/support', icon: 'chatbubbles', color: 'primary' },
    { title: 'Payout', url: '/payout', icon: 'wallet', color: 'primary' },
    { title: 'General Settings', url: '/general-settings', icon: 'settings', color: 'primary' },
    // { title: 'Rider App', url: '/rider-app', icon: 'phone-portrait', color: 'primary' },
    // { title: 'Driver App', url: '/driver-app', icon: 'phone-landscape', color: 'primary' },
  ];

  isMenuCollapsed = false;
  isMobile = false;
  menuEnabled = false;

  constructor(
    public avatar: AvatarService,
    public router: Router,
    private authService: AuthService,
    private alertController: AlertController,
    private platform: Platform,
    private menuCtrl: MenuController,
    private auth: Auth
  ) {
    this.isMobile = this.platform.is('mobile');
  }

  ngOnInit() {
    // Check initial route for menu visibility
    this.checkMenuVisibility();
    
    // Handle initial navigation based on auth state
    this.auth.onAuthStateChanged((user) => {
      if (!user) {
        this.router.navigate(['/login']);
      } else {
        // Check if we're at root route and redirect to home if authenticated
        if (this.router.url === '/') {
          this.router.navigate(['/home']);
        }
      }
    });

    // Handle menu visibility based on route data
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Get the activated route
      let route = this.router.routerState.root;
      while (route.firstChild) {
        route = route.firstChild;
      }
      
      // Check if menu should be enabled for this route
      this.menuEnabled = route.snapshot.data?.['menuEnabled'] ?? false;
      
      console.log('Route changed:', event.url, 'Menu enabled:', this.menuEnabled);
      
      // If we're at the root route, redirect to login
      if (this.router.url === '/') {
        this.router.navigate(['/login']);
      }
    });
  }

  async toggleMenu() {
    this.isMenuCollapsed = !this.isMenuCollapsed;
    const menus = await this.menuCtrl.getMenus();
    menus[0]?.classList.toggle('menu-collapsed', this.isMenuCollapsed);
  }

  gotoProfile() {
    this.router.navigateByUrl('/profile');
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Logout',
          handler: () => {
            this.performLogout();
          }
        }
      ]
    });

    await alert.present();
  }

  private async performLogout() {
    try {
      await this.authService.logout();
      // The router navigation is now handled in the AuthService
    } catch (error) {
      console.error('Logout failed:', error);
      // Handle logout error (e.g., show an error message to the user)
    }
  }

  private checkMenuVisibility() {
    // Get the activated route
    let route = this.router.routerState.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    
    // Check if menu should be enabled for this route
    this.menuEnabled = route.snapshot.data?.['menuEnabled'] ?? false;
    console.log('Initial route check:', this.router.url, 'Menu enabled:', this.menuEnabled);
  }
}
