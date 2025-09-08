// Routing service for OpenStreetMap's OSRM API

interface Coordinates {
  lat: number
  lng: number
}

interface RouteStep {
  distance: number
  duration: number
  instruction: string
  name: string
  maneuver: {
    type: string
    modifier?: string
    location: [number, number]
  }
}

interface RouteResponse {
  routes: {
    distance: number
    duration: number
    geometry: {
      coordinates: [number, number][]
    }
    legs: {
      steps: RouteStep[]
      distance: number
      duration: number
      summary: string
    }[]
  }[]
  waypoints: {
    location: [number, number]
    name: string
  }[]
}

export interface RouteInstructions {
  distance: number
  duration: number
  steps: {
    instruction: string
    distance: number
    duration: number
    coordinates: [number, number]
  }[]
  coordinates: [number, number][]
}

// Update the getRoute function to include a fallback mechanism when the API fails
export async function getRoute(
  start: Coordinates,
  end: Coordinates,
  avoidAreas: [number, number][][],
): Promise<RouteInstructions | null> {
  try {
    // OSRM API endpoint
    const baseUrl = "https://router.project-osrm.org/route/v1/driving/"

    // Format coordinates for the API
    const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`

    // Options for the route
    const options = "?overview=full&geometries=geojson&steps=true"

    // Make the API request
    const response = await fetch(`${baseUrl}${coordinates}${options}`)
    const data = (await response.json()) as RouteResponse

    if (!data.routes || data.routes.length === 0) {
      console.error("No route found, using fallback")
      return generateFallbackRoute(start, end)
    }

    const route = data.routes[0]
    const steps = route.legs[0].steps.map((step) => ({
      instruction: step.instruction || generateInstructionFromManeuver(step.maneuver),
      distance: step.distance,
      duration: step.duration,
      coordinates: step.maneuver.location as [number, number],
    }))

    return {
      distance: route.distance,
      duration: route.duration,
      steps,
      coordinates: route.geometry.coordinates as [number, number][],
    }
  } catch (error) {
    console.error("Error fetching route:", error)
    // Use fallback route generation when API fails
    return generateFallbackRoute(start, end)
  }
}

// Add a fallback route generator function
function generateFallbackRoute(start: Coordinates, end: Coordinates): RouteInstructions {
  // Calculate straight-line distance
  const distance = calculateDistance(start.lat, start.lng, end.lat, end.lng)

  // Estimate duration (assuming average speed of 30 km/h)
  const duration = (distance / 30) * 3600 // seconds

  // Generate intermediate points for a more realistic route
  const numPoints = Math.max(5, Math.floor(distance / 0.5)) // One point every 500m
  const coordinates: [number, number][] = []

  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints
    const lat = start.lat + fraction * (end.lat - start.lat)
    const lng = start.lng + fraction * (end.lng - start.lng)
    coordinates.push([lng, lat])
  }

  // Generate basic steps
  const steps = [
    {
      instruction: "Start navigation",
      distance: 0,
      duration: 0,
      coordinates: [start.lng, start.lat] as [number, number],
    },
    {
      instruction: "Continue straight",
      distance: distance * 0.5,
      duration: duration * 0.5,
      coordinates: [start.lng + (end.lng - start.lng) * 0.5, start.lat + (end.lat - start.lat) * 0.5] as [
        number,
        number,
      ],
    },
    {
      instruction: "Arrive at destination",
      distance: distance * 0.5,
      duration: duration * 0.5,
      coordinates: [end.lng, end.lat] as [number, number],
    },
  ]

  return {
    distance,
    duration,
    steps,
    coordinates,
  }
}

// Helper function to calculate distance between two points in meters
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

// Helper function to generate instruction from maneuver
function generateInstructionFromManeuver(maneuver: { type: string; modifier?: string }): string {
  if (!maneuver) return "Continue straight"

  const type = maneuver.type || ""
  const modifier = maneuver.modifier || ""

  if (type === "turn") {
    if (modifier === "left") return "Turn left"
    if (modifier === "right") return "Turn right"
    if (modifier === "slight left") return "Turn slightly left"
    if (modifier === "slight right") return "Turn sharp left"
    if (modifier === "sharp right") return "Turn sharp right"
    if (modifier === "uturn") return "Make a U-turn"
  }

  if (type === "new name" || type === "continue") return "Continue straight"
  if (type === "depart") return "Start navigation"
  if (type === "arrive") return "Arrive at destination"
  if (type === "roundabout") return "Enter the roundabout"
  if (type === "exit roundabout") return "Exit the roundabout"
  if (type === "fork") {
    if (modifier === "left") return "Keep left at the fork"
    if (modifier === "right") return "Keep right at the fork"
    return "Continue at the fork"
  }
  if (type === "merge") return "Merge with the road"
  if (type === "ramp") {
    if (modifier === "left") return "Take the ramp on the left"
    if (modifier === "right") return "Take the ramp on the right"
    return "Take the ramp"
  }

  return "Continue straight"
}

// Improve the routePassesThroughFloodZones function to properly check if a route passes through flood zones
// Replace the placeholder implementation with a real one

function routePassesThroughFloodZones(
  coordinates: [number, number][],
  floodZones: { coordinates: [number, number][]; severity: string }[],
): boolean {
  // Only check for Critical and High severity flood zones
  const dangerousFloodZones = floodZones.filter((zone) => zone.severity === "Critical" || zone.severity === "High")

  if (dangerousFloodZones.length === 0) return false

  // Check each point in the route
  for (const point of coordinates) {
    for (const zone of dangerousFloodZones) {
      if (isPointInPolygon(point, zone.coordinates)) {
        return true
      }
    }
  }

  return false
}

// Add a helper function to check if a point is inside a polygon
function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  // Ray casting algorithm for point in polygon detection
  const [x, y] = point
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }

  return inside
}

// Improve the routePassesThroughBlockedRoads function
function routePassesThroughBlockedRoads(
  coordinates: [number, number][],
  blockedRoads: { coordinates: [number, number][]; status: string }[],
): boolean {
  if (blockedRoads.length === 0) return false

  // Check each segment of the route against each blocked road
  for (let i = 0; i < coordinates.length - 1; i++) {
    const routeSegment = [coordinates[i], coordinates[i + 1]]

    for (const road of blockedRoads) {
      if (road.coordinates.length < 2) continue

      // Check if the route segment intersects with the blocked road
      if (
        doLineSegmentsIntersect(
          routeSegment[0][0],
          routeSegment[0][1],
          routeSegment[1][0],
          routeSegment[1][1],
          road.coordinates[0][0],
          road.coordinates[0][1],
          road.coordinates[1][0],
          road.coordinates[1][1],
        )
      ) {
        return true
      }

      // Also check if the route passes very close to a blocked road
      const distance = distanceToLineSegment(
        routeSegment[0][0],
        routeSegment[0][1],
        routeSegment[1][0],
        routeSegment[1][1],
        road.coordinates[0][0],
        road.coordinates[0][1],
        road.coordinates[1][0],
        road.coordinates[1][1],
      )

      if (distance < 0.0005) {
        // About 50 meters
        return true
      }
    }
  }

  return false
}

// Add helper functions for line segment intersection and distance
function doLineSegmentsIntersect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
): boolean {
  // Calculate the direction of the lines
  const d1x = x2 - x1
  const d1y = y2 - y1
  const d2x = x4 - x3
  const d2y = y4 - y3

  // Calculate the determinant
  const det = d1x * d2y - d1y * d2x

  // If determinant is zero, lines are parallel
  if (det === 0) return false

  // Calculate the parameters for the intersection point
  const t = ((x3 - x1) * d2y - (y3 - y1) * d2x) / det
  const u = ((x3 - x1) * d1y - (y3 - y1) * d1x) / det

  // Check if the intersection is within both line segments
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

function distanceToLineSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
): number {
  // Calculate the length of the line segment
  const lineLength = Math.sqrt((x4 - x3) * (x4 - x3) + (y4 - y3) * (y4 - y3))

  if (lineLength === 0) {
    // If the line segment is a point, calculate distance to that point
    return Math.sqrt((x3 - x1) * (x3 - x1) + (y3 - y1) * (y3 - y1))
  }

  // Calculate the projection of the point onto the line
  const t = ((x1 - x3) * (x4 - x3) + (y1 - y3) * (y4 - y3)) / (lineLength * lineLength)

  if (t < 0) {
    // Closest point is the start of the line segment
    return Math.sqrt((x1 - x3) * (x1 - x3) + (y1 - y3) * (y1 - y3))
  }

  if (t > 1) {
    // Closest point is the end of the line segment
    return Math.sqrt((x1 - x4) * (x1 - x4) + (y1 - y4) * (y1 - y4))
  }

  // Closest point is on the line segment
  const projX = x3 + t * (x4 - x3)
  const projY = y3 + t * (y4 - y3)

  return Math.sqrt((x1 - projX) * (x1 - projX) + (y1 - projY) * (y1 - projY))
}

// Improve the findSafeRoute function to better handle flood zones and blocked roads
export async function findSafeRoute(
  start: Coordinates,
  end: Coordinates,
  floodZones: { coordinates: [number, number][]; severity: string }[],
  blockedRoads: { coordinates: [number, number][]; status: string }[],
): Promise<RouteInstructions> {
  try {
    // First try the direct route
    const directRoute = await getRoute(start, end, [])

    if (!directRoute) {
      console.error("Failed to get direct route, using fallback")
      return generateFallbackRoute(start, end)
    }

    // Check if the direct route is safe
    const passesThroughFloodZones = routePassesThroughFloodZones(directRoute.coordinates, floodZones)
    const passesThroughBlockedRoads = routePassesThroughBlockedRoads(directRoute.coordinates, blockedRoads)

    if (!passesThroughFloodZones && !passesThroughBlockedRoads) {
      return directRoute
    }

    console.log("Direct route passes through flood zones or blocked roads, finding alternatives")

    // Generate more waypoints for better alternative routes
    const waypoints = generateWaypoints(start, end, floodZones, blockedRoads)

    // Try each waypoint
    const routeOptions: RouteInstructions[] = []

    for (const waypoint of waypoints) {
      try {
        // Get route from start to waypoint
        const route1 = await getRoute(start, { lat: waypoint[0], lng: waypoint[1] }, [])
        if (!route1) continue

        // Get route from waypoint to end
        const route2 = await getRoute({ lat: waypoint[0], lng: waypoint[1] }, end, [])
        if (!route2) continue

        // Combine the routes
        const combinedRoute = {
          distance: route1.distance + route2.distance,
          duration: route1.duration + route2.duration,
          steps: [...route1.steps, ...route2.steps],
          coordinates: [...route1.coordinates, ...route2.coordinates],
        }

        // Check if the combined route is safe
        const passesThroughFloodZones = routePassesThroughFloodZones(combinedRoute.coordinates, floodZones)
        const passesThroughBlockedRoads = routePassesThroughBlockedRoads(combinedRoute.coordinates, blockedRoads)

        if (!passesThroughFloodZones && !passesThroughBlockedRoads) {
          routeOptions.push(combinedRoute)

          // If we have found 3 safe routes, stop searching
          if (routeOptions.length >= 3) {
            break
          }
        }
      } catch (error) {
        console.error("Error with waypoint route:", error)
        continue
      }
    }

    // If we found at least one safe route, return the shortest one
    if (routeOptions.length > 0) {
      // Sort by distance
      routeOptions.sort((a, b) => a.distance - b.distance)
      return routeOptions[0]
    }

    // If no safe route is found, try a route with two waypoints
    for (let i = 0; i < waypoints.length; i++) {
      for (let j = i + 1; j < waypoints.length; j++) {
        try {
          // Get route from start to first waypoint
          const route1 = await getRoute(start, { lat: waypoints[i][0], lng: waypoints[i][1] }, [])
          if (!route1) continue

          // Get route from first waypoint to second waypoint
          const route2 = await getRoute(
            { lat: waypoints[i][0], lng: waypoints[i][1] },
            { lat: waypoints[j][0], lng: waypoints[j][1] },
            [],
          )
          if (!route2) continue

          // Get route from second waypoint to end
          const route3 = await getRoute({ lat: waypoints[j][0], lng: waypoints[j][1] }, end, [])
          if (!route3) continue

          // Combine the routes
          const combinedRoute = {
            distance: route1.distance + route2.distance + route3.distance,
            duration: route1.duration + route2.duration + route3.duration,
            steps: [...route1.steps, ...route2.steps, ...route3.steps],
            coordinates: [...route1.coordinates, ...route2.coordinates, ...route3.coordinates],
          }

          // Check if the combined route is safe
          const passesThroughFloodZones = routePassesThroughFloodZones(combinedRoute.coordinates, floodZones)
          const passesThroughBlockedRoads = routePassesThroughBlockedRoads(combinedRoute.coordinates, blockedRoads)

          if (!passesThroughFloodZones && !passesThroughBlockedRoads) {
            return combinedRoute
          }
        } catch (error) {
          console.error("Error with two-waypoint route:", error)
          continue
        }
      }
    }

    // If still no safe route is found, return the direct route with a warning
    console.warn("No safe route found, returning direct route")
    return directRoute
  } catch (error) {
    console.error("Error in findSafeRoute:", error)
    return generateFallbackRoute(start, end)
  }
}

// Improve the waypoint generation to create better alternative routes
function generateWaypoints(
  start: Coordinates,
  end: Coordinates,
  floodZones: { coordinates: [number, number][]; severity: string }[],
  blockedRoads: { coordinates: [number, number][]; status: string }[],
): [number, number][] {
  const waypoints: [number, number][] = []

  // Add waypoints around flood zones
  for (const zone of floodZones) {
    if (zone.severity !== "Critical" && zone.severity !== "High") continue

    // Calculate center of the flood zone
    const centerLat = zone.coordinates.reduce((sum, coord) => sum + coord[0], 0) / zone.coordinates.length
    const centerLng = zone.coordinates.reduce((sum, coord) => sum + coord[1], 0) / zone.coordinates.length

    // Calculate the maximum distance from center to any point in the polygon
    let maxDistance = 0
    for (const coord of zone.coordinates) {
      const distance = calculateDistance(centerLat, centerLng, coord[0], coord[1])
      if (distance > maxDistance) {
        maxDistance = distance
      }
    }

    // Generate waypoints around the flood zone at a safe distance
    const safeDistance = maxDistance * 1.5
    const numPoints = 8 // Generate points in 8 directions

    for (let i = 0; i < numPoints; i++) {
      const angle = (2 * Math.PI * i) / numPoints
      const waypointLat = centerLat + safeDistance * Math.cos(angle)
      const waypointLng = centerLng + safeDistance * Math.sin(angle)

      // Check if this waypoint is inside any flood zone
      let isInsideAnyFloodZone = false
      for (const checkZone of floodZones) {
        if (isPointInPolygon([waypointLng, waypointLat], checkZone.coordinates)) {
          isInsideAnyFloodZone = true
          break
        }
      }

      if (!isInsideAnyFloodZone) {
        waypoints.push([waypointLat, waypointLng])
      }
    }
  }

  // Add waypoints to avoid blocked roads
  for (const road of blockedRoads) {
    if (road.coordinates.length < 2) continue

    // Calculate midpoint of the blocked road
    const midLat = (road.coordinates[0][0] + road.coordinates[1][0]) / 2
    const midLng = (road.coordinates[0][1] + road.coordinates[1][1]) / 2

    // Calculate perpendicular direction to the road
    const roadDx = road.coordinates[1][0] - road.coordinates[0][0]
    const roadDy = road.coordinates[1][1] - road.coordinates[0][1]
    const perpDx = -roadDy
    const perpDy = roadDx

    // Normalize the perpendicular vector
    const perpLength = Math.sqrt(perpDx * perpDx + perpDy * perpDy)
    const normPerpDx = perpDx / perpLength
    const normPerpDy = perpDy / perpLength

    // Add waypoints on both sides of the road
    const detourDistance = 0.005 // About 500m
    waypoints.push([midLat + normPerpDx * detourDistance, midLng + normPerpDy * detourDistance])
    waypoints.push([midLat - normPerpDx * detourDistance, midLng - normPerpDy * detourDistance])
  }

  // Add waypoints between start and end
  const dx = end.lng - start.lng
  const dy = end.lat - start.lat
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Add intermediate waypoints along the direct path
  const numIntermediatePoints = Math.max(2, Math.floor(distance / 0.01)) // One point every ~1km
  for (let i = 1; i < numIntermediatePoints; i++) {
    const fraction = i / numIntermediatePoints
    waypoints.push([start.lat + dy * fraction, start.lng + dx * fraction])
  }

  // Add some random waypoints for more route diversity
  const randomPointCount = 5
  const maxRandomOffset = 0.01 // About 1km

  for (let i = 0; i < randomPointCount; i++) {
    waypoints.push([
      start.lat + dy * 0.5 + (Math.random() - 0.5) * maxRandomOffset,
      start.lng + dx * 0.5 + (Math.random() - 0.5) * maxRandomOffset,
    ])
  }

  return waypoints
}

// Format distance for display
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  } else {
    return `${(meters / 1000).toFixed(1)} km`
  }
}

// Format duration for display
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return `${hours} hr ${remainingMinutes} min`
  } else {
    return `${minutes} min`
  }
}

