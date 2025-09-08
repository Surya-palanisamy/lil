"use client";
import React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Search,
  Info,
  Navigation2,
  RefreshCw,
  X,
  Maximize2,
  Minimize2,
  MapPin,
  AlertTriangle,
  MapIcon,
  Layers,
  TowerControlIcon as Tower,
  Droplets,
  ArrowUp,
  Route,
  Home,
  BarChart3,
  Check,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";
import LoadingSpinner from "../components/LoadingSpinner";
import * as MapService from "../services/mapService";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Polyline } from "react-leaflet";
import {
  findSafeRoute,
  type RouteInstructions,
  formatDistance,
  formatDuration,
} from "../services/routingservice";

// Fix for default marker icons in react-leaflet
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import tower from "../../public/images/tower.png";
import newRoad from "../../public/images/new-road.png";
import blockedRoad from "../../public/images/p-2.png";
import shelter from "../../public/images/shelter.png";
import sjf from "../../public/images/sjf.png";

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom icons for blocked roads and shelters
const blockedRoadIcon = new L.Icon({
  iconUrl: blockedRoad,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const shelterIcon = new L.Icon({
  iconUrl: shelter,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

interface Alert {
  id: string;
  type: string;
  location: string;
  district: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  time: string;
  coordinates: [number, number];
  description: string;
}

interface FloodData {
  area: string;
  currentWaterLevel: number;
  predictedWaterLevel: number;
  rainfall: number;
  riskLevel: "Critical" | "High" | "Medium" | "Low";
  safeRoutes: string[];
  nearbyShelters: {
    name: string;
    distance: string;
    capacity: string;
    coordinates: [number, number];
    isOutsideFloodZone: boolean;
  }[];
  lastUpdated: string;
}

// Component to update map view when center changes
function ChangeView({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function MapView() {
  const { isLoading, refreshData, mapAlerts, addAlert, userLocation } =
    useAppContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("All Districts");
  const [selectedLocality, setSelectedLocality] = useState("All Localities");
  const [selectedSeverity, setSelectedSeverity] = useState<string[]>([
    "High",
    "Critical",
  ]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAlertDetails, setShowAlertDetails] = useState<string | null>(null);
  const [fullScreenMap, setFullScreenMap] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    13.0827, 80.2707,
  ]); // Chennai center
  const [mapZoom, setMapZoom] = useState(12);
  const [mapType, setMapType] = useState<"street" | "satellite">("street");
  const [showLayers, setShowLayers] = useState(false);
  const [showFloodZones, setShowFloodZones] = useState(true);
  const [showShelters, setShowShelters] = useState(true);
  const [showRoads, setShowRoads] = useState(true);
  const [floodZones, setFloodZones] = useState<
    { coordinates: [number, number][]; severity: string; name: string }[]
  >([]);
  const [blockedRoads, setBlockedRoads] = useState<
    {
      coordinates: [number, number][];
      status: "blocked" | "damaged" | "demolished";
    }[]
  >([]);
  const [sensorLocations, setSensorLocations] = useState<
    {
      id: string;
      coordinates: [number, number];
      status: "active" | "warning" | "offline";
    }[]
  >([]);
  const [showSensors, setShowSensors] = useState(true);
  const [showBlockedRoads, setShowBlockedRoads] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<FloodData | null>(
    null
  );
  const [floodData, setFloodData] = useState<FloodData[]>([]);
  const [activeRoute, setActiveRoute] = useState<RouteInstructions | null>(
    null
  );
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [showNavigationPanel, setShowNavigationPanel] = useState(false);
  const [navigationDestination, setNavigationDestination] = useState<
    string | null
  >(null);
  const mapRef = useRef<L.Map | null>(null);
  const [multipleRouteOptions, setMultipleRouteOptions] = useState<{
    routes: RouteInstructions[];
    destination: string;
    destinationCoords: [number, number];
  } | null>(null);

  // Set alerts from context
  useEffect(() => {
    if (mapAlerts.length > 0) {
      setAlerts(mapAlerts);
    }
  }, [mapAlerts]);

  // Set user location as map center if available
  useEffect(() => {
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng]);
      setMapZoom(12);
    }
  }, [userLocation]);

  useEffect(() => {
    // Simulated flood zones data - in a real app, this would come from an API
    setFloodZones([
      {
        name: "Chennai Central",
        coordinates: [
          [13.0827, 80.2707],
          [13.0927, 80.2807],
          [13.0927, 80.2607],
          [13.0827, 80.2507],
          [13.0727, 80.2607],
          [13.0727, 80.2807],
        ],
        severity: "Critical",
      },
      {
        name: "T. Nagar",
        coordinates: [
          [13.0385, 80.2337],
          [13.0425, 80.2437],
          [13.0355, 80.2477],
          [13.0315, 80.2377],
        ],
        severity: "High",
      },
      {
        name: "Velachery",
        coordinates: [
          [12.9787, 80.218],
          [12.9827, 80.228],
          [12.9757, 80.232],
          [12.9717, 80.222],
        ],
        severity: "Medium",
      },
      {
        name: "Maduravoyal",
        coordinates: [
          [13.073, 80.164],
          [13.077, 80.174],
          [13.07, 80.178],
          [13.066, 80.168],
        ],
        severity: "Safe",
      },
      {
        name: "Sholinganallur",
        coordinates: [
          [12.8995, 80.2275],
          [12.9035, 80.2375],
          [12.8965, 80.2415],
          [12.8925, 80.2315],
        ],
        severity: "Medium",
      },

      {
        name: "Poonamallee",
        coordinates: [
          [13.0486, 80.1064],
          [13.0145, 80.1945],
          [13.0075, 80.1985],
          [13.0035, 80.1885],
        ],
        severity: "High",
      },

      {
        name: "Mylapore",
        coordinates: [
          [13.0335, 80.2697],
          [13.0375, 80.2797],
          [13.0305, 80.2837],
          [13.0265, 80.2737],
        ],
        severity: "Safe",
      },
      {
        name: "Besant Nagar",
        coordinates: [
          [12.998, 80.2635],
          [13.002, 80.2735],
          [12.995, 80.2775],
          [12.991, 80.2675],
        ],
        severity: "Safe",
      },
      {
        name: "Kundrathur",
        coordinates: [
          [12.982, 80.082],
          [12.986, 80.092],
          [12.979, 80.096],
          [12.975, 80.086],
        ],
        severity: "High",
      },
      {
        name: "Porur",
        coordinates: [
          [13.0336, 80.1581],
          [13.0295, 80.227],
          [13.0225, 80.231],
          [13.0185, 80.221],
        ],
        severity: "Medium",
      },
      {
        name: "Perambur",
        coordinates: [
          [13.1175, 80.23],
          [13.1215, 80.24],
          [13.1145, 80.244],
          [13.1105, 80.234],
        ],
        severity: "Critical",
      },
      {
        name: "Ambattur",
        coordinates: [
          [13.1075, 80.152],
          [13.1115, 80.162],
          [13.1045, 80.166],
          [13.1005, 80.156],
        ],
        severity: "Medium",
      },
      {
        name: "Tambaram",
        coordinates: [
          [12.9249, 80.1275],
          [12.9715, 80.155],
          [12.9645, 80.159],
          [12.9605, 80.149],
        ],
        severity: "High",
      },
      {
        name: "Mudichur",
        coordinates: [
          [12.9149, 80.0575],
          [12.9215, 80.0655],
          [12.9145, 80.0695],
          [12.9105, 80.0595],
        ],
        severity: "Critical",
      },
    ]);

    // Simulated blocked roads data
    setBlockedRoads([
      {
        coordinates: [
          [13.0875, 80.2102], // Anna Nagar to Villivakkam side
          [13.0915, 80.2202],
        ],
        status: "damaged",
      },

      {
        coordinates: [
          [13.0255, 80.217], // Saidapet
          [13.0295, 80.227],
        ],
        status: "demolished",
      },
      {
        coordinates: [
          [13.005, 80.218], // Guindy
          [13.009, 80.228],
        ],
        status: "damaged",
      },

      {
        coordinates: [
          [13.1116, 80.2164],
          // Perambur
          [13.1215, 80.24],
        ],
        status: "demolished",
      },
      {
        coordinates: [
          [13.0335, 80.2697], // Mylapore
          [13.0375, 80.2797],
        ],
        status: "blocked",
      },
      {
        coordinates: [
          [12.9675, 80.145], // Pallavaram
          [12.9715, 80.155],
        ],
        status: "damaged",
      },
    ]);

    // Updated sensor locations - only in Chennai areas
    setSensorLocations([
      { id: "sensor-1", coordinates: [13.0827, 80.2707], status: "active" }, // Chennai Central
      { id: "sensor-2", coordinates: [13.0385, 80.2337], status: "warning" }, // T. Nagar
      { id: "sensor-4", coordinates: [13.073, 80.164], status: "active" }, // Maduravoyal
      { id: "sensor-5", coordinates: [13.0336, 80.1581], status: "warning" }, // Anna Nagar
      { id: "sensor-6", coordinates: [13.0486, 80.1064], status: "active" }, // Ramapuram
      { id: "sensor-7", coordinates: [12.8995, 80.2275], status: "active" }, // Neelankarai
      { id: "sensor-15", coordinates: [13.0335, 80.2697], status: "active" }, // Neelankarai
      { id: "sensor-8", coordinates: [12.998, 80.2635], status: "active" }, // Besant Nagar
      { id: "sensor-9", coordinates: [12.9787, 80.218], status: "offline" }, // Pallikaranai
      { id: "sensor-10", coordinates: [12.9249, 80.1275], status: "warning" }, // Tambaram
      { id: "sensor-11", coordinates: [13.1175, 80.23], status: "active" }, // Perambur
      { id: "sensor-12", coordinates: [13.1075, 80.152], status: "active" }, // Ambattur
      { id: "sensor-13", coordinates: [12.9138, 80.0709], status: "warning" }, // Vandalur
      { id: "sensor-14", coordinates: [12.982, 80.082], status: "active" }, // Porur
    ]);

    // Simulated flood data for each area with shelter coordinates
    setFloodData([
      {
        area: "Chennai Central",
        currentWaterLevel: 2.8,
        predictedWaterLevel: 3.2,
        rainfall: 15.7,
        riskLevel: "Critical",
        safeRoutes: [
          "Via Poonamallee High Road",
          "Via Egmore Station Road",
          "Via EVR Periyar Salai",
        ],
        nearbyShelters: [
          {
            name: "Government Higher Secondary School",
            distance: "1.2 km",
            capacity: "250 people",
            coordinates: [13.0604, 80.276],
            isOutsideFloodZone: true,
          },
          {
            name: "Chennai Central Railway Station Hall",
            distance: "0.5 km",
            capacity: "500 people",
            coordinates: [13.063363, 80.281713],
            isOutsideFloodZone: false,
          },
          {
            name: "Ripon Building Shelter",
            distance: "0.8 km",
            capacity: "300 people",
            coordinates: [13.0714, 80.2417],
            isOutsideFloodZone: true,
          },
        ],
        lastUpdated: "10 minutes ago",
      },
      {
        area: "T. Nagar",
        currentWaterLevel: 1.9,
        predictedWaterLevel: 2.5,
        rainfall: 12.3,
        riskLevel: "High",
        safeRoutes: [
          "Via North Usman Road",
          "Via Venkatanarayana Road",
          "Via G.N. Chetty Road",
        ],
        nearbyShelters: [
          {
            name: "T. Nagar Bus Terminus",
            distance: "0.7 km",
            capacity: "200 people",
            coordinates: [13.04, 80.2387],
            isOutsideFloodZone: false,
          },
          {
            name: "Ramakrishna Mission School",
            distance: "1.5 km",
            capacity: "350 people",
            coordinates: [13.0425, 80.2387],
            isOutsideFloodZone: true,
          },
        ],
        lastUpdated: "15 minutes ago",
      },
      {
        area: "Velachery",
        currentWaterLevel: 1.5,
        predictedWaterLevel: 1.8,
        rainfall: 10.2,
        riskLevel: "Medium",
        safeRoutes: [
          "Via Velachery Main Road",
          "Via Taramani Link Road",
          "Via 100 Feet Bypass Road",
        ],
        nearbyShelters: [
          {
            name: "Phoenix Mall Parking Area",
            distance: "2.1 km",
            capacity: "400 people",
            coordinates: [12.9827, 80.218],
            isOutsideFloodZone: true,
          },
          {
            name: "Velachery MRTS Station",
            distance: "1.3 km",
            capacity: "250 people",
            coordinates: [12.9787, 80.218],
            isOutsideFloodZone: false,
          },
        ],
        lastUpdated: "20 minutes ago",
      },
      {
        area: "Adyar",
        currentWaterLevel: 0.8,
        predictedWaterLevel: 1.0,
        rainfall: 8.5,
        riskLevel: "Low",
        safeRoutes: [
          "Via LB Road",
          "Via Adyar Bridge",
          "Via Sardar Patel Road",
        ],
        nearbyShelters: [
          {
            name: "Adyar Depot Complex",
            distance: "1.0 km",
            capacity: "150 people",
            coordinates: [13.01667, 80.22722],
            isOutsideFloodZone: true,
          },
          {
            name: "Cancer Institute Campus",
            distance: "1.8 km",
            capacity: "200 people",
            coordinates: [12.9863, 80.2432],
            isOutsideFloodZone: true,
          },
        ],
        lastUpdated: "25 minutes ago",
      },
      {
        area: "Anna Nagar",
        currentWaterLevel: 1.4,
        predictedWaterLevel: 1.7,
        rainfall: 9.8,
        riskLevel: "Medium",
        safeRoutes: [
          "Via 2nd Avenue",
          "Via Shanthi Colony",
          "Via Thirumangalam Road",
        ],
        nearbyShelters: [
          {
            name: "Anna Nagar Tower Park",
            distance: "0.9 km",
            capacity: "300 people",
            coordinates: [13.0875, 80.2102],
            isOutsideFloodZone: false,
          },
          {
            name: "Ayyappan Temple Hall",
            distance: "1.2 km",
            capacity: "180 people",
            coordinates: [13.0915, 80.2102],
            isOutsideFloodZone: true,
          },
        ],
        lastUpdated: "18 minutes ago",
      },
      {
        area: "Kodambakkam",
        currentWaterLevel: 2.1,
        predictedWaterLevel: 2.4,
        rainfall: 13.5,
        riskLevel: "High",
        safeRoutes: [
          "Via Arcot Road",
          "Via Kodambakkam High Road",
          "Via Power House Road",
        ],
        nearbyShelters: [
          {
            name: "Kodambakkam Railway Station",
            distance: "0.6 km",
            capacity: "220 people",
            coordinates: [13.0515, 80.2255],
            isOutsideFloodZone: false,
          },
          {
            name: "Ripon Building Shelter",
            distance: "0.8 km",
            capacity: "300 people",
            coordinates: [13.0714, 80.2417],
            isOutsideFloodZone: true,
          },
        ],
        lastUpdated: "12 minutes ago",
      },
      {
        area: "Perambur",
        currentWaterLevel: 2.7,
        predictedWaterLevel: 3.1,
        rainfall: 14.9,
        riskLevel: "Critical",
        safeRoutes: [
          "Via Perambur High Road",
          "Via Paper Mills Road",
          "Via Stephenson Road",
        ],
        nearbyShelters: [
          {
            name: "Perambur Railway Station",
            distance: "0.4 km",
            capacity: "270 people",
            coordinates: [13.1175, 80.235],
            isOutsideFloodZone: false,
          },
          {
            name: "ICF Stadium",
            distance: "1.7 km",
            capacity: "450 people",
            coordinates: [13.1241, 80.2046],
            isOutsideFloodZone: true,
          },
        ],
        lastUpdated: "8 minutes ago",
      },
      {
        area: "Pallavaram",
        currentWaterLevel: 2.0,
        predictedWaterLevel: 2.3,
        rainfall: 11.8,
        riskLevel: "High",
        safeRoutes: [
          "Via GST Road",
          "Via Pallavaram-Thoraipakkam Road",
          "Via Airport Road",
        ],
        nearbyShelters: [
          {
            name: "Pallavaram Bus Terminus",
            distance: "0.8 km",
            capacity: "190 people",
            coordinates: [12.9675, 80.149],
            isOutsideFloodZone: false,
          },
          {
            name: "Cantonment Board Hall",
            distance: "1.4 km",
            capacity: "230 people",
            coordinates: [12.9715, 80.145],
            isOutsideFloodZone: true,
          },
        ],
        lastUpdated: "14 minutes ago",
      },
      {
        area: "Mudichur",
        currentWaterLevel: 3.1,
        predictedWaterLevel: 3.5,
        rainfall: 16.2,
        riskLevel: "Critical",
        safeRoutes: ["Via Mudichur Main Road", "Via Tambaram-Velachery Road"],
        nearbyShelters: [
          {
            name: "Mudichur Government School",
            distance: "0.6 km",
            capacity: "280 people",
            coordinates: [12.9149, 80.0575],
            isOutsideFloodZone: false,
          },
          {
            name: "Varadharaja Perumal Temple",
            distance: "1.2 km",
            capacity: "320 people",
            coordinates: [12.9215, 80.0655],
            isOutsideFloodZone: true,
          },
        ],
        lastUpdated: "5 minutes ago",
      },
      {
        area: "Poonamallee",
        currentWaterLevel: 2.3,
        predictedWaterLevel: 2.7,
        rainfall: 13.8,
        riskLevel: "High",
        safeRoutes: ["Via Poonamallee High Road", "Via Trunk Road"],
        nearbyShelters: [
          {
            name: "Poonamallee Bus Terminal",
            distance: "0.5 km",
            capacity: "210 people",
            coordinates: [13.0486, 80.1064],
            isOutsideFloodZone: false,
          },
          {
            name: "Government Hospital Grounds",
            distance: "1.1 km",
            capacity: "350 people",
            coordinates: [13.0145, 80.1945],
            isOutsideFloodZone: true,
          },
        ],
        lastUpdated: "11 minutes ago",
      },
      {
        area: "Kundrathur",
        currentWaterLevel: 2.2,
        predictedWaterLevel: 2.6,
        rainfall: 12.9,
        riskLevel: "High",
        safeRoutes: ["Via Kundrathur Main Road", "Via Kovur Road"],
        nearbyShelters: [
          {
            name: "Kundrathur Town Hall",
            distance: "0.7 km",
            capacity: "240 people",
            coordinates: [12.982, 80.082],
            isOutsideFloodZone: false,
          },
          {
            name: "Kundrathur Higher Secondary School",
            distance: "1.3 km",
            capacity: "380 people",
            coordinates: [12.986, 80.092],
            isOutsideFloodZone: true,
          },
        ],
        lastUpdated: "13 minutes ago",
      },
      {
        area: "Tambaram",
        currentWaterLevel: 2.1,
        predictedWaterLevel: 2.5,
        rainfall: 12.6,
        riskLevel: "High",
        safeRoutes: ["Via GST Road", "Via Tambaram-Velachery Road"],
        nearbyShelters: [
          {
            name: "Tambaram Railway Station",
            distance: "0.6 km",
            capacity: "260 people",
            coordinates: [12.9249, 80.1275],
            isOutsideFloodZone: false,
          },
          {
            name: "Tambaram Air Force Station",
            distance: "1.4 km",
            capacity: "420 people",
            coordinates: [12.9715, 80.155],
            isOutsideFloodZone: true,
          },
        ],
        lastUpdated: "12 minutes ago",
      },
      {
        area: "Sholinganallur",
        currentWaterLevel: 1.7,
        predictedWaterLevel: 2.0,
        rainfall: 11.3,
        riskLevel: "Medium",
        safeRoutes: ["Via OMR", "Via Sholinganallur-Medavakkam Road"],
        nearbyShelters: [
          {
            name: "Sholinganallur Community Hall",
            distance: "0.8 km",
            capacity: "230 people",
            coordinates: [12.8995, 80.2275],
            isOutsideFloodZone: false,
          },
          {
            name: "ELCOT IT Park",
            distance: "1.5 km",
            capacity: "500 people",
            coordinates: [12.9035, 80.2375],
            isOutsideFloodZone: true,
          },
        ],
        lastUpdated: "15 minutes ago",
      },
      {
        area: "Porur",
        currentWaterLevel: 1.8,
        predictedWaterLevel: 2.1,
        rainfall: 11.5,
        riskLevel: "Medium",
        safeRoutes: ["Via Mount-Poonamallee Road", "Via Porur Bypass"],
        nearbyShelters: [
          {
            name: "Porur Bus Terminus",
            distance: "0.7 km",
            capacity: "220 people",
            coordinates: [13.0336, 80.1581],
            isOutsideFloodZone: false,
          },
          {
            name: "Sri Ramachandra Medical College",
            distance: "1.6 km",
            capacity: "450 people",
            coordinates: [13.0295, 80.227],
            isOutsideFloodZone: true,
          },
        ],
        lastUpdated: "14 minutes ago",
      },
      {
        area: "Ambattur",
        currentWaterLevel: 1.6,
        predictedWaterLevel: 1.9,
        rainfall: 10.8,
        riskLevel: "Medium",
        safeRoutes: ["Via MTH Road", "Via Ambattur Industrial Estate Road"],
        nearbyShelters: [
          {
            name: "Ambattur OT Bus Stand",
            distance: "0.8 km",
            capacity: "210 people",
            coordinates: [13.1075, 80.152],
            isOutsideFloodZone: false,
          },
          {
            name: "Ambattur Government Hospital",
            distance: "1.4 km",
            capacity: "320 people",
            coordinates: [13.1115, 80.162],
            isOutsideFloodZone: true,
          },
        ],
        lastUpdated: "16 minutes ago",
      },
    ]);
  }, []);

  // Filter alerts based on search, district, and severity
  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch =
      searchQuery === "" ||
      alert.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.type.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDistrict =
      selectedDistrict === "All Districts" ||
      alert.district === selectedDistrict;

    const matchesSeverity = selectedSeverity.includes(alert.severity);

    return matchesSearch && matchesDistrict && matchesSeverity;
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleSeverityFilter = (severity: string) => {
    if (selectedSeverity.includes(severity)) {
      setSelectedSeverity(selectedSeverity.filter((s) => s !== severity));
    } else {
      setSelectedSeverity([...selectedSeverity, severity]);
    }
  };

  const handleViewAlertDetails = (alertId: string) => {
    setShowAlertDetails(alertId);

    // Find the alert
    const alert = alerts.find((a) => a.id === alertId);
    if (alert) {
      // Center map on alert
      setMapCenter(alert.coordinates);
      setMapZoom(15);
    }
  };

  const handleNavigateToAlert = (alertId: string) => {
    // Find the alert
    const alert = alerts.find((a) => a.id === alertId);
    if (!alert) {
      console.error("Alert not found:", alertId);
      return;
    }

    console.log("Navigating to alert:", alert);

    // Center map on alert
    setMapCenter(alert.coordinates);
    setMapZoom(16);

    // Calculate route to alert if user location is available
    if (userLocation) {
      calculateRoute(
        { lat: userLocation.lat, lng: userLocation.lng },
        { lat: alert.coordinates[0], lng: alert.coordinates[1] }
      );
      setNavigationDestination(alert.location);
    } else {
      addAlert({
        title: "Navigation Error",
        message:
          "Your location is required for navigation. Please enable location services.",
        type: "error",
      });
    }
  };

  const handleLocationClick = (areaName: string) => {
    const data = floodData.find((data) => data.area === areaName);
    if (data) {
      setSelectedLocation(data);

      // Find the corresponding flood zone to center the map
      const zone = floodZones.find((zone) => zone.name === areaName);
      if (zone && zone.coordinates.length > 0) {
        // Calculate center of polygon
        const lat =
          zone.coordinates.reduce((sum, coord) => sum + coord[0], 0) /
          zone.coordinates.length;
        const lng =
          zone.coordinates.reduce((sum, coord) => sum + coord[1], 0) /
          zone.coordinates.length;
        setMapCenter([lat, lng]);
        setMapZoom(15);
      }
    }
  };

  const handleNavigateViaSafeRoute = (routeName: string, areaName: string) => {
    if (!userLocation) {
      addAlert({
        title: "Navigation Error",
        message:
          "Your location is required for navigation. Please enable location services.",
        type: "error",
      });
      return;
    }

    // Find the area data
    const data = floodData.find((data) => data.area === areaName);
    if (!data) return;

    // Find a shelter to navigate to (preferably one outside the flood zone)
    const shelter =
      data.nearbyShelters.find((s) => s.isOutsideFloodZone) ||
      data.nearbyShelters[0];
    if (!shelter) return;

    // Calculate route to the shelter
    calculateRoute(
      { lat: userLocation.lat, lng: userLocation.lng },
      { lat: shelter.coordinates[0], lng: shelter.coordinates[1] }
    );
    setNavigationDestination(`${shelter.name} via ${routeName}`);
  };

  const calculateRoute = async (
    start: { lat: number; lng: number },
    end: { lat: number; lng: number }
  ) => {
    if (!userLocation) {
      addAlert({
        title: "Navigation Error",
        message:
          "Your location is required for navigation. Please enable location services.",
        type: "error",
      });
      return;
    }

    setIsCalculatingRoute(true);
    setActiveRoute(null);
    setShowNavigationPanel(false); // Reset navigation panel

    try {
      // Add a small delay to ensure the UI updates
      await new Promise((resolve) => setTimeout(resolve, 500));

      const route = await findSafeRoute(start, end, floodZones, blockedRoads);

      if (route) {
        console.log("Route calculated successfully:", route);
        setActiveRoute(route);

        // Ensure we show the navigation panel
        setTimeout(() => {
          setShowNavigationPanel(true);

          // Fit the map to show the entire route
          if (mapRef.current) {
            try {
              const routePoints: L.LatLngTuple[] = route.coordinates.map(
                (coord) => [coord[1], coord[0]] as L.LatLngTuple
              );
              const bounds = L.latLngBounds(routePoints);
              mapRef.current.fitBounds(bounds, { padding: [50, 50] });
            } catch (error) {
              console.error("Error fitting bounds:", error);
              // If fitting bounds fails, just center on the destination
              setMapCenter([end.lat, end.lng]);
              setMapZoom(14);
            }
          }

          addAlert({
            title: "Route Calculated",
            message: `Safe route found. Distance: ${formatDistance(
              route.distance
            )}, Duration: ${formatDuration(route.duration)}`,
            type: "success",
          });
        }, 500);
      } else {
        console.error("No route returned");
        addAlert({
          title: "Navigation Error",
          message:
            "Could not calculate a safe route. Using direct route instead.",
          type: "warning",
        });

        // Create a fallback direct route
        const fallbackRoute = {
          distance: calculateDistance(start.lat, start.lng, end.lat, end.lng),
          duration:
            (calculateDistance(start.lat, start.lng, end.lat, end.lng) / 30) *
            3600,
          steps: [
            {
              instruction: "Navigate to destination",
              distance: calculateDistance(
                start.lat,
                start.lng,
                end.lat,
                end.lng
              ),
              duration:
                (calculateDistance(start.lat, start.lng, end.lat, end.lng) /
                  30) *
                3600,
              coordinates: [end.lng, end.lat] as [number, number],
            },
          ],
          coordinates: [
            [start.lng, start.lat],
            [end.lng, end.lat],
          ] as [number, number][],
        };

        setActiveRoute(fallbackRoute);
        setShowNavigationPanel(true);
      }
    } catch (error) {
      console.error("Error calculating route:", error);
      addAlert({
        title: "Navigation Error",
        message:
          "An error occurred while calculating the route. Using direct route instead.",
        type: "error",
      });

      // Create a fallback direct route
      const fallbackRoute = {
        distance: calculateDistance(start.lat, start.lng, end.lat, end.lng),
        duration:
          (calculateDistance(start.lat, start.lng, end.lat, end.lng) / 30) *
          3600,
        steps: [
          {
            instruction: "Navigate to destination",
            distance: calculateDistance(start.lat, start.lng, end.lat, end.lng),
            duration:
              (calculateDistance(start.lat, start.lng, end.lat, end.lng) / 30) *
              3600,
            coordinates: [end.lng, end.lat] as [number, number],
          },
        ],
        coordinates: [
          [start.lng, start.lat],
          [end.lng, end.lat],
        ] as [number, number][],
      };

      setActiveRoute(fallbackRoute);
      setShowNavigationPanel(true);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const calculateMultipleRoutes = async (start: {
    lat: number;
    lng: number;
  }) => {
    if (!userLocation) {
      addAlert({
        title: "Navigation Error",
        message:
          "Your location is required for navigation. Please enable location services.",
        type: "error",
      });
      return;
    }

    setIsCalculatingRoute(true);
    setActiveRoute(null);
    setShowNavigationPanel(false);
    setMultipleRouteOptions(null);

    try {
      // Find the flood zone the user is in
      const userFloodZone = floodZones.find((zone) => {
        // Simple point-in-polygon check (this is a simplified version)
        // In a real app, you would use a proper point-in-polygon algorithm
        const centerLat =
          zone.coordinates.reduce((sum, coord) => sum + coord[0], 0) /
          zone.coordinates.length;
        const centerLng =
          zone.coordinates.reduce((sum, coord) => sum + coord[1], 0) /
          zone.coordinates.length;
        const distance = calculateDistance(
          start.lat,
          start.lng,
          centerLat,
          centerLng
        );
        return distance < 0.01; // Approximately 1km radius
      });

      if (!userFloodZone) {
        addAlert({
          title: "Navigation Info",
          message:
            "You are not in a flood risk zone. Calculating routes to nearest shelters.",
          type: "info",
        });
      }

      // Get all shelters, prioritizing those outside flood zones
      const allShelters = floodData
        .flatMap((data) =>
          data.nearbyShelters.map((shelter) => ({
            ...shelter,
            areaName: data.area,
          }))
        )
        .sort((a, b) => {
          // Sort by outside flood zone first, then by distance
          if (a.isOutsideFloodZone && !b.isOutsideFloodZone) return -1;
          if (!a.isOutsideFloodZone && b.isOutsideFloodZone) return 1;

          // Parse the distance strings to get numerical values
          const distA = Number.parseFloat(a.distance.split(" ")[0]);
          const distB = Number.parseFloat(b.distance.split(" ")[0]);
          return distA - distB;
        });

      // Take the 3 closest shelters that are preferably outside flood zones
      const closestShelters = allShelters.slice(0, 3);

      if (closestShelters.length === 0) {
        addAlert({
          title: "Navigation Error",
          message: "No shelters found in the database.",
          type: "error",
        });
        setIsCalculatingRoute(false);
        return;
      }

      // Calculate routes to each shelter
      const routePromises = closestShelters.map((shelter) =>
        findSafeRoute(
          start,
          { lat: shelter.coordinates[0], lng: shelter.coordinates[1] },
          floodZones,
          blockedRoads
        ).then((route) => ({
          route,
          shelter,
        }))
      );

      const routeResults = await Promise.all(routePromises);

      // Filter out any failed routes
      const validRoutes = routeResults.filter(
        (result) => result.route !== null
      );

      if (validRoutes.length === 0) {
        // If no routes to shelters, calculate exit route from flood zone
        if (userFloodZone) {
          addAlert({
            title: "Navigation Alert",
            message:
              "No direct routes to shelters available. Calculating safest exit route from flood zone.",
            type: "warning",
          });

          // Find exit point from flood zone
          const exitPoint = findSafeExitPoint(userFloodZone.coordinates, start);

          const exitRoute = await findSafeRoute(
            start,
            { lat: exitPoint[0], lng: exitPoint[1] },
            floodZones,
            blockedRoads
          );

          if (exitRoute) {
            setActiveRoute(exitRoute);
            setShowNavigationPanel(true);
            setNavigationDestination("Safe exit from flood zone");

            addAlert({
              title: "Exit Route Calculated",
              message: `Follow this route to safely exit the flood risk area. Distance: ${formatDistance(
                exitRoute.distance
              )}`,
              type: "success",
            });
          }
        } else {
          addAlert({
            title: "Navigation Error",
            message: "Could not calculate any safe routes to shelters.",
            type: "error",
          });
        }
      } else {
        // Show multiple route options
        setMultipleRouteOptions({
          routes: validRoutes.map((r) => r.route),
          destination: validRoutes[0].shelter.name,
          destinationCoords: validRoutes[0].shelter.coordinates,
        });

        // Set the first route as active
        setActiveRoute(validRoutes[0].route);
        setShowNavigationPanel(true);
        setNavigationDestination(validRoutes[0].shelter.name);

        addAlert({
          title: "Multiple Routes Available",
          message: `${validRoutes.length} safe routes calculated to nearby shelters.`,
          type: "success",
        });
      }
    } catch (error) {
      console.error("Error calculating multiple routes:", error);
      addAlert({
        title: "Navigation Error",
        message: "An error occurred while calculating routes to shelters.",
        type: "error",
      });
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Add a function to find a safe exit point from a flood zone
  const findSafeExitPoint = (
    floodZoneCoordinates: [number, number][],
    userLocation: { lat: number; lng: number }
  ): [number, number] => {
    // Calculate the center of the flood zone
    const centerLat =
      floodZoneCoordinates.reduce((sum, coord) => sum + coord[0], 0) /
      floodZoneCoordinates.length;
    const centerLng =
      floodZoneCoordinates.reduce((sum, coord) => sum + coord[1], 0) /
      floodZoneCoordinates.length;

    // Find the edge point of the flood zone that's closest to the user
    let closestEdgePoint: [number, number] | null = null;
    let minDistance = Number.MAX_VALUE;

    for (let i = 0; i < floodZoneCoordinates.length; i++) {
      const point = floodZoneCoordinates[i];
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        point[0],
        point[1]
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestEdgePoint = point;
      }
    }

    if (!closestEdgePoint) {
      // Fallback: move away from center
      const angle = Math.random() * 2 * Math.PI;
      const distance = 0.01; // ~1km
      return [
        userLocation.lat + Math.sin(angle) * distance,
        userLocation.lng + Math.cos(angle) * distance,
      ];
    }

    // Move slightly beyond the edge point (away from center)
    const vectorX = closestEdgePoint[0] - centerLat;
    const vectorY = closestEdgePoint[1] - centerLng;
    const magnitude = Math.sqrt(vectorX * vectorX + vectorY * vectorY);

    // Normalize and extend by 500m (~0.005 degrees)
    const safeExitLat = closestEdgePoint[0] + (vectorX / magnitude) * 0.005;
    const safeExitLng = closestEdgePoint[1] + (vectorY / magnitude) * 0.005;

    return [safeExitLat, safeExitLng];
  };

  // Update the handleNavigateToShelter function to use the new multiple routes calculation
  const handleNavigateToShelter = (shelter: {
    name: string;
    coordinates: [number, number];
    isOutsideFloodZone?: boolean;
  }) => {
    if (!userLocation) {
      addAlert({
        title: "Navigation Error",
        message:
          "Your location is required for navigation. Please enable location services.",
        type: "error",
      });
      return;
    }

    console.log("Navigating to shelter:", shelter);

    // Center map on shelter first
    setMapCenter(shelter.coordinates);
    setMapZoom(15);

    // If the shelter is outside the flood zone, calculate multiple routes
    if (shelter.isOutsideFloodZone) {
      // Calculate multiple routes to different shelters, prioritizing this one
      calculateMultipleRoutes({ lat: userLocation.lat, lng: userLocation.lng });
      setNavigationDestination(shelter.name);
    } else {
      // For shelters inside flood zones, just calculate a direct route
      calculateRoute(
        { lat: userLocation.lat, lng: userLocation.lng },
        { lat: shelter.coordinates[0], lng: shelter.coordinates[1] }
      );
      setNavigationDestination(shelter.name);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "Critical":
        return "red";
      case "High":
        return "orange";
      case "Medium":
        return "yellow";
      case "Low":
        return "blue";
      default:
        return "blue";
    }
  };

  const getSeverityRadius = (severity: string) => {
    switch (severity) {
      case "Critical":
        return 2000;
      case "High":
        return 1500;
      case "Medium":
        return 1000;
      case "Low":
        return 1000;
      default:
        return 1000;
    }
  };

  const getFloodZoneColor = (severity: string) => {
    switch (severity) {
      case "Critical":
        return "#ff0000"; // Red
      case "High":
        return "#ff6600"; // Orange
      case "Medium":
        return "#ffcc00"; // Yellow
      default:
        return "#0066ff"; // Blue
    }
  };

  const getRoadStatusColor = (status: string) => {
    switch (status) {
      case "blocked":
        return "#FF0000"; // Red
      case "damaged":
        return "#FFA500"; // Orange
      case "demolished":
        return "#800080"; // Purple
      default:
        return "#000000"; // Black (fallback)
    }
  };

  const getSensorStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#00cc00"; // Green
      case "warning":
        return "#ffcc00"; // Yellow
      case "offline":
        return "#ff0000"; // Red
      default:
        return "#999999"; // Gray
    }
  };

  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "Critical":
        return "bg-red-100 text-red-600";
      case "High":
        return "bg-orange-100 text-orange-600";
      case "Medium":
        return "bg-yellow-100 text-yellow-600";
      case "Low":
        return "bg-blue-100 text-blue-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  // Add a helper function to calculate distance between two points
  function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div
      className={`flex ${
        fullScreenMap ? "h-screen fixed inset-0 z-50 bg-white" : "h-screen"
      }`}
    >
      {/* Left Sidebar - Enhanced with detailed flood information */}
      {!fullScreenMap && (
        <div className="w-96 bg-white border-r overflow-y-auto flex flex-col">
          {selectedLocation ? (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  {selectedLocation.area}
                </h2>
                <button
                  onClick={() => setSelectedLocation(null)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-lg">Flood Status</h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${getRiskBadgeColor(
                      selectedLocation.riskLevel
                    )}`}
                  >
                    {selectedLocation.riskLevel} Risk
                  </span>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <Droplets className="text-blue-500" size={20} />
                    <div>
                      <p className="text-sm text-gray-600">
                        Current Water Level
                      </p>
                      <p className="font-medium">
                        {selectedLocation.currentWaterLevel} meters
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <ArrowUp className="text-red-500" size={20} />
                    <div>
                      <p className="text-sm text-gray-600">
                        AI Predicted Level (Next 6 hrs)
                      </p>
                      <p className="font-medium">
                        {selectedLocation.predictedWaterLevel} meters
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div
                          className="bg-red-500 h-1.5 rounded-full"
                          style={{
                            width: `${
                              (selectedLocation.predictedWaterLevel / 4) * 100
                            }%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <BarChart3 className="text-blue-500" size={20} />
                    <div>
                      <p className="text-sm text-gray-600">Rainfall</p>
                      <p className="font-medium">
                        {selectedLocation.rainfall} cm in last 24 hrs
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-medium text-lg mb-2">Safe Routes</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ul className="space-y-2">
                    {selectedLocation.safeRoutes.map((route, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Route
                          className="text-green-500 mt-0.5 flex-shrink-0"
                          size={16}
                        />
                        <div className="flex flex-col w-full">
                          <span className="text-sm">{route}</span>
                          <button
                            className="text-blue-500 text-xs mt-1 text-left hover:underline"
                            onClick={() =>
                              handleNavigateViaSafeRoute(
                                route,
                                selectedLocation.area
                              )
                            }
                            disabled={isCalculatingRoute}
                          >
                            {isCalculatingRoute
                              ? "Calculating route..."
                              : "Navigate from current location"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-medium text-lg mb-2">Nearby Shelters</h3>
                <div className="space-y-3">
                  {selectedLocation.nearbyShelters.map((shelter, index) => (
                    <div
                      key={index}
                      className={`rounded-lg p-3 ${
                        shelter.isOutsideFloodZone
                          ? "bg-green-50 border border-green-100"
                          : "bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Home
                          className={`mt-0.5 flex-shrink-0 ${
                            shelter.isOutsideFloodZone
                              ? "text-green-500"
                              : "text-blue-500"
                          }`}
                          size={16}
                        />
                        <div className="w-full">
                          <div className="flex justify-between">
                            <p className="font-medium">{shelter.name}</p>
                            {shelter.isOutsideFloodZone && (
                              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-600 rounded-full">
                                Safe Zone
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                            <span>{shelter.distance}</span>
                            <span>{shelter.capacity}</span>
                          </div>
                          <button
                            className="text-blue-500 text-xs mt-2 hover:underline"
                            onClick={() => handleNavigateToShelter(shelter)}
                            disabled={isCalculatingRoute}
                          >
                            {isCalculatingRoute
                              ? "Calculating route..."
                              : "Navigate to this shelter"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                Last updated: {selectedLocation.lastUpdated}
              </p>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Chennai Flood Map</h2>
                <button
                  onClick={handleRefresh}
                  className={`p-2 rounded-full hover:bg-gray-100 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                  disabled={refreshing}
                >
                  <RefreshCw size={20} />
                </button>
              </div>

              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Search areas..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search
                  className="absolute left-3 top-2.5 text-gray-400"
                  size={20}
                />
              </div>

              <div className="mb-6">
                <h3 className="font-medium mb-2">Filters</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600">District</label>
                    <select
                      className="w-full mt-1 border rounded-lg p-2"
                      value={selectedDistrict}
                      onChange={(e) => {
                        setSelectedDistrict(e.target.value);
                        // If a specific district is selected, find its coordinates and center the map
                        if (e.target.value !== "All Districts") {
                          const district = MapService.tamilNaduDistricts.find(
                            (d) => d.name === e.target.value
                          );
                          if (district) {
                            setMapCenter(
                              district.coordinates as [number, number]
                            );
                            setMapZoom(11);
                          }
                        } else {
                          // Reset to Tamil Nadu center
                          setMapCenter([11.1271, 78.6569]);
                          setMapZoom(7);
                        }
                      }}
                    >
                      <option>All Districts</option>
                      {MapService.tamilNaduDistricts.map((district) => (
                        <option key={district.name}>{district.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Locality</label>
                    <select
                      className="w-full mt-1 border rounded-lg p-2"
                      value={selectedLocality}
                      onChange={(e) => setSelectedLocality(e.target.value)}
                    >
                      <option>All Localities</option>
                      {selectedDistrict !== "All Districts" &&
                        MapService.tamilNaduLocalities[
                          selectedDistrict as keyof typeof MapService.tamilNaduLocalities
                        ]?.map((locality) => (
                          <option key={locality}>{locality}</option>
                        ))}
                      {selectedDistrict === "All Districts" &&
                        MapService.getAllLocalities().map((locality) => (
                          <option key={locality}>{locality}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">
                      Severity Level
                    </label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {["Low", "Medium", "High", "Critical"].map((level) => (
                        <button
                          key={level}
                          onClick={() => handleSeverityFilter(level)}
                          className={`px-3 py-1 rounded-full text-sm ${
                            selectedSeverity.includes(level)
                              ? level === "Critical"
                                ? "bg-red-500 text-white"
                                : level === "High"
                                ? "bg-orange-500 text-white"
                                : level === "Medium"
                                ? "bg-yellow-500 text-white"
                                : "bg-blue-500 text-white"
                              : "bg-gray-100"
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-medium mb-3">Affected Areas</h3>
                <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
                  {floodData.length > 0 ? (
                    floodData
                      .filter((data) =>
                        selectedSeverity.includes(data.riskLevel)
                      )
                      .map((data) => (
                        <div
                          key={data.area}
                          className="bg-white border rounded-lg p-3 cursor-pointer hover:bg-gray-50"
                          onClick={() => handleLocationClick(data.area)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{data.area}</h4>
                              <p className="text-sm text-gray-600">
                                Water Level: {data.currentWaterLevel}m
                              </p>
                            </div>
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${getRiskBadgeColor(
                                data.riskLevel
                              )}`}
                            >
                              {data.riskLevel}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
                            <span>Updated: {data.lastUpdated}</span>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLocationClick(data.area);
                                }}
                                title="View Details"
                                className="hover:text-blue-600"
                              >
                                <Info size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLocationClick(data.area);
                                }}
                                title="Navigate"
                                className="hover:text-blue-600"
                              >
                                <Navigation2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      No flood data available
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-medium mb-3">Active Alerts</h3>
                <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
                  {filteredAlerts.length > 0 ? (
                    filteredAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="bg-white border rounded-lg p-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{alert.type}</h4>
                            <p className="text-sm text-gray-600">
                              {alert.location}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              alert.severity === "Critical"
                                ? "bg-red-100 text-red-600"
                                : alert.severity === "High"
                                ? "bg-orange-100 text-orange-600"
                                : alert.severity === "Medium"
                                ? "bg-yellow-100 text-yellow-600"
                                : "bg-blue-100 text-blue-600"
                            }`}
                          >
                            {alert.severity}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
                          <span>{alert.time}</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleViewAlertDetails(alert.id)}
                              title="View Details"
                              className="hover:text-blue-600"
                            >
                              <Info size={16} />
                            </button>
                            <button
                              onClick={() => handleNavigateToAlert(alert.id)}
                              title="Navigate"
                              className="hover:text-blue-600"
                            >
                              <Navigation2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      No alerts match your filters
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Map Area */}
      <div className={`flex-1 relative ${fullScreenMap ? "w-full" : ""}`}>
        <div className="absolute inset-0 z-0">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
            ref={(map) => {
              if (map) {
                mapRef.current = map;
              }
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

            {/* Alert markers and circles */}
            {filteredAlerts.map((alert) => (
              <div key={alert.id}>
                <Marker position={alert.coordinates}>
                  <Popup>
                    <div className="p-2 max-w-xs">
                      <h3 className="font-medium text-lg">{alert.type}</h3>
                      <p className="text-sm text-gray-600 mb-1">
                        {alert.location}, {alert.district}
                      </p>
                      <p className="text-sm mb-2">{alert.description}</p>
                      <p className="text-xs text-gray-500">
                        Updated: {alert.time}
                      </p>
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={() => handleViewAlertDetails(alert.id)}
                          className="text-blue-500 text-sm hover:underline"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>

                {showFloodZones && (
                  <Circle
                    center={alert.coordinates}
                    radius={getSeverityRadius(alert.severity)}
                    pathOptions={{
                      color: getSeverityColor(alert.severity),
                      fillColor: getSeverityColor(alert.severity),
                      fillOpacity: 0.2,
                    }}
                  />
                )}
              </div>
            ))}

            {/* Flood Zone Polygons */}
            {showFloodZones &&
              floodZones.map((zone, index) => (
                <Circle
                  key={`flood-zone-${index}`}
                  center={zone.coordinates[0]} // Use the first coordinate as the center
                  radius={getSeverityRadius(zone.severity)} // Use severity to determine radius
                  pathOptions={{
                    color: getFloodZoneColor(zone.severity),
                    fillColor: getFloodZoneColor(zone.severity),
                    fillOpacity: 0.3,
                    weight: 2,
                  }}
                  eventHandlers={{
                    click: () => {
                      const data = floodData.find(
                        (data) => data.area === zone.name
                      );
                      if (data) {
                        setSelectedLocation(data);
                      }
                    },
                  }}
                >
                  <Popup>
                    <div className="p-2 max-w-xs">
                      <h3 className="font-medium text-lg">
                        Flood Zone: {zone.name}
                      </h3>
                      <p className="text-sm mb-1">
                        Severity:{" "}
                        <span className="font-medium">{zone.severity}</span>
                      </p>
                      <p className="text-sm">
                        This area is experiencing flooding and may be dangerous.
                      </p>
                      <button
                        onClick={() => {
                          const data = floodData.find(
                            (data) => data.area === zone.name
                          );
                          if (data) {
                            setSelectedLocation(data);
                          }
                        }}
                        className="mt-2 text-blue-500 text-sm hover:underline"
                      >
                        View Detailed Information
                      </button>
                    </div>
                  </Popup>
                </Circle>
              ))}

            {/* Blocked Roads - Using images instead of colored lines */}
            {showBlockedRoads &&
              blockedRoads.map((road, index) => (
                <Marker
                  key={`blocked-road-${index}`}
                  position={[
                    (road.coordinates[0][0] + road.coordinates[1][0]) / 2,
                    (road.coordinates[0][1] + road.coordinates[1][1]) / 2,
                  ]}
                  icon={
                    new L.Icon({
                      iconUrl: newRoad,
                      iconSize: [72, 72],
                      iconAnchor: [16, 16],
                    })
                  }
                >
                  <Popup>
                    <div className="p-2 max-w-xs">
                      <h3 className="font-medium text-lg">Road Status</h3>
                      <p className="text-sm mb-1">
                        Condition:{" "}
                        <span className="font-medium capitalize">
                          {road.status}
                        </span>
                      </p>
                      <p className="text-sm">
                        {road.status === "blocked" &&
                          "This road is currently blocked due to flooding."}
                        {road.status === "damaged" &&
                          "This road is damaged and may be difficult to traverse."}
                        {road.status === "demolished" &&
                          "This road is completely demolished and impassable."}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* Sensor Locations with custom image */}
            {showSensors &&
              sensorLocations.map((sensor) => (
                <Marker
                  key={sensor.id}
                  position={sensor.coordinates}
                  icon={
                    new L.Icon({
                      iconUrl: tower, // Path to your sensor image
                      iconSize: [42, 42],
                      iconAnchor: [16, 16],
                    })
                  }
                >
                  <Popup>
                    <div className="p-2 max-w-xs">
                      <h3 className="font-medium text-lg">
                        Sensor {sensor.id}
                      </h3>
                      <p className="text-sm mb-1">
                        Status:{" "}
                        <span className="font-medium capitalize">
                          {sensor.status}
                        </span>
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Tower size={16} />
                        <span className="text-sm">Flood monitoring sensor</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* User location marker */}
            {userLocation && (
              <Marker
                position={[userLocation.lat, userLocation.lng]}
                icon={
                  new L.Icon({
                    iconUrl:
                      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
                    shadowUrl:
                      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
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

            {/* Navigation route if active */}
            {activeRoute && (
              <Polyline
                positions={activeRoute.coordinates.map((coord) => [
                  coord[1],
                  coord[0],
                ])}
                pathOptions={{
                  color: "#3388ff",
                  weight: 6,
                  opacity: 0.8,
                }}
              />
            )}

            {/* Shelter markers - Using shelter images */}
            {showShelters &&
              floodData.flatMap((data) =>
                data.nearbyShelters.map((shelter, index) => (
                  <Marker
                    key={`shelter-${data.area}-${index}`}
                    position={shelter.coordinates}
                    icon={
                      new L.Icon({
                        iconUrl: shelter.isOutsideFloodZone ? shelter : sjf, // Different icon for safe shelters
                        iconSize: [32, 32],
                        iconAnchor: [16, 32],
                      })
                    }
                  >
                    <Popup>
                      <div className="p-2 max-w-xs">
                        <h3 className="font-medium text-lg">{shelter.name}</h3>
                        <p className="text-sm mb-1">
                          Capacity:{" "}
                          <span className="font-medium">
                            {shelter.capacity}
                          </span>
                        </p>
                        <p className="text-sm mb-1">
                          Distance: {shelter.distance}
                        </p>
                        <p className="text-sm mb-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              shelter.isOutsideFloodZone
                                ? "bg-green-100 text-green-600"
                                : "bg-yellow-100 text-yellow-600"
                            }`}
                          >
                            {shelter.isOutsideFloodZone
                              ? "Outside Flood Zone"
                              : "Inside Flood Zone"}
                          </span>
                        </p>
                        <button
                          onClick={() => handleNavigateToShelter(shelter)}
                          className="mt-2 text-blue-500 text-sm hover:underline"
                        >
                          Navigate to this shelter
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))
              )}
          </MapContainer>
        </div>

        {/* Map Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <button
            onClick={() => setFullScreenMap(!fullScreenMap)}
            className="bg-white p-2 rounded-lg shadow-md hover:bg-gray-100"
            title={fullScreenMap ? "Exit Full Screen" : "Full Screen"}
          >
            {fullScreenMap ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>

          <button
            onClick={() =>
              setMapType(mapType === "street" ? "satellite" : "street")
            }
            className="bg-white p-2 rounded-lg shadow-md hover:bg-gray-100"
            title={`Switch to ${
              mapType === "street" ? "Satellite" : "Street"
            } View`}
          >
            <MapIcon size={20} />
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
                setMapCenter([userLocation.lat, userLocation.lng]);
                setMapZoom(15);
              }}
              className="bg-white p-2 rounded-lg shadow-md hover:bg-gray-100"
              title="Go to My Location"
            >
              <MapPin size={20} />
            </button>
          )}

          {userLocation && (
            <button
              onClick={() =>
                calculateMultipleRoutes({
                  lat: userLocation.lat,
                  lng: userLocation.lng,
                })
              }
              className="bg-white p-2 rounded-lg shadow-md hover:bg-gray-100"
              title="Find Safe Shelters"
              disabled={isCalculatingRoute}
            >
              <Home size={20} className="text-green-500" />
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
                  checked={showSensors}
                  onChange={() => setShowSensors(!showSensors)}
                  className="rounded"
                />
                <span>Sensors</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBlockedRoads}
                  onChange={() => setShowBlockedRoads(!showBlockedRoads)}
                  className="rounded"
                />
                <span>Blocked Roads</span>
              </label>
            </div>
            <div className="mt-3 pt-3 border-t">
              <h4 className="text-sm font-medium mb-2">Legend</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <span>Critical Flood Zone</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                  <span>High Risk Flood Zone</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                  <span>Medium Risk Flood Zone</span>
                </div>
                <div className="flex items-center gap-2">
                  <img
                    src={blockedRoad}
                    alt="Blocked Road"
                    className="w-4 h-4"
                  />
                  <span>Blocked Road</span>
                </div>
                <div className="flex items-center gap-2">
                  <img src={tower} alt="Sensor" className="w-4 h-4" />
                  <span>Sensor Location</span>
                </div>
                <div className="flex items-center gap-2">
                  <img src={shelter} alt="Shelter" className="w-4 h-4" />
                  <span>Shelter Location (In Flood Zone)</span>
                </div>
                <div className="flex items-center gap-2">
                  <img src={shelter} alt="Safe Shelter" className="w-4 h-4" />
                  <span>Safe Shelter Location (Outside Flood Zone)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Panel - Made scrollable and toggleable */}
        {showNavigationPanel && activeRoute && (
          <div className="absolute bottom-4 left-4 z-10 w-80 max-h-[70vh] overflow-hidden">
            <div className="bg-white rounded-lg shadow-lg">
              <div className="flex justify-between items-center p-3 border-b">
                <h3 className="text-lg font-semibold flex items-center">
                  <Navigation2 className="mr-2" size={20} />
                  {navigationDestination
                    ? `To: ${navigationDestination}`
                    : "Navigation"}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowNavigationPanel(false)}
                    className="p-1 rounded-full hover:bg-gray-100"
                    title="Minimize"
                  >
                    <Minimize2 size={18} />
                  </button>
                  <button
                    onClick={() => {
                      setShowNavigationPanel(false);
                      setActiveRoute(null);
                      setNavigationDestination(null);
                    }}
                    className="p-1 rounded-full hover:bg-gray-100"
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-3 bg-blue-50">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600">Total Distance</p>
                    <p className="font-medium">
                      {formatDistance(activeRoute.distance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Estimated Time</p>
                    <p className="font-medium">
                      {formatDuration(activeRoute.duration)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="max-h-[40vh] overflow-y-auto">
                <div className="space-y-1 p-2">
                  {activeRoute.steps.map((step, index) => (
                    <div
                      key={index}
                      className="flex items-start p-2 border-b last:border-b-0"
                    >
                      <div className="bg-blue-100 p-2 rounded-full mr-3">
                        {step.instruction.includes("right") ? (
                          <ArrowRight size={18} />
                        ) : step.instruction.includes("left") ? (
                          <ArrowLeft size={18} />
                        ) : (
                          <ArrowUp size={18} />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{step.instruction}</p>
                        <div className="flex justify-between text-sm text-gray-600 mt-1">
                          <span>{formatDistance(step.distance)}</span>
                          <span>{formatDuration(step.duration)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Minimized Navigation Indicator */}
        {navigationDestination && activeRoute && !showNavigationPanel && (
          <div
            className="absolute bottom-4 right-4 z-10 bg-blue-500 text-white p-3 rounded-lg shadow-md cursor-pointer"
            onClick={() => setShowNavigationPanel(true)}
          >
            <div className="flex items-center gap-2">
              <Navigation2 size={20} />
              <div>
                <p className="text-sm font-medium">Navigating to:</p>
                <p className="text-xs">{navigationDestination}</p>
              </div>
            </div>
          </div>
        )}

        {/* Multiple Route Options Panel */}
        {multipleRouteOptions && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-white p-4 rounded-lg shadow-md max-w-md">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">Multiple Safe Routes Available</h3>
              <button
                onClick={() => setMultipleRouteOptions(null)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {multipleRouteOptions.routes.map((route, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg cursor-pointer ${
                    activeRoute === route
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                  onClick={() => {
                    setActiveRoute(route);
                    setShowNavigationPanel(true);
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Route Option {index + 1}</p>
                      <div className="flex gap-3 text-sm text-gray-600">
                        <span>{formatDistance(route.distance)}</span>
                        <span>{formatDuration(route.duration)}</span>
                      </div>
                    </div>
                    {activeRoute === route && (
                      <div className="bg-blue-500 text-white p-1 rounded-full">
                        <Check size={16} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t text-xs text-gray-500">
              Select a route to view detailed navigation instructions.
            </div>
          </div>
        )}

        {/* Alert indicator for mobile */}
        {filteredAlerts.length > 0 && fullScreenMap && (
          <div className="absolute bottom-4 left-4 z-10 bg-white p-2 rounded-full shadow-md flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" />
            <span className="font-medium">
              {filteredAlerts.length} Active Alerts
            </span>
          </div>
        )}

        {/* Navigation status indicator */}
        {isCalculatingRoute && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10 bg-white px-4 py-2 rounded-full shadow-md flex items-center gap-2">
            <RefreshCw size={16} className="text-blue-500 animate-spin" />
            <span>Calculating safe route...</span>
          </div>
        )}

        {/* Mobile sidebar toggle when in fullscreen */}
        {fullScreenMap && (
          <button
            onClick={() => setFullScreenMap(false)}
            className="absolute bottom-4 right-4 z-10 bg-blue-500 text-white p-3 rounded-full shadow-md"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Alert Details Modal */}
      {showAlertDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Alert Details</h3>
              <button
                onClick={() => setShowAlertDetails(null)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {alerts.find((a) => a.id === showAlertDetails) && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">
                    Alert Type
                  </h4>
                  <p className="font-medium">
                    {alerts.find((a) => a.id === showAlertDetails)?.type}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500">
                    Location
                  </h4>
                  <p>
                    {alerts.find((a) => a.id === showAlertDetails)?.location},{" "}
                    {alerts.find((a) => a.id === showAlertDetails)?.district}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500">
                    Severity
                  </h4>
                  <p
                    className={`${
                      alerts.find((a) => a.id === showAlertDetails)
                        ?.severity === "Critical"
                        ? "text-red-600"
                        : alerts.find((a) => a.id === showAlertDetails)
                            ?.severity === "High"
                        ? "text-orange-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {alerts.find((a) => a.id === showAlertDetails)?.severity}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500">
                    Description
                  </h4>
                  <p>
                    {alerts.find((a) => a.id === showAlertDetails)?.description}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500">Updated</h4>
                  <p>{alerts.find((a) => a.id === showAlertDetails)?.time}</p>
                </div>

                <div className="pt-4 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      // Send notification about this alert
                      const alert = alerts.find(
                        (a) => a.id === showAlertDetails
                      );
                      if (alert) {
                        addAlert({
                          title: "Alert Shared",
                          message: `You've shared information about ${alert.type} in ${alert.location}`,
                          type: "info",
                        });
                      }
                      setShowAlertDetails(null);
                    }}
                    className="px-4 py-2 border rounded-lg"
                  >
                    Share
                  </button>
                  <button
                    onClick={() => {
                      handleNavigateToAlert(showAlertDetails);
                      setShowAlertDetails(null);
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2"
                  >
                    <Navigation2 size={16} />
                    <span>Navigate</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
