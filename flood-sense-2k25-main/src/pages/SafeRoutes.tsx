"use client"
import { useState, useEffect, useRef, type FormEvent } from "react"
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Users,
  Printer,
  Download,
  Send,
  Info,
  Navigation,
  RefreshCw,
  X,
  MapPin,
  MapIcon,
  Layers,
  Search,
} from "lucide-react"
import { useAppContext } from "../context/AppContext"
import LoadingSpinner from "../components/LoadingSpinner"
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-routing-machine"
import L from "leaflet"
import PriorityQueue from "priorityqueuejs"

// Fix for default marker icons in react-leaflet
import icon from "leaflet/dist/images/marker-icon.png"
import iconShadow from "leaflet/dist/images/marker-shadow.png"

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

L.Marker.prototype.options.icon = DefaultIcon

// Define types for our data
interface Route {
  id: string
  name: string
  status: "Open" | "Warning" | "Closed"
  statusColor: string
  updated: string
  startPoint: [number, number]
  endPoint: [number, number]
  district: string
}

interface Update {
  id: string
  time: string
  title: string
  description: string
  severity: "High" | "Medium" | "Low"
}

interface Communication {
  id: string
  title: string
  time: string
  recipients: string
  status: "Delivered" | "Pending" | "Failed"
}

interface FloodZone {
  id: string
  name: string
  coordinates: [number, number][]
  riskLevel: "high" | "medium" | "low"
}

interface GraphNode {
  id: string
  coordinates: [number, number]
  connections: {
    nodeId: string
    distance: number
    riskLevel: "high" | "medium" | "low" | "safe"
  }[]
}

// Component to update map view when center changes
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  map.setView(center, zoom)
  return null
}

// Tamil Nadu districts data
const tamilNaduDistricts = [
  { name: "Chennai", coordinates: [13.0827, 80.2707] },
  { name: "Coimbatore", coordinates: [11.0168, 76.9558] },
  { name: "Madurai", coordinates: [9.9252, 78.1198] },
  { name: "Tiruchirappalli", coordinates: [10.7905, 78.7047] },
  { name: "Salem", coordinates: [11.6643, 78.146] },
  { name: "Tirunelveli", coordinates: [8.7139, 77.7567] },
  { name: "Tiruppur", coordinates: [11.1085, 77.3411] },
  { name: "Erode", coordinates: [11.341, 77.7172] },
  { name: "Vellore", coordinates: [12.9165, 79.1325] },
  { name: "Thoothukkudi", coordinates: [8.7642, 78.1348] },
  { name: "Dindigul", coordinates: [10.3624, 77.9695] },
  { name: "Thanjavur", coordinates: [10.787, 79.1378] },
  { name: "Ranipet", coordinates: [12.9277, 79.3193] },
  { name: "Sivaganga", coordinates: [9.8433, 78.4809] },
  { name: "Kanyakumari", coordinates: [8.0883, 77.5385] },
  { name: "Namakkal", coordinates: [11.2189, 78.1674] },
  { name: "Karur", coordinates: [10.9601, 78.0766] },
  { name: "Tiruvarur", coordinates: [10.7661, 79.6344] },
  { name: "Nagapattinam", coordinates: [10.7672, 79.8449] },
  { name: "Krishnagiri", coordinates: [12.5266, 78.2141] },
  { name: "Cuddalore", coordinates: [11.748, 79.7714] },
  { name: "Dharmapuri", coordinates: [12.121, 78.1582] },
  { name: "Kanchipuram", coordinates: [12.8185, 79.6947] },
  { name: "Tiruvannamalai", coordinates: [12.2253, 79.0747] },
  { name: "Pudukkottai", coordinates: [10.3833, 78.8001] },
  { name: "Nilgiris", coordinates: [11.4916, 76.7337] },
  { name: "Ramanathapuram", coordinates: [9.3639, 78.8395] },
  { name: "Virudhunagar", coordinates: [9.568, 77.9624] },
  { name: "Ariyalur", coordinates: [11.14, 79.0786] },
  { name: "Perambalur", coordinates: [11.2342, 78.8807] },
  { name: "Kallakurichi", coordinates: [11.7383, 78.9571] },
  { name: "Tenkasi", coordinates: [8.9598, 77.3161] },
  { name: "Chengalpattu", coordinates: [12.6819, 79.9888] },
  { name: "Mayiladuthurai", coordinates: [11.1014, 79.6583] },
  { name: "Tirupattur", coordinates: [12.495, 78.5686] },
  { name: "Villupuram", coordinates: [11.9401, 79.4861] },
  { name: "Theni", coordinates: [10.0104, 77.4768] },
  { name: "Thoothukkudi", coordinates: [8.7642, 78.1348] },
  // Chennai-specific areas
  { name: "Chennai Central", coordinates: [13.0827, 80.2707] },
  { name: "T. Nagar", coordinates: [13.0418, 80.2341] },
  { name: "Adyar", coordinates: [13.0012, 80.2565] },
  { name: "Anna Nagar", coordinates: [13.085, 80.2101] },
  { name: "Velachery", coordinates: [12.9815, 80.2176] },
  { name: "Tambaram", coordinates: [12.9249, 80.1] },
  { name: "Porur", coordinates: [13.0359, 80.1567] },
  { name: "Sholinganallur", coordinates: [12.901, 80.2279] },
  { name: "Guindy", coordinates: [13.0067, 80.2206] },
  { name: "Mylapore", coordinates: [13.0368, 80.2676] },
]

export default function SafeRoutes() {
  const { refreshData, sendEmergencyBroadcast, isLoading, userLocation, addAlert } = useAppContext()
  const [selectedView, setSelectedView] = useState("Traffic")
  const [notificationMessage, setNotificationMessage] = useState("")
  const [notificationPriority, setNotificationPriority] = useState("High")
  const [notificationRecipients, setNotificationRecipients] = useState("All Recipients")
  const [refreshing, setRefreshing] = useState(false)
  const [routes, setRoutes] = useState<Route[]>([])
  const [updates, setUpdates] = useState<Update[]>([])
  const [communications, setCommunications] = useState<Communication[]>([])
  const [showRouteDetails, setShowRouteDetails] = useState<string | null>(null)
  const [sendingNotification, setSendingNotification] = useState(false)
  const [mapCenter, setMapCenter] = useState<[number, number]>([13.0827, 80.2707]) // Chennai center
  const [mapZoom, setMapZoom] = useState(11)
  const [mapType, setMapType] = useState<"street" | "satellite">("street")
  const [showLayers, setShowLayers] = useState(false)
  const [showFloodZones, setShowFloodZones] = useState(true)
  const [showShelters, setShowShelters] = useState(true)
  const [showRoads, setShowRoads] = useState(true)
  const [fullScreenMap, setFullScreenMap] = useState(false)
  const [selectedDistrict, setSelectedDistrict] = useState("All Districts")
  const [searchQuery, setSearchQuery] = useState("")
  const [routingControl, setRoutingControl] = useState<L.Routing.Control | null>(null)
  const [customRoute, setCustomRoute] = useState<{
    start: [number, number] | null
    end: [number, number] | null
  }>({ start: null, end: null })
  const [fromLocation, setFromLocation] = useState("Chennai Central")
  const [toLocation, setToLocation] = useState("Adyar")
  const [routeRiskLevel, setRouteRiskLevel] = useState<"high" | "medium" | "low" | null>(null)
  const [showRouteRisk, setShowRouteRisk] = useState(false)
  const [riskRoutes, setRiskRoutes] = useState<{
    high: L.Polyline | null
    medium: L.Polyline | null
    low: L.Polyline | null
  }>({ high: null, medium: null, low: null })
  const [floodZones, setFloodZones] = useState<FloodZone[]>([])
  const [roadNetwork, setRoadNetwork] = useState<GraphNode[]>([])
  const [shortestPath, setShortestPath] = useState<[number, number][] | null>(null)
  const [showShortestPath, setShowShortestPath] = useState(true)
  const [avoidFloodZones, setAvoidFloodZones] = useState(true)

  const mapRef = useRef<L.Map | null>(null)

  const stats = [
    {
      title: "Active Evacuations",
      value: "3",
      icon: <AlertTriangle className="text-red-500" size={20} />,
      className: "border-red-100",
    },
    {
      title: "Blocked Roads",
      value: "12",
      icon: <AlertCircle className="text-orange-500" size={20} />,
      className: "border-orange-100",
    },
    {
      title: "Safe Routes",
      value: "8",
      icon: <CheckCircle2 className="text-green-500" size={20} />,
      className: "border-green-100",
    },
    {
      title: "Active Users",
      value: "1,247",
      icon: <Users className="text-blue-500" size={20} />,
      className: "border-blue-100",
    },
  ]

  // Add the useEffect to load default routes on component mount

  // Load mock data on mount
  useEffect(() => {
    loadMockData()
  }, [])

  // Set user location as map center if available
  useEffect(() => {
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng])
      setMapZoom(12)
    }
  }, [userLocation])

  // Check for navigation target from notifications
  useEffect(() => {
    const navigationTarget = localStorage.getItem("mapNavigationTarget")
    if (navigationTarget) {
      try {
        const target = JSON.parse(navigationTarget)
        if (target.coordinates) {
          setMapCenter(target.coordinates)
          setMapZoom(target.zoom || 15)

          // Clear the navigation target
          localStorage.removeItem("mapNavigationTarget")
        }
      } catch (error) {
        console.error("Error parsing navigation target:", error)
      }
    }
  }, [])

  // Set default from/to locations and calculate routes
  useEffect(() => {
    if (mapRef.current) {
      // Wait a bit for the map to be fully initialized
      const timer = setTimeout(() => {
        calculateSafeRoute({ preventDefault: () => {} } as FormEvent)
      }, 1500)

      return () => clearTimeout(timer)
    }
  }, [mapRef.current])

  const loadMockData = async () => {
    // Generate Tamil Nadu based routes
    const tamilNaduRoutes: Route[] = tamilNaduDistricts.slice(0, 8).map((district, index) => {
      const statusOptions = ["Open", "Warning", "Closed", "Open", "Open", "Warning", "Open", "Closed"]
      const statusColorOptions = [
        "text-green-500",
        "text-orange-500",
        "text-red-500",
        "text-green-500",
        "text-green-500",
        "text-orange-500",
        "text-green-500",
        "text-red-500",
      ]
      const updatedOptions = [
        "2 mins ago",
        "5 mins ago",
        "12 mins ago",
        "15 mins ago",
        "20 mins ago",
        "25 mins ago",
        "30 mins ago",
        "35 mins ago",
      ]

      // Generate a random end point near the district
      const endLat = district.coordinates[0] + (Math.random() * 0.1 - 0.05)
      const endLng = district.coordinates[1] + (Math.random() * 0.1 - 0.05)

      return {
        id: `route${index + 1}`,
        name: `${district.name} Evacuation Route`,
        status: statusOptions[index] as "Open" | "Warning" | "Closed",
        statusColor: statusColorOptions[index],
        updated: updatedOptions[index],
        startPoint: district.coordinates,
        endPoint: [endLat, endLng],
        district: district.name,
      }
    })
    setRoutes(tamilNaduRoutes)

    // Generate updates based on routes
    const generatedUpdates: Update[] = tamilNaduRoutes.slice(0, 3).map((route, index) => {
      const severityOptions = ["High", "Medium", "Low"]
      const descriptionOptions = [
        `Road closure due to flooding in ${route.district}`,
        `Heavy traffic congestion in ${route.district}`,
        `Route cleared and reopened in ${route.district}`,
      ]

      return {
        id: `update${index + 1}`,
        time: new Date(Date.now() - 1000 * 60 * (15 * (index + 1))).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        title: `${route.district} ${index === 0 ? "Bridge" : index === 1 ? "Highway Exit" : "Route"}`,
        description: descriptionOptions[index],
        severity: severityOptions[index] as "High" | "Medium" | "Low",
      }
    })
    setUpdates(generatedUpdates)

    // Generate communications
    const generatedCommunications: Communication[] = [
      {
        id: "comm1",
        title: "Emergency evacuation required for Chennai area",
        time: new Date(Date.now() - 1000 * 60 * 15).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        recipients: "1,247",
        status: "Delivered",
      },
      {
        id: "comm2",
        title: "New safe route available via Coimbatore East",
        time: new Date(Date.now() - 1000 * 60 * 30).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        recipients: "892",
        status: "Delivered",
      },
    ]
    setCommunications(generatedCommunications)

    // Generate flood zones and road network
    generateMockFloodZones()
    setTimeout(() => {
      generateRoadNetwork()
    }, 500)
  }

  const generateMockFloodZones = () => {
    // Generate mock flood zones for demonstration
    const mockFloodZones: FloodZone[] = [
      {
        id: "flood1",
        name: "Chennai Coastal Flood Zone",
        coordinates: [
          [13.0827, 80.2707],
          [13.0927, 80.2807],
          [13.0727, 80.2907],
          [13.0627, 80.2807],
          [13.0827, 80.2707],
        ],
        riskLevel: "high",
      },
      {
        id: "flood2",
        name: "Adyar River Flood Zone",
        coordinates: [
          [13.0012, 80.2565],
          [13.0112, 80.2665],
          [13.0212, 80.2565],
          [13.0112, 80.2465],
          [13.0012, 80.2565],
        ],
        riskLevel: "medium",
      },
      {
        id: "flood3",
        name: "Velachery Flood Zone",
        coordinates: [
          [12.9815, 80.2176],
          [12.9915, 80.2276],
          [12.9715, 80.2376],
          [12.9615, 80.2276],
          [12.9815, 80.2176],
        ],
        riskLevel: "high",
      },
      {
        id: "flood4",
        name: "Tambaram Flood Zone",
        coordinates: [
          [12.9249, 80.1],
          [12.9349, 80.11],
          [12.9149, 80.12],
          [12.9049, 80.11],
          [12.9249, 80.1],
        ],
        riskLevel: "low",
      },
      {
        id: "flood5",
        name: "Porur Flood Zone",
        coordinates: [
          [13.0359, 80.1567],
          [13.0459, 80.1667],
          [13.0259, 80.1767],
          [13.0159, 80.1667],
          [13.0359, 80.1567],
        ],
        riskLevel: "medium",
      },
    ]

    setFloodZones(mockFloodZones)
  }

  const generateRoadNetwork = () => {
    // Create a graph of nodes and connections for Dijkstra's algorithm
    // In a real application, this would be based on actual road data
    const nodes: GraphNode[] = tamilNaduDistricts.map((district) => ({
      id: district.name,
      coordinates: district.coordinates,
      connections: [],
    }))

    // Create connections between nodes (roads)
    // For simplicity, we'll connect each node to its 3 nearest neighbors
    nodes.forEach((node) => {
      const otherNodes = nodes.filter((n) => n.id !== node.id)

      // Sort other nodes by distance
      const sortedNodes = otherNodes.sort((a, b) => {
        const distA = calculateDistance(node.coordinates, a.coordinates)
        const distB = calculateDistance(node.coordinates, b.coordinates)
        return distA - distB
      })

      // Connect to 3 nearest nodes
      for (let i = 0; i < Math.min(3, sortedNodes.length); i++) {
        const distance = calculateDistance(node.coordinates, sortedNodes[i].coordinates)

        // Check if the connection passes through a flood zone
        let riskLevel: "high" | "medium" | "low" | "safe" = "safe"

        for (const floodZone of floodZones) {
          if (isPathCrossingPolygon(node.coordinates, sortedNodes[i].coordinates, floodZone.coordinates)) {
            riskLevel = floodZone.riskLevel
            break
          }
        }

        node.connections.push({
          nodeId: sortedNodes[i].id,
          distance,
          riskLevel,
        })
      }
    })

    setRoadNetwork(nodes)
  }

  const calculateDistance = (point1: [number, number], point2: [number, number]): number => {
    // Calculate Haversine distance between two points (lat/lng)
    const R = 6371 // Earth's radius in km
    const dLat = ((point2[0] - point1[0]) * Math.PI) / 180
    const dLon = ((point2[1] - point1[1]) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1[0] * Math.PI) / 180) *
        Math.cos((point2[0] * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const isPathCrossingPolygon = (
    start: [number, number],
    end: [number, number],
    polygonCoords: [number, number][],
  ): boolean => {
    // Simplified check - in a real app, you'd use a proper geometric intersection algorithm
    // This is a basic approximation that checks if the midpoint is inside the polygon
    const midpoint: [number, number] = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]

    return isPointInPolygon(midpoint, polygonCoords)
  }

  const isPointInPolygon = (point: [number, number], polygon: [number, number][]): boolean => {
    // Ray casting algorithm to determine if a point is inside a polygon
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][1],
        yi = polygon[i][0]
      const xj = polygon[j][1],
        yj = polygon[j][0]

      const intersect = yi > point[0] !== yj > point[0] && point[1] < ((xj - xi) * (point[0] - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }

    return inside
  }

  const findShortestPath = (startNodeId: string, endNodeId: string, avoidFloodAreas = true): [number, number][] => {
    // Implementation of Dijkstra's algorithm to find the shortest path
    const startNode = roadNetwork.find((node) => node.id === startNodeId)
    const endNode = roadNetwork.find((node) => node.id === endNodeId)

    if (!startNode || !endNode) {
      console.error("Start or end node not found in road network")
      return []
    }

    // Initialize data structures
    const distances: Record<string, number> = {}
    const previous: Record<string, string | null> = {}
    const visited: Set<string> = new Set()

    // Create a priority queue
    const queue = new PriorityQueue((a: { id: string; distance: number }, b: { id: string; distance: number }) => {
      return b.distance - a.distance // Lower distance has higher priority
    })

    // Initialize all distances as infinity
    roadNetwork.forEach((node) => {
      distances[node.id] = Number.POSITIVE_INFINITY
      previous[node.id] = null
    })

    // Distance from start to start is 0
    distances[startNodeId] = 0
    queue.enq({ id: startNodeId, distance: 0 })

    // Main algorithm loop
    while (!queue.isEmpty()) {
      const current = queue.deq()

      // If we've reached the destination, we're done
      if (current.id === endNodeId) break

      // Skip if we've already processed this node
      if (visited.has(current.id)) continue
      visited.add(current.id)

      // Get the current node
      const currentNode = roadNetwork.find((node) => node.id === current.id)
      if (!currentNode) continue

      // Check all connections from current node
      for (const connection of currentNode.connections) {
        // Skip high-risk connections if avoiding flood areas
        if (avoidFloodAreas && connection.riskLevel === "high") continue

        // Apply risk multiplier to distance
        let riskMultiplier = 1
        if (connection.riskLevel === "medium") riskMultiplier = avoidFloodAreas ? 2 : 1
        if (connection.riskLevel === "low") riskMultiplier = avoidFloodAreas ? 1.5 : 1

        const distance = distances[current.id] + connection.distance * riskMultiplier

        // If we found a better path, update it
        if (distance < distances[connection.nodeId]) {
          distances[connection.nodeId] = distance
          previous[connection.nodeId] = current.id
          queue.enq({ id: connection.nodeId, distance })
        }
      }
    }

    // Reconstruct the path
    const path: string[] = []
    let current = endNodeId

    while (current && current !== startNodeId) {
      path.unshift(current)
      current = previous[current] || ""
    }

    if (path.length > 0 || startNodeId === endNodeId) {
      path.unshift(startNodeId)
    }

    // Convert path of node IDs to coordinates
    const pathCoordinates: [number, number][] = path.map((nodeId) => {
      const node = roadNetwork.find((n) => n.id === nodeId)
      return node ? node.coordinates : [0, 0]
    })

    return pathCoordinates
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshData()
    await loadMockData()
    setTimeout(() => setRefreshing(false), 1000)
  }

  const handleSendNotification = async (e: FormEvent) => {
    e.preventDefault()
    if (!notificationMessage.trim()) return

    setSendingNotification(true)
    try {
      await sendEmergencyBroadcast(
        notificationMessage,
        selectedDistrict !== "All Districts" ? selectedDistrict : undefined,
      )

      // Add to communications list
      const newCommunication: Communication = {
        id: `comm${communications.length + 1}`,
        title: notificationMessage,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        recipients: notificationRecipients === "All Recipients" ? "1,247" : "500",
        status: "Delivered",
      }

      setCommunications([newCommunication, ...communications])
      setNotificationMessage("")

      // Show success notification
      addAlert({
        title: "Notification Sent",
        message: `Your emergency notification has been sent to ${notificationRecipients}`,
        type: "success",
      })
    } catch (error) {
      console.error("Error sending notification:", error)

      // Show error notification
      addAlert({
        title: "Notification Failed",
        message: "There was an error sending your notification. Please try again.",
        type: "error",
      })
    } finally {
      setSendingNotification(false)
    }
  }

  const handleViewRouteDetails = (routeId: string) => {
    setShowRouteDetails(routeId)

    // Find the route
    const route = routes.find((r) => r.id === routeId)
    if (route) {
      // Center map on route
      const center: [number, number] = [
        (route.startPoint[0] + route.endPoint[0]) / 2,
        (route.startPoint[1] + route.endPoint[1]) / 2,
      ]
      setMapCenter(center)
      setMapZoom(12)

      // Calculate route
      if (mapRef.current) {
        // Remove existing routing control
        if (routingControl) {
          mapRef.current.removeControl(routingControl)
        }

        // Set color based on status
        const routeColor = route.status === "Open" ? "green" : route.status === "Warning" ? "orange" : "red"

        // Create new routing control with appropriate color
        const newRoutingControl = calculateRoute(mapRef.current, route.startPoint, route.endPoint, routeColor)

        setRoutingControl(newRoutingControl)
      }
    }
  }

  const handlePrintMap = () => {
    window.print()
  }

  const handleDownloadMap = () => {
    // In a real app, this would generate and download a map image
    addAlert({
      title: "Map Downloaded",
      message: "The map has been downloaded to your device.",
      type: "success",
    })
  }

  // Filter routes based on search and district
  const filteredRoutes = routes.filter((route) => {
    const matchesSearch =
      searchQuery === "" ||
      route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.district.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesDistrict = selectedDistrict === "All Districts" || route.district === selectedDistrict

    return matchesSearch && matchesDistrict
  })

  // Handle map click for custom routing
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    if (!customRoute.start) {
      setCustomRoute({
        start: [e.latlng.lat, e.latlng.lng],
        end: null,
      })

      // Show notification
      addAlert({
        title: "Start Point Selected",
        message: "Now click on the map to select your destination point.",
        type: "info",
      })
    } else if (!customRoute.end) {
      setCustomRoute({
        ...customRoute,
        end: [e.latlng.lat, e.latlng.lng],
      })

      // Calculate route
      if (mapRef.current && customRoute.start) {
        // Remove existing routing control
        if (routingControl) {
          mapRef.current.removeControl(routingControl)
        }

        // Create new routing control
        const newRoutingControl = calculateRoute(
          mapRef.current,
          customRoute.start,
          [e.latlng.lat, e.latlng.lng],
          "blue",
        )

        setRoutingControl(newRoutingControl)

        // Show notification
        addAlert({
          title: "Route Calculated",
          message: "Your custom route has been calculated. You can click on the map again to create a new route.",
          type: "success",
        })
      }
    } else {
      // Reset and start new route
      setCustomRoute({
        start: [e.latlng.lat, e.latlng.lng],
        end: null,
      })

      // Show notification
      addAlert({
        title: "New Route Started",
        message: "Now click on the map to select your destination point.",
        type: "info",
      })
    }
  }

  // Calculate route between two points
  const calculateRoute = (
    map: L.Map,
    start: [number, number],
    end: [number, number],
    color = "blue",
  ): L.Routing.Control => {
    // Create custom line style based on route color
    const createPlan = () =>
      L.Routing.plan([L.latLng(start), L.latLng(end)], {
        createMarker: (i, waypoint, n) => {
          const marker = L.marker(waypoint.latLng, {
            draggable: true,
            icon: L.icon({
              iconUrl:
                i === 0
                  ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png"
                  : "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
              shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41],
            }),
          })
          return marker
        },
      })

    // Create routing control with custom styling
    const routingControl = L.Routing.control({
      plan: createPlan(),
      lineOptions: {
        styles: [
          { color: color, opacity: 0.8, weight: 6 },
          { color: "white", opacity: 0.3, weight: 2 },
        ],
        addWaypoints: false,
      },
      router: L.Routing.osrmv1({
        serviceUrl: "https://router.project-osrm.org/route/v1",
        profile: "driving",
      }),
      collapsible: true,
      fitSelectedRoutes: true,
      showAlternatives: false,
      altLineOptions: {
        styles: [
          { color: "black", opacity: 0.15, weight: 9 },
          { color: "white", opacity: 0.8, weight: 6 },
          { color: "blue", opacity: 0.5, weight: 2 },
        ],
      },
    }).addTo(map)

    // Hide the routing instructions
    const container = routingControl.getContainer()
    if (container) {
      container.style.display = "none"
    }

    return routingControl
  }

  // Generate multiple route options with different risk levels
  const generateMultipleRoutes = (map: L.Map, start: [number, number], end: [number, number]) => {
    // Clear existing routes
    if (riskRoutes.high) map.removeLayer(riskRoutes.high)
    if (riskRoutes.medium) map.removeLayer(riskRoutes.medium)
    if (riskRoutes.low) map.removeLayer(riskRoutes.low)

    // Generate three different routes with varying risk levels
    const routes = [
      {
        risk: "high",
        color: "red",
        waypoints: [start, [(start[0] + end[0]) / 2 + 0.05, (start[1] + end[1]) / 2 + 0.05], end],
      },
      {
        risk: "medium",
        color: "orange",
        waypoints: [start, [(start[0] + end[0]) / 2 - 0.02, (start[1] + end[1]) / 2], end],
      },
      {
        risk: "low",
        color: "green",
        waypoints: [start, [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2 - 0.05], end],
      },
    ]

    // Draw all routes with their respective colors
    const newRiskRoutes = {
      high: null as L.Polyline | null,
      medium: null as L.Polyline | null,
      low: null as L.Polyline | null,
    }

    routes.forEach((route) => {
      // Create polylines for each route with appropriate color
      const polyline = L.polyline(route.waypoints as L.LatLngExpression[], {
        color: route.color,
        weight: route.risk === "high" ? 3 : route.risk === "medium" ? 4 : 5,
        opacity: 0.8,
        dashArray: route.risk === "high" ? "5, 10" : route.risk === "medium" ? "5, 5" : undefined,
      }).addTo(map)

      // Add popup to show risk level when clicked
      polyline.bindPopup(`<b>${route.risk.charAt(0).toUpperCase() + route.risk.slice(1)} Risk Route</b>`)

      // Store the polyline reference
      if (route.risk === "high") newRiskRoutes.high = polyline
      else if (route.risk === "medium") newRiskRoutes.medium = polyline
      else newRiskRoutes.low = polyline
    })

    setRiskRoutes(newRiskRoutes)
    return newRiskRoutes
  }

  const calculateSafeRoute = (e: FormEvent) => {
    e.preventDefault()

    if (!fromLocation.trim() || !toLocation.trim()) {
      addAlert({
        title: "Missing Information",
        message: "Please enter both starting point and destination",
        type: "error",
      })
      return
    }

    // Find coordinates for the locations
    const fromDistrict = tamilNaduDistricts.find((d) => d.name.toLowerCase().includes(fromLocation.toLowerCase()))
    const toDistrict = tamilNaduDistricts.find((d) => d.name.toLowerCase().includes(toLocation.toLowerCase()))

    if (fromDistrict && toDistrict) {
      // Remove existing routing control
      if (routingControl && mapRef.current) {
        mapRef.current.removeControl(routingControl)
      }

      // Clear existing risk routes
      if (mapRef.current) {
        if (riskRoutes.high) mapRef.current.removeLayer(riskRoutes.high)
        if (riskRoutes.medium) mapRef.current.removeLayer(riskRoutes.medium)
        if (riskRoutes.low) mapRef.current.removeLayer(riskRoutes.low)
      }

      // Calculate shortest path using Dijkstra's algorithm
      const pathCoordinates = findShortestPath(fromDistrict.name, toDistrict.name, avoidFloodZones)
      setShortestPath(pathCoordinates)

      if (mapRef.current && pathCoordinates.length > 0) {
        // Draw the shortest path
        const shortestPathPolyline = L.polyline(pathCoordinates, {
          color: "blue",
          weight: 5,
          opacity: 0.8,
          dashArray: undefined,
        }).addTo(mapRef.current)

        shortestPathPolyline.bindPopup("<b>Shortest Safe Route</b><br>Calculated using Dijkstra's algorithm")

        // Also generate alternative routes with different risk levels for comparison
        generateMultipleRoutes(mapRef.current, fromDistrict.coordinates, toDistrict.coordinates)

        // Add markers for start and end points
        const startMarker = L.marker(fromDistrict.coordinates, {
          icon: L.icon({
            iconUrl:
              "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
            shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
          }),
        }).addTo(mapRef.current)

        const endMarker = L.marker(toDistrict.coordinates, {
          icon: L.icon({
            iconUrl:
              "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
            shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
          }),
        }).addTo(mapRef.current)

        startMarker.bindPopup(`<b>Start: ${fromLocation}</b>`)
        endMarker.bindPopup(`<b>Destination: ${toLocation}</b>`)

        // Center map between the two points
        const centerLat = (fromDistrict.coordinates[0] + toDistrict.coordinates[0]) / 2
        const centerLng = (fromDistrict.coordinates[1] + toDistrict.coordinates[1]) / 2
        setMapCenter([centerLat, centerLng])
        setMapZoom(11)
      }

      setShowRouteRisk(true)

      addAlert({
        title: "Safe Route Calculated",
        message: `Shortest safe route from ${fromLocation} to ${toLocation} calculated using Dijkstra's algorithm`,
        type: "success",
      })
    } else {
      addAlert({
        title: "Location Not Found",
        message: "One or both locations could not be found. Try using district names in Tamil Nadu.",
        type: "warning",
      })
    }
  }

  if (isLoading) {
    return <LoadingSpinner fullScreen />
  }

  return (
    <div className="p-4 md:p-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => (
          <div key={index} className={`bg-white rounded-xl p-4 md:p-6 shadow-sm border ${stat.className}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">{stat.title}</p>
                <h3 className="text-2xl md:text-3xl font-bold mt-2">{stat.value}</h3>
              </div>
              <div className="bg-gray-50 p-3 rounded-full">{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Routes List and Map */}
        <div className="lg:col-span-2 space-y-6">
          {/* Map Controls */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setMapType(mapType === "street" ? "satellite" : "street")}
                    className={`px-4 py-2 rounded-lg ${
                      mapType === "street" ? "bg-blue-50 text-blue-600" : "text-gray-600"
                    }`}
                  >
                    {mapType === "street" ? "Street View" : "Satellite View"}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRefresh}
                    className={`p-2 text-gray-600 hover:bg-gray-100 rounded-lg ${refreshing ? "animate-spin" : ""}`}
                    disabled={refreshing}
                  >
                    <RefreshCw size={20} />
                  </button>
                  <button onClick={handlePrintMap} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Printer size={20} />
                  </button>
                  <button onClick={handleDownloadMap} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Download size={20} />
                  </button>
                </div>
              </div>

              {/* From/To Route Finder */}
              <form onSubmit={calculateSafeRoute} className="border-t pt-4 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label htmlFor="fromLocation" className="block text-sm font-medium text-gray-700 mb-1">
                      From
                    </label>
                    <input
                      id="fromLocation"
                      type="text"
                      value={fromLocation}
                      onChange={(e) => setFromLocation(e.target.value)}
                      placeholder="Enter starting point"
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="toLocation" className="block text-sm font-medium text-gray-700 mb-1">
                      To
                    </label>
                    <input
                      id="toLocation"
                      type="text"
                      value={toLocation}
                      onChange={(e) => setToLocation(e.target.value)}
                      placeholder="Enter destination"
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    id="avoidFloodZones"
                    type="checkbox"
                    checked={avoidFloodZones}
                    onChange={(e) => setAvoidFloodZones(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="avoidFloodZones" className="text-sm font-medium text-gray-700">
                    Avoid flood-affected areas
                  </label>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    {showRouteRisk && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Risk Level:</span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            routeRiskLevel === "high"
                              ? "bg-red-100 text-red-600"
                              : routeRiskLevel === "medium"
                                ? "bg-orange-100 text-orange-600"
                                : "bg-green-100 text-green-600"
                          }`}
                        >
                          {routeRiskLevel === "high"
                            ? "High Risk"
                            : routeRiskLevel === "medium"
                              ? "Medium Risk"
                              : "Low Risk"}
                        </span>
                      </div>
                    )}
                  </div>
                  <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
                    Find Safe Route
                  </button>
                </div>
              </form>

              {/* Risk Level Legend */}
              {showRouteRisk && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-sm font-medium mb-2">Route Risk Levels:</p>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-red-500"></div>
                      <span className="text-xs font-medium">High Risk - Avoid</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                      <span className="text-xs font-medium">Medium Risk - Caution</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-green-500"></div>
                      <span className="text-xs font-medium">Low Risk - Safe</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Map Area */}
          <div className="bg-gray-100 h-[500px] rounded-lg relative overflow-hidden">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: "100%", width: "100%" }}
              zoomControl={false}
              whenCreated={(map) => {
                mapRef.current = map
                map.on("click", handleMapClick)
              }}
            >
              <ChangeView center={mapCenter} zoom={mapZoom} />

              {/* Base map layer */}
              {mapType === "street" ? (
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              ) : (
                <TileLayer
                  attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              )}

              {/* Flood zones */}
              {showFloodZones &&
                floodZones.map((zone) => (
                  <Polygon
                    key={zone.id}
                    positions={zone.coordinates}
                    pathOptions={{
                      color: zone.riskLevel === "high" ? "red" : zone.riskLevel === "medium" ? "orange" : "yellow",
                      fillColor: zone.riskLevel === "high" ? "red" : zone.riskLevel === "medium" ? "orange" : "yellow",
                      fillOpacity: 0.3,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-medium">{zone.name}</h3>
                        <p className="text-sm text-gray-600">
                          Risk Level: {zone.riskLevel.charAt(0).toUpperCase() + zone.riskLevel.slice(1)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {zone.riskLevel === "high"
                            ? "Avoid this area - severe flooding"
                            : zone.riskLevel === "medium"
                              ? "Proceed with caution - moderate flooding"
                              : "Minor flooding - safe for most vehicles"}
                        </p>
                      </div>
                    </Popup>
                  </Polygon>
                ))}

              {/* Shortest path from Dijkstra's algorithm */}
              {showShortestPath && shortestPath && shortestPath.length > 1 && (
                <Polyline
                  positions={shortestPath}
                  pathOptions={{
                    color: "blue",
                    weight: 5,
                    opacity: 0.8,
                  }}
                >
                  <Popup>
                    <div className="p-2">
                      <h3 className="font-medium">Shortest Safe Route</h3>
                      <p className="text-sm text-gray-600">Calculated using Dijkstra's algorithm</p>
                      <p className="text-sm text-gray-500">
                        {avoidFloodZones
                          ? "Avoiding flood-affected areas"
                          : "Warning: This route may pass through flood zones"}
                      </p>
                    </div>
                  </Popup>
                </Polyline>
              )}

              {/* Route markers and lines */}
              {filteredRoutes.map((route) => (
                <div key={route.id}>
                  <Marker position={route.startPoint}>
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-medium">Start: {route.name}</h3>
                        <p className="text-sm text-gray-600">Status: {route.status}</p>
                        <p className="text-sm text-gray-500">Updated: {route.updated}</p>
                        <button
                          onClick={() => handleViewRouteDetails(route.id)}
                          className="mt-2 text-blue-500 text-sm hover:underline"
                        >
                          View Route Details
                        </button>
                      </div>
                    </Popup>
                  </Marker>

                  <Marker position={route.endPoint}>
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-medium">End: {route.name}</h3>
                        <p className="text-sm text-gray-600">Status: {route.status}</p>
                      </div>
                    </Popup>
                  </Marker>

                  {showRoads && (
                    <Polyline
                      positions={[route.startPoint, route.endPoint]}
                      pathOptions={{
                        color: route.status === "Open" ? "green" : route.status === "Warning" ? "orange" : "red",
                        weight: 3,
                        opacity: route.status === "Closed" ? 0.5 : 1,
                        dashArray: route.status === "Warning" ? "10, 10" : undefined,
                      }}
                    />
                  )}
                </div>
              ))}

              {/* User location marker */}
              {userLocation && (
                <Marker
                  position={[userLocation.lat, userLocation.lng]}
                  icon={
                    new L.Icon({
                      iconUrl:
                        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
                      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
                      iconSize: [25, 41],
                      iconAnchor: [12, 41],
                      popupAnchor: [1, -34],
                      shadowSize: [41, 41],
                    })
                  }
                >
                  <Popup>
                    <div className="p-1">
                      <p className="font-medium">Your Location</p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Custom route markers */}
              {customRoute.start && (
                <Marker
                  position={customRoute.start}
                  icon={
                    new L.Icon({
                      iconUrl:
                        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
                      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
                      iconSize: [25, 41],
                      iconAnchor: [12, 41],
                      popupAnchor: [1, -34],
                      shadowSize: [41, 41],
                    })
                  }
                >
                  <Popup>
                    <div className="p-1">
                      <p className="font-medium">Start Point</p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {customRoute.end && (
                <Marker
                  position={customRoute.end}
                  icon={
                    new L.Icon({
                      iconUrl:
                        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
                      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
                      iconSize: [25, 41],
                      iconAnchor: [12, 41],
                      popupAnchor: [1, -34],
                      shadowSize: [41, 41],
                    })
                  }
                >
                  <Popup>
                    <div className="p-1">
                      <p className="font-medium">End Point</p>
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>

            {/* Map Controls */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
              <button
                onClick={() => setFullScreenMap(!fullScreenMap)}
                className="bg-white p-2 rounded-lg shadow-md hover:bg-gray-100"
                title={fullScreenMap ? "Exit Full Screen" : "Full Screen"}
              >
                {fullScreenMap ? <X size={20} /> : <MapIcon size={20} />}
              </button>

              <button
                onClick={() => setShowLayers(!showLayers)}
                className="bg-white p-2 rounded-lg shadow-md hover:bg-gray-100"
                title="Map Layers"
              >
                <Layers size={20} />
              </button>

              {userLocation && (
                <button
                  onClick={() => {
                    setMapCenter([userLocation.lat, userLocation.lng])
                    setMapZoom(15)
                  }}
                  className="bg-white p-2 rounded-lg shadow-md hover:bg-gray-100"
                  title="Go to My Location"
                >
                  <MapPin size={20} />
                </button>
              )}
            </div>

            {/* Map Layers Panel */}
            {showLayers && (
              <div className="absolute top-4 left-4 z-10 bg-white p-3 rounded-lg shadow-md">
                <h3 className="font-medium mb-2">Map Layers</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showFloodZones}
                      onChange={() => setShowFloodZones(!showFloodZones)}
                      className="rounded"
                    />
                    <span>Flood Zones</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showShelters}
                      onChange={() => setShowShelters(!showShelters)}
                      className="rounded"
                    />
                    <span>Shelters</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showRoads}
                      onChange={() => setShowRoads(!showRoads)}
                      className="rounded"
                    />
                    <span>Safe Routes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showShortestPath}
                      onChange={() => setShowShortestPath(!showShortestPath)}
                      className="rounded"
                    />
                    <span>Shortest Path</span>
                  </label>
                </div>
              </div>
            )}

            {/* Map Instructions */}
            <div className="absolute bottom-4 left-4 z-10 bg-white p-3 rounded-lg shadow-md max-w-xs">
              <h3 className="font-medium mb-1">Create Custom Route</h3>
              <p className="text-sm text-gray-600">
                {!customRoute.start
                  ? "Click on the map to set your starting point"
                  : !customRoute.end
                    ? "Now click to set your destination"
                    : "Route created! Click again to start a new route"}
              </p>
            </div>
          </div>

          {/* Active Routes */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Active Routes</h2>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <input
                    type="text"
                    placeholder="Search routes..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                </div>
                <select
                  className="p-2 border rounded-lg"
                  value={selectedDistrict}
                  onChange={(e) => {
                    setSelectedDistrict(e.target.value)
                    // If a specific district is selected, find its coordinates and center the map
                    if (e.target.value !== "All Districts") {
                      const district = tamilNaduDistricts.find((d) => d.name === e.target.value)
                      if (district) {
                        setMapCenter(district.coordinates)
                        setMapZoom(11)
                      }
                    } else {
                      // Reset to Tamil Nadu center
                      setMapCenter([11.1271, 78.6569])
                      setMapZoom(7)
                    }
                  }}
                >
                  <option>All Districts</option>
                  {tamilNaduDistricts.map((district) => (
                    <option key={district.name}>{district.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="divide-y max-h-[300px] overflow-y-auto">
              {filteredRoutes.length > 0 ? (
                filteredRoutes.map((route) => (
                  <div key={route.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <h3 className="font-medium">{route.name}</h3>
                      <p className="text-sm text-gray-500">Updated {route.updated}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-medium ${route.statusColor}`}>{route.status}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewRouteDetails(route.id)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="View Details"
                        >
                          <Info size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setMapCenter(route.startPoint)
                            setMapZoom(14)
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Navigate"
                        >
                          <Navigation size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500">No routes match your search criteria</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Updates and Communications */}
        <div className="space-y-6">
          {/* Push Notifications */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-xl font-semibold mb-4">Push Notifications</h2>
            <form onSubmit={handleSendNotification} className="space-y-4">
              <textarea
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                placeholder="Enter notification message..."
                className="w-full p-3 border rounded-lg h-32"
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <select
                  className="p-2 border rounded-lg"
                  value={notificationRecipients}
                  onChange={(e) => setNotificationRecipients(e.target.value)}
                >
                  <option>All Recipients</option>
                  <option>Affected Areas Only</option>
                  <option>Emergency Personnel</option>
                </select>
                <select
                  className="p-2 border rounded-lg"
                  value={notificationPriority}
                  onChange={(e) => setNotificationPriority(e.target.value as any)}
                >
                  <option>High Priority</option>
                  <option>Medium Priority</option>
                  <option>Low Priority</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-500 text-white py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-600 disabled:opacity-50"
                disabled={!notificationMessage.trim() || sendingNotification}
              >
                {sendingNotification ? (
                  <>
                    <LoadingSpinner size="sm" color="white" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    <span>Send Notification</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Recent Updates */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-xl font-semibold mb-4">Recent Updates</h2>
            <div className="space-y-4">
              {updates.map((update) => (
                <div key={update.id} className="border-l-4 border-l-blue-500 pl-4 py-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{update.title}</h3>
                      <p className="text-sm text-gray-500">{update.description}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        update.severity === "High"
                          ? "bg-red-100 text-red-600"
                          : update.severity === "Medium"
                            ? "bg-orange-100 text-orange-600"
                            : "bg-green-100 text-green-600"
                      }`}
                    >
                      {update.severity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{update.time}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Communications */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-xl font-semibold mb-4">Recent Communications</h2>
            <div className="space-y-4">
              {communications.map((comm, index) => (
                <div key={comm.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                  <h3 className="font-medium">{comm.title}</h3>
                  <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
                    <span>{comm.time}</span>
                    <span>{comm.recipients} recipients</span>
                    <span className="text-green-500">{comm.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Route Details Modal */}
      {showRouteDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Route Details</h3>
              <button onClick={() => setShowRouteDetails(null)} className="p-1 rounded-full hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>

            {routes.find((r) => r.id === showRouteDetails) && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Route Name</h4>
                  <p className="font-medium">{routes.find((r) => r.id === showRouteDetails)?.name}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500">District</h4>
                  <p>{routes.find((r) => r.id === showRouteDetails)?.district}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500">Status</h4>
                  <p className={routes.find((r) => r.id === showRouteDetails)?.statusColor}>
                    {routes.find((r) => r.id === showRouteDetails)?.status}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500">Last Updated</h4>
                  <p>{routes.find((r) => r.id === showRouteDetails)?.updated}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500">Traffic Conditions</h4>
                  <p>
                    {routes.find((r) => r.id === showRouteDetails)?.status === "Open"
                      ? "Clear traffic, route is fully operational"
                      : routes.find((r) => r.id === showRouteDetails)?.status === "Warning"
                        ? "Heavy traffic, expect delays"
                        : "Route closed due to flooding"}
                  </p>
                </div>

                <div className="pt-4 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      // Share route information
                      const route = routes.find((r) => r.id === showRouteDetails)
                      if (route) {
                        addAlert({
                          title: "Route Shared",
                          message: `You've shared information about ${route.name}`,
                          type: "info",
                        })
                      }
                      setShowRouteDetails(null)
                    }}
                    className="px-4 py-2 border rounded-lg"
                  >
                    Share
                  </button>
                  <button
                    onClick={() => {
                      // Navigate to route
                      const route = routes.find((r) => r.id === showRouteDetails)
                      if (route) {
                        setMapCenter(route.startPoint)
                        setMapZoom(14)

                        // Add to recent updates
                        const newUpdate: Update = {
                          id: `update${updates.length + 1}`,
                          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                          title: `Navigation to ${route.name}`,
                          description: `Navigation started to ${route.district} via ${route.name}`,
                          severity: "Low",
                        }
                        setUpdates([newUpdate, ...updates])
                      }
                      setShowRouteDetails(null)
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2"
                  >
                    <Navigation size={16} />
                    <span>Navigate</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

