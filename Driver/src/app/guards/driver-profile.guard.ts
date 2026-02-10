import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { from, Observable, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { AvatarService } from '../services/avatar.service';

@Injectable({
  providedIn: 'root',
})
export class DriverProfileGuard implements CanActivate {
  constructor(
    private auth: Auth,
    private router: Router,
    private avatar: AvatarService
  ) {}

  canActivate(): Observable<boolean> {
    return from(new Promise<User | null>((resolve) => {
      onAuthStateChanged(this.auth, (user) => {
        resolve(user);
      });
    })).pipe(
      switchMap((user) => {
        if (!user) {
          this.router.navigate(['login']);
          return of(false);
        }
        
        // Check if driver document exists in database
        return from(this.avatar.checkDriverExistsByUid(user.uid)).pipe(
          switchMap((driverData) => {
            if (!driverData) {
              // No driver document - redirect to details for account setup
              console.log('No driver document found, redirecting to details');
              this.router.navigate(['details']);
              return of(false);
            }
            // Driver document exists - allow access
            return of(true);
          }),
          catchError((error) => {
            console.error('Error checking driver document:', error);
            this.router.navigate(['details']);
            return of(false);
          })
        );
      }),
      catchError(() => {
        this.router.navigate(['network']);
        return of(false);
      })
    );
  }
}
