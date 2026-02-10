import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import {
  LatLng,
  GraphNode,
  Edge,
  PathResult,
  RideCandidate,
  ScoredMatch,
  HeapNode
} from '../interfaces/route-graph';

/**
 * MinHeap implementation for Dijkstra's priority queue
 */
class MinHeap {
  private heap: HeapNode[] = [];

  push(node: HeapNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): HeapNode | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0 && last) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return min;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex].distance <= this.heap[index].distance) break;
      [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < length && this.heap[leftChild].distance < this.heap[smallest].distance) {
        smallest = leftChild;
      }
      if (rightChild < length && this.heap[rightChild].distance < this.heap[smallest].distance) {
        smallest = rightChild;
      }
      if (smallest === index) break;
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

@Injectable({
  providedIn: 'root'
})
export class DijkstraService {
  // Cache for computed paths (key: "lat1,lng1-lat2,lng2")
  private pathCache: Map<string, PathResult> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL
  private cacheTimestamps: Map<string, number> = new Map();

  // Earth radius in meters for Haversine calculation
  private readonly EARTH_RADIUS_M = 6371000;

  constructor(private http: HttpClient) {}

  /**
   * Calculate shortest path using Google Directions API and build graph
   * This creates a simplified graph from the route waypoints
   */
  async findShortestPath(origin: LatLng, destination: LatLng): Promise<PathResult> {
    const cacheKey = this.getCacheKey(origin, destination);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log('Returning cached path for:', cacheKey);
      return cached;
    }

    try {
      // Use Google Directions API to get the route
      const route = await this.getGoogleDirectionsRoute(origin, destination);
      
      if (!route) {
        throw new Error('No route found');
      }

      const pathResult: PathResult = {
        nodes: route.nodes,
        coordinates: route.coordinates,
        totalWeight: route.duration, // seconds
        totalDistance: route.distance, // meters
        encodedPolyline: route.encodedPolyline
      };

      // Cache the result
      this.setCache(cacheKey, pathResult);

      return pathResult;
    } catch (error) {
      console.error('Error finding shortest path:', error);
      
      // Fallback: return direct path with Haversine distance
      return this.createDirectPath(origin, destination);
    }
  }

  /**
   * Get route from Google Directions API
   */
  private async getGoogleDirectionsRoute(origin: LatLng, destination: LatLng): Promise<{
    nodes: string[];
    coordinates: LatLng[];
    duration: number;
    distance: number;
    encodedPolyline: string;
  } | null> {
    return new Promise((resolve, reject) => {
      const directionsService = new google.maps.DirectionsService();
      
      directionsService.route({
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true
      }, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          const route = result.routes[0];
          const leg = route.legs[0];
          
          // Extract coordinates from the path
          const coordinates: LatLng[] = [];
          const nodes: string[] = [];
          
          route.overview_path.forEach((point, index) => {
            const coord: LatLng = { lat: point.lat(), lng: point.lng() };
            coordinates.push(coord);
            nodes.push(`node_${index}`);
          });

          resolve({
            nodes,
            coordinates,
            duration: leg.duration?.value || 0,
            distance: leg.distance?.value || 0,
            encodedPolyline: route.overview_polyline
          });
        } else {
          console.error('Directions request failed:', status);
          resolve(null);
        }
      });
    });
  }

  /**
   * Create a direct path when no route is available (fallback)
   */
  private createDirectPath(origin: LatLng, destination: LatLng): PathResult {
    const distance = this.calculateHaversineDistance(origin, destination);
    // Estimate duration: average speed ~40 km/h in city
    const duration = (distance / 1000) / 40 * 3600; // seconds

    return {
      nodes: ['origin', 'destination'],
      coordinates: [origin, destination],
      totalWeight: Math.round(duration),
      totalDistance: Math.round(distance),
    };
  }

  /**
   * Run Dijkstra's algorithm on a graph
   * This is used when we have a pre-built road network graph
   */
  runDijkstra(
    graph: Map<string, GraphNode>,
    startId: string,
    endId: string
  ): PathResult | null {
    const distances: Map<string, number> = new Map();
    const previous: Map<string, string | null> = new Map();
    const visited: Set<string> = new Set();
    const heap = new MinHeap();

    // Initialize distances
    graph.forEach((_, nodeId) => {
      distances.set(nodeId, Infinity);
      previous.set(nodeId, null);
    });

    distances.set(startId, 0);
    heap.push({ nodeId: startId, distance: 0 });

    while (!heap.isEmpty()) {
      const current = heap.pop()!;
      
      if (visited.has(current.nodeId)) continue;
      visited.add(current.nodeId);

      // Found destination
      if (current.nodeId === endId) break;

      const currentNode = graph.get(current.nodeId);
      if (!currentNode) continue;

      // Process neighbors
      for (const edge of currentNode.neighbors) {
        if (visited.has(edge.targetId)) continue;

        const newDistance = distances.get(current.nodeId)! + edge.weight;
        
        if (newDistance < distances.get(edge.targetId)!) {
          distances.set(edge.targetId, newDistance);
          previous.set(edge.targetId, current.nodeId);
          heap.push({ nodeId: edge.targetId, distance: newDistance });
        }
      }
    }

    // Reconstruct path
    if (distances.get(endId) === Infinity) {
      return null; // No path found
    }

    const path: string[] = [];
    const coordinates: LatLng[] = [];
    let totalDistance = 0;
    let currentId: string | null = endId;

    while (currentId) {
      path.unshift(currentId);
      const node = graph.get(currentId);
      if (node) {
        coordinates.unshift({ lat: node.lat, lng: node.lng });
      }
      
      const prevId = previous.get(currentId);
      if (prevId) {
        const prevNode = graph.get(prevId);
        if (prevNode) {
          const edge = prevNode.neighbors.find(e => e.targetId === currentId);
          if (edge) {
            totalDistance += edge.distance;
          }
        }
      }
      currentId = prevId ?? null;
    }

    return {
      nodes: path,
      coordinates,
      totalWeight: distances.get(endId)!,
      totalDistance
    };
  }

  /**
   * Calculate route overlap between two paths using Jaccard similarity
   * Returns a value between 0 and 1 (1 = identical routes)
   */
  calculateRouteOverlap(path1: PathResult, path2: PathResult): number {
    if (!path1.coordinates.length || !path2.coordinates.length) {
      return 0;
    }

    // Use a grid-based approach to find overlapping segments
    const GRID_SIZE = 100; // 100 meters grid cell
    
    const getGridKey = (coord: LatLng): string => {
      const latGrid = Math.floor(coord.lat * 111000 / GRID_SIZE);
      const lngGrid = Math.floor(coord.lng * 111000 * Math.cos(coord.lat * Math.PI / 180) / GRID_SIZE);
      return `${latGrid},${lngGrid}`;
    };

    // Create sets of grid cells for each path
    const set1 = new Set<string>();
    const set2 = new Set<string>();

    path1.coordinates.forEach(coord => set1.add(getGridKey(coord)));
    path2.coordinates.forEach(coord => set2.add(getGridKey(coord)));

    // Calculate Jaccard similarity
    let intersection = 0;
    set1.forEach(key => {
      if (set2.has(key)) intersection++;
    });

    const union = set1.size + set2.size - intersection;
    
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Calculate overlap with direction awareness
   * Ensures routes are going in similar direction, not just crossing
   */
  calculateDirectionalOverlap(path1: PathResult, path2: PathResult): number {
    const basicOverlap = this.calculateRouteOverlap(path1, path2);
    
    if (basicOverlap < 0.1) return 0;

    // Check if origins and destinations are in similar positions
    const originDistance = this.calculateHaversineDistance(
      path1.coordinates[0],
      path2.coordinates[0]
    );
    const destDistance = this.calculateHaversineDistance(
      path1.coordinates[path1.coordinates.length - 1],
      path2.coordinates[path2.coordinates.length - 1]
    );

    // Penalize if routes are in opposite directions
    const maxRouteLength = Math.max(path1.totalDistance, path2.totalDistance);
    const directionScore = 1 - Math.min(
      (originDistance + destDistance) / (2 * maxRouteLength),
      1
    );

    return basicOverlap * (0.5 + 0.5 * directionScore);
  }

  /**
   * Find and score similar routes from candidate rides
   */
  async findSimilarRoutes(
    riderPath: PathResult,
    candidates: RideCandidate[],
    maxDetourPercent: number = 0.25
  ): Promise<ScoredMatch[]> {
    const matches: ScoredMatch[] = [];

    for (const candidate of candidates) {
      try {
        // Get or compute candidate's path
        let candidatePath = candidate.path;
        if (!candidatePath) {
          candidatePath = await this.findShortestPath(candidate.origin, candidate.destination);
          candidate.path = candidatePath;
        }

        // Calculate overlap
        const overlapScore = this.calculateDirectionalOverlap(riderPath, candidatePath);

        // Skip if overlap is too low
        if (overlapScore < 0.3) continue;

        // Calculate detour cost (simplified: compare total distances)
        const combinedPathDistance = await this.estimateCombinedPathDistance(
          riderPath.coordinates[0],
          riderPath.coordinates[riderPath.coordinates.length - 1],
          candidate.origin,
          candidate.destination
        );

        const originalDistance = riderPath.totalDistance + candidatePath.totalDistance;
        const detourCost = combinedPathDistance - Math.max(riderPath.totalDistance, candidatePath.totalDistance);
        const detourPercent = detourCost / riderPath.totalDistance;

        // Skip if detour is too high
        if (detourPercent > maxDetourPercent) continue;

        // Calculate potential savings (10-40% based on overlap)
        const potentialSavings = Math.min(10 + Math.floor(overlapScore * 30), 40);

        matches.push({
          candidate,
          overlapScore,
          detourCost,
          detourPercent,
          potentialSavings
        });
      } catch (error) {
        console.error('Error processing candidate:', candidate.requestId, error);
      }
    }

    // Sort by overlap score (highest first)
    return matches.sort((a, b) => b.overlapScore - a.overlapScore);
  }

  /**
   * Estimate combined path distance for two riders sharing a ride
   */
  private async estimateCombinedPathDistance(
    origin1: LatLng,
    dest1: LatLng,
    origin2: LatLng,
    dest2: LatLng
  ): Promise<number> {
    // Simplified estimation: use Haversine distances
    // A more accurate method would use Google Directions with waypoints
    
    // Try different pickup/dropoff orders and find the shortest
    const orders = [
      [origin1, origin2, dest1, dest2],
      [origin1, origin2, dest2, dest1],
      [origin2, origin1, dest1, dest2],
      [origin2, origin1, dest2, dest1]
    ];

    let minDistance = Infinity;

    for (const order of orders) {
      let totalDistance = 0;
      for (let i = 0; i < order.length - 1; i++) {
        totalDistance += this.calculateHaversineDistance(order[i], order[i + 1]);
      }
      minDistance = Math.min(minDistance, totalDistance);
    }

    return minDistance;
  }

  /**
   * Calculate Haversine distance between two points in meters
   */
  calculateHaversineDistance(point1: LatLng, point2: LatLng): number {
    const lat1 = point1.lat * Math.PI / 180;
    const lat2 = point2.lat * Math.PI / 180;
    const deltaLat = (point2.lat - point1.lat) * Math.PI / 180;
    const deltaLng = (point2.lng - point1.lng) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return this.EARTH_RADIUS_M * c;
  }

  /**
   * Generate cache key from origin and destination
   */
  private getCacheKey(origin: LatLng, dest: LatLng): string {
    // Round to 5 decimal places (~1 meter precision)
    const round = (n: number) => Math.round(n * 100000) / 100000;
    return `${round(origin.lat)},${round(origin.lng)}-${round(dest.lat)},${round(dest.lng)}`;
  }

  /**
   * Get path from cache if valid
   */
  private getFromCache(key: string): PathResult | null {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp || Date.now() - timestamp > this.CACHE_TTL_MS) {
      this.pathCache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }
    return this.pathCache.get(key) || null;
  }

  /**
   * Set path in cache
   */
  private setCache(key: string, path: PathResult): void {
    this.pathCache.set(key, path);
    this.cacheTimestamps.set(key, Date.now());

    // Clean old cache entries periodically
    if (this.pathCache.size > 100) {
      this.cleanCache();
    }
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    this.cacheTimestamps.forEach((timestamp, key) => {
      if (now - timestamp > this.CACHE_TTL_MS) {
        this.pathCache.delete(key);
        this.cacheTimestamps.delete(key);
      }
    });
  }

  /**
   * Clear all cached paths
   */
  clearCache(): void {
    this.pathCache.clear();
    this.cacheTimestamps.clear();
  }
}

// Declare google maps types
declare var google: any;
