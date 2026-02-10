import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { from, Observable, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { AvatarService } from '../services/avatar.service';

@Injectable({
  providedIn: 'root',
})
export class AdminAuthGuard implements CanActivate {
  constructor(
    private auth: Auth,
    private router: Router,
    private avatar: AvatarService
  ) {}

  canActivate(): Observable<boolean> {
    console.log('AdminAuthGuard: Checking auth state');
    return from(new Promise<User | null>((resolve) => {
      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        console.log('AdminAuthGuard: Auth state changed, user:', user);
        unsubscribe(); // Important: unsubscribe to prevent memory leaks
        resolve(user);
      });
    })).pipe(
      switchMap((user) => {
        if (!user) {
          console.log('AdminAuthGuard: User not authenticated, redirecting to login.');
          this.router.navigate(['login']);
          return of(false);
        }
        
        console.log('AdminAuthGuard: Authenticated user found:', user.uid);
        return this.avatar.getUserProfile(user).pipe(
          map((profile) => {
            console.log('AdminAuthGuard: User profile:', profile);
            
            if (profile && profile.Access) {
              console.log('AdminAuthGuard: User has admin access, allowing.');
              return true;
            } else {
              console.log('AdminAuthGuard: User profile incomplete, redirecting to details.');
              this.router.navigate(['details']);
              return false;
            }
          }),
          catchError((error) => {
            console.error('AdminAuthGuard: Error fetching user profile:', error);
            this.router.navigate(['login']);
            return of(false);
          })
        );
      })
    );
  }
}