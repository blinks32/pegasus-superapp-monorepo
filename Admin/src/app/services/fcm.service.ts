import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment';

interface FcmPayload {
  to: string;
  notification: {
    title: string;
    body: string;
  };
  data: Record<string, unknown>;
  priority: 'high' | 'normal';
}

@Injectable({ providedIn: 'root' })
export class FcmService {
  private readonly legacyEndpoint = 'https://fcm.googleapis.com/fcm/send';

  constructor(private http: HttpClient) {}

  sendToToken(
    token: string,
    title: string,
    body: string,
    data: Record<string, unknown> = {}
  ): Observable<unknown> {
    if (!environment.fcm?.serverKey) {
      console.warn('FCM server key is not configured. Unable to send push notification.');
      return of(null);
    }

    const payload: FcmPayload = {
      to: token,
      notification: {
        title,
        body,
      },
      data,
      priority: 'high',
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `key=${environment.fcm.serverKey}`,
    });

    return this.http.post(this.legacyEndpoint, payload, { headers });
  }
}
