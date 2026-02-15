import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Thread,
  ThreadListResponse,
  ThreadMessagesResponse,
} from '../models/thread.models';

/**
 * ThreadService
 *
 * REST client for the conversation persistence API.
 * Handles thread listing, message history, rename, and delete.
 */
@Injectable({
  providedIn: 'root',
})
export class ThreadService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}${environment.threadsEndpoint}`;

  private get headers(): HttpHeaders {
    return new HttpHeaders({ 'X-User-Id': environment.userId });
  }

  /** Fetch paginated thread list, sorted by updated_at descending */
  getThreads(limit = 50, offset = 0): Observable<ThreadListResponse> {
    return this.http.get<ThreadListResponse>(this.baseUrl, {
      headers: this.headers,
      params: { limit: limit.toString(), offset: offset.toString() },
    });
  }

  /** Fetch all messages for a thread in chronological order */
  getMessages(threadId: string): Observable<ThreadMessagesResponse> {
    return this.http.get<ThreadMessagesResponse>(
      `${this.baseUrl}/${threadId}/messages`,
      { headers: this.headers },
    );
  }

  /** Update thread title */
  updateThread(threadId: string, title: string): Observable<Thread> {
    return this.http.patch<Thread>(
      `${this.baseUrl}/${threadId}`,
      { title },
      { headers: this.headers },
    );
  }

  /** Delete thread (cascades: events + ADK session) */
  deleteThread(threadId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${threadId}`, {
      headers: this.headers,
    });
  }
}
