import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { SharedRideOpportunity, LatLng } from '../interfaces/route-graph';
import { DijkstraService } from '../services/dijkstra.service';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-shared-ride-prompt',
  templateUrl: './shared-ride-prompt.component.html',
  styleUrls: ['./shared-ride-prompt.component.scss']
})
export class SharedRidePromptComponent implements OnInit, OnDestroy {
  @Input() opportunities: SharedRideOpportunity[] = [];
  @Input() userLocation: LatLng | null = null;
  @Input() userDestination: LatLng | null = null;

  @Output() accept = new EventEmitter<SharedRideOpportunity>();
  @Output() dismiss = new EventEmitter<void>();

  // Track time remaining for each opportunity
  timeRemaining: Map<string, number> = new Map();
  private timerSubscription: Subscription | null = null;

  // Expanded opportunity for details view
  expandedOpportunityId: string | null = null;

  constructor(private dijkstraService: DijkstraService) {}

  ngOnInit(): void {
    // Start countdown timer
    this.updateTimeRemaining();
    this.timerSubscription = interval(1000).subscribe(() => {
      this.updateTimeRemaining();
    });
  }

  ngOnDestroy(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
  }

  /**
   * Update time remaining for all opportunities
   */
  private updateTimeRemaining(): void {
    const now = new Date().getTime();
    
    this.opportunities.forEach(opp => {
      if (opp.expiresAt) {
        const remaining = Math.max(0, opp.expiresAt.getTime() - now);
        this.timeRemaining.set(opp.opportunityId, remaining);
      }
    });

    // Remove expired opportunities from view
    this.opportunities = this.opportunities.filter(opp => {
      const remaining = this.timeRemaining.get(opp.opportunityId);
      return remaining === undefined || remaining > 0;
    });
  }

  /**
   * Format time remaining as MM:SS
   */
  formatTimeRemaining(opportunityId: string): string {
    const ms = this.timeRemaining.get(opportunityId) || 0;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Calculate distance to opportunity origin
   */
  getDistanceToOrigin(opportunity: SharedRideOpportunity): string {
    if (!this.userLocation) return '--';
    
    const distance = this.dijkstraService.calculateHaversineDistance(
      this.userLocation,
      opportunity.origin
    );

    if (distance < 1000) {
      return `${Math.round(distance)}m away`;
    }
    return `${(distance / 1000).toFixed(1)}km away`;
  }

  /**
   * Get number of passengers already matched
   */
  getPassengerCount(opportunity: SharedRideOpportunity): number {
    return (opportunity.matchedRiders?.length || 0) + 1; // +1 for initiator
  }

  /**
   * Get available seats remaining
   */
  getAvailableSeats(opportunity: SharedRideOpportunity): number {
    const matched = opportunity.matchedRiders?.length || 0;
    return opportunity.maxPassengers - matched - 1; // -1 for initiator
  }

  /**
   * Toggle expanded view for an opportunity
   */
  toggleExpand(opportunityId: string): void {
    if (this.expandedOpportunityId === opportunityId) {
      this.expandedOpportunityId = null;
    } else {
      this.expandedOpportunityId = opportunityId;
    }
  }

  /**
   * Accept a shared ride opportunity
   */
  onAccept(opportunity: SharedRideOpportunity): void {
    this.accept.emit(opportunity);
  }

  /**
   * Dismiss the prompt
   */
  onDismiss(): void {
    this.dismiss.emit();
  }

  /**
   * Check if opportunity is urgent (< 1 min remaining)
   */
  isUrgent(opportunityId: string): boolean {
    const remaining = this.timeRemaining.get(opportunityId) || 0;
    return remaining < 60000 && remaining > 0;
  }

  /**
   * Get savings display text
   */
  getSavingsText(opportunity: SharedRideOpportunity): string {
    const savings = opportunity.estimatedPrice * (opportunity.potentialDiscount / 100);
    return `Save RM ${savings.toFixed(2)} (${opportunity.potentialDiscount}%)`;
  }

  /**
   * Track by function for ngFor
   */
  trackByOpportunityId(index: number, opportunity: SharedRideOpportunity): string {
    return opportunity.opportunityId;
  }
}
