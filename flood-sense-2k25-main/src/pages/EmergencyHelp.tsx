"use client"

import React from "react"
import { useState, useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import {
  AlertTriangle,
  Filter,
  MapPin,
  CheckCircle,
  XCircle,
  Users,
  Activity,
  RefreshCw,
  Send,
  Search,
} from "lucide-react"

// Sample data for the application
const sampleVolunteers = [
  {
    id: "V001",
    name: "Bharath",
    location: "T. Nagar",
    specialty: "Medical",
    status: "Active",
    position: [13.0604, 80.2824], // T. Nagar, Chennai
    riskLevel: "high",
  },
  {
    id: "V002",
    name: "Badrinath",
    location: "Adyar",
    specialty: "Search & Rescue",
    status: "Active",
    position: [13.0012, 80.2565], // Adyar, Chennai
    riskLevel: "medium",
  },
  {
    id: "V003",
    name: "Madhan",
    location: "Mylapore",
    specialty: "Logistics",
    status: "On Call",
    position: [13.0368, 80.2676], // Mylapore, Chennai
    riskLevel: "low",
  },
  {
    id: "V004",
    name: "Prashaath",
    location: "Anna Nagar",
    specialty: "Medical",
    status: "Active",
    position: [13.085, 80.2101], // Anna Nagar, Chennai
    riskLevel: "medium",
  },
  {
    id: "V005",
    name: "Kishore",
    location: "Velachery",
    specialty: "Fire Fighter",
    status: "Active",
    position: [12.9815, 80.218], // Velachery, Chennai
    riskLevel: "medium",
  },

  {
    id: "V006",
    name: "Kumaran",
    location: "T. Nagar",
    specialty: "Logistics",
    status: "Active",
    position: [13.0424, 80.2332], // T. Nagar, Chennai
    riskLevel: "low",
  },
  



  {
    id: "V007",
    name: "Karthick",
    location: "Ramapuram",
    specialty: "Search and Rescue",
    status: "On Call",
    position: [13.0215, 80.1745], // Mylapore, Chennai
    riskLevel: "low",
  },


]

const sampleTeams = [
  {
    id: "T001",
    name: "Alpha Squad",
    location: "T. Nagar",
    status: "Active",
    members: [
      { profileImage: "public/admin.png" },
      { profileImage: "public/p-2.png" },
      { profileImage: "public/p-4.png" },
      { profileImage: "public/admin.png" },
      
    ],
  },
  {
    id: "T002",
    name: "Bravo Team",
    location: "Adyar",
    status: "On Call",
    members: [
      { profileImage: "public/p-4.png" },
      { profileImage: "public/p-3.png" },
      { profileImage: "public/admin.png" },
      { profileImage: "public/p-4.png" },
      { profileImage: "public/p-3.png" },
    ],
  },
  {
    id: "T003",
    name: "Charlie Unit",
    location: "Mylapore",
    status: "Inactive",
    members: [
      { profileImage: "public/p-4.png" },
      { profileImage: "public/admin.png" },
      { profileImage: "public/admin.png" },
      { profileImage: "public/p-4.png" },
     
    ],
  },
]

const sampleEmergencyCases = [
  {
    id: "E001",
    location: "T. Nagar, Main St",
    type: "Flooding",
    description: "Street flooding after heavy rain, multiple buildings affected",
    priority: "High",
    volunteersAssigned: 12,
  },
  {
    id: "E002",
    location: "Adyar Park",
    type: "Fire",
    description: "Small brush fire in the park area",
    priority: "Medium",
    volunteersAssigned: 8,
  },
  {
    id: "E003",
    location: "Anna Nagar, 2nd Avenue",
    type: "Power Outage",
    description: "Power lines down affecting 3 blocks",
    priority: "Low",
    volunteersAssigned: 4,
  },
]

const sampleHelpRequests = [
  {
    id: "H001",
    location: "123 T. Nagar",
    status: "Pending",
  },
  {
    id: "H002",
    location: "456 Adyar",
    status: "In Progress",
  },
  {
    id: "H003",
    location: "789 Mylapore",
    status: "Completed",
  },
  {
    id: "H004",
    location: "321 Anna Nagar",
    status: "Rejected",
  },
]

// Risk areas data for Chennai
const riskAreas = [
  {
    id: 1,
    center: [13.0827, 80.2707], // Chennai city center
    radius: 3000,
    level: "high",
    color: "#FF0000",
    description: "High Flooding risk area - Chennai Central",
  },
  {
    id: 2,
    center: [13.0012, 80.2565], // Adyar area
    radius: 2000,
    level: "medium",
    color: "#FFA500",
    description: "Coastal flooding zone - Adyar",
  },
  {
    id: 3,
    center: [13.085, 80.2101], // Anna Nagar area
    radius: 2500,
    level: "low",
    color: "#FFFF00",
    description: "Minor flood risk - Anna Nagar",
  },
]

// Loading Spinner Component
function LoadingSpinner({ fullScreen = false }) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  )
}

// Risk Legend Component
function RiskLegend() {
  const riskLevels = [
    { level: "High", color: "#FF0000" },
    { level: "Medium", color: "#FFA500" },
    { level: "Low", color: "#FFFF00" },
  ]

  return (
    <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-md z-10">
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
        <AlertTriangle size={14} />
        Risk Levels
      </h4>
      <div className="space-y-1">
        {riskLevels.map((risk) => (
          <div key={risk.level} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: risk.color, opacity: 0.7 }}></div>
            <span>{risk.level}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Map center adjustment component
function MapCenterAdjust({ center }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, 12)
  }, [center, map])
  return null
}

// Map Component
function MapViews() {
  // Chennai coordinates
  const [mapCenter, setMapCenter] = useState([13.0827, 80.2707])

  // Fix for Leaflet icon issues in Next.js
  useEffect(() => {
    // Only run on client side
    if (typeof window !== "undefined") {
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      })
    }
  }, [])

  // Get volunteer icon based on risk level
  const getVolunteerIcon = (riskLevel) => {
    const iconColor = riskLevel === "high" ? "red" : riskLevel === "medium" ? "orange" : "Green"

    return new L.DivIcon({
      className: "custom-div-icon",
      html: `<div style="background-color: white; border-radius: 50%; padding: 2px; border: 2px solid ${iconColor};">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    })
  }

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <MapContainer center={mapCenter} zoom={12} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapCenterAdjust center={mapCenter} />

        {/* Render risk boundary areas */}
        {riskAreas.map((area) => (
          <Circle
            key={area.id}
            center={area.center}
            radius={area.radius}
            pathOptions={{
              fillColor: area.color,
              fillOpacity: 0.2,
              color: area.color,
              weight: 2,
            }}
          >
            <Popup>
              <div>
                <h3 className="font-bold flex items-center gap-1">
                  <AlertTriangle size={16} className="text-red-500" />
                  {area.level.charAt(0).toUpperCase() + area.level.slice(1)} Risk Area
                </h3>
                <p>{area.description}</p>
              </div>
            </Popup>
          </Circle>
        ))}

        {/* Render volunteer markers */}
        {sampleVolunteers.map((volunteer) => (
          <Marker key={volunteer.id} position={volunteer.position} icon={getVolunteerIcon(volunteer.riskLevel)}>
            <Popup>
              <div className="p-1">
                <h3 className="font-bold">{volunteer.name}</h3>
                <p className="text-sm">Specialty: {volunteer.specialty}</p>
                <p className="text-sm">Status: {volunteer.status}</p>
                <p className="text-sm flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      volunteer.riskLevel === "high"
                        ? "bg-red-500"
                        : volunteer.riskLevel === "medium"
                          ? "bg-orange-500"
                          : "bg-yellow-500"
                    }`}
                  ></span>
                  {volunteer.riskLevel.charAt(0).toUpperCase() + volunteer.riskLevel.slice(1)} Risk Area
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

// Main Component
export default function EmergencyHelp() {
  const [searchQuery, setSearchQuery] = useState("")
  const [broadcastMessage, setBroadcastMessage] = useState("")
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [selectedEmergencyId, setSelectedEmergencyId] = useState(null)
  const [showAssignTeamModal, setShowAssignTeamModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const volunteers = sampleVolunteers
  const teams = sampleTeams
  const emergencyCases = sampleEmergencyCases
  const helpRequests = sampleHelpRequests

  const stats = [
    {
      title: "Total Volunteers",
      value: volunteers.length,
      icon: <Users className="text-blue-500" size={24} />,
      bgColor: "bg-blue-50",
    },
    {
      title: "Active Teams",
      value: teams.filter((team) => team.status === "Active").length,
      icon: <Users className="text-green-500" size={24} />,
      bgColor: "bg-green-50",
    },
    {
      title: "Pending Requests",
      value: helpRequests.filter((req) => req.status === "Pending").length,
      icon: <AlertTriangle className="text-amber-500" size={24} />,
      bgColor: "bg-amber-50",
    },
    {
      title: "Active Emergency Cases",
      value: emergencyCases.length,
      icon: <Activity className="text-red-500" size={24} />,
      bgColor: "bg-red-50",
    },
  ]

  const handleRefresh = async () => {
    setRefreshing(true)
    // Simulate refresh
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setRefreshing(false)
  }

  const handleUpdateHelpRequest = async (id, status) => {
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))
    setIsLoading(false)
  }

  const handleAssignTeam = async () => {
    if (selectedEmergencyId && selectedTeamId) {
      setIsLoading(true)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))
      setShowAssignTeamModal(false)
      setSelectedEmergencyId(null)
      setSelectedTeamId(null)
      setIsLoading(false)
    }
  }

  const handleSendBroadcast = async () => {
    if (broadcastMessage.trim()) {
      setIsLoading(true)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))
      setBroadcastMessage("")
      setShowBroadcastModal(false)
      setIsLoading(false)
    }
  }

  const openAssignTeamModal = (emergencyId) => {
    setSelectedEmergencyId(emergencyId)
    setShowAssignTeamModal(true)
  }

  if (isLoading) {
    return <LoadingSpinner fullScreen />
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-2xl font-bold mb-4 md:mb-0">RescueOps</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-full hover:bg-gray-100 ${refreshing ? "animate-spin" : ""}`}
            disabled={refreshing}
          >
            <RefreshCw size={20} />
          </button>
          <button
            onClick={() => setShowBroadcastModal(true)}
            className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
          >
            <Send size={20} />
            <span className="hidden sm:inline">Emergency Broadcast</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => (
          <div key={index} className={`${stat.bgColor} rounded-lg p-4 flex items-center`}>
            <div className="mr-4 p-3 rounded-full bg-white">{stat.icon}</div>
            <div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.title}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Map Section */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <h2 className="text-xl font-semibold">Active Volunteers Map</h2>
          <div className="flex items-center gap-2 mt-2 md:mt-0 w-full md:w-auto">
            <div className="relative flex-grow md:w-64">
              <input
                type="text"
                placeholder="Search location..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border rounded-lg">
              <Filter size={20} />
              <span>Filters</span>
            </button>
          </div>
        </div>
        <div className="bg-gray-100 h-80 rounded-lg relative">
          <div className="h-80 rounded-lg overflow-hidden">
            <MapViews />
            <RiskLegend />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Emergency Cases */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Active Emergency Cases</h2>
          </div>
          <div className="space-y-4">
            {emergencyCases.map((emergency, index) => (
              <div key={index} className="border rounded-lg overflow-hidden">
                <div
                  className={`px-3 py-1 text-sm font-medium ${
                    emergency.priority === "High"
                      ? "bg-red-100 text-red-600"
                      : emergency.priority === "Medium"
                        ? "bg-orange-100 text-orange-600"
                        : "bg-green-100 text-green-600"
                  }`}
                >
                  {emergency.priority} Priority
                </div>
                <div className="p-4">
                  <div className="font-medium">{emergency.location}</div>
                  <div className="text-gray-600">{emergency.type}</div>
                  <div className="text-sm text-gray-500 mt-1">{emergency.description}</div>
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-sm text-gray-500">{emergency.volunteersAssigned} volunteers assigned</div>
                    <button
                      onClick={() => openAssignTeamModal(emergency.id)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      Assign Team
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Help Requests */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Recent Help Requests</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-gray-500 text-sm">
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Location</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {helpRequests.map((request, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-4 py-3">{request.id}</td>
                    <td className="px-4 py-3">{request.location}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          request.status === "Pending"
                            ? "bg-yellow-100 text-yellow-600"
                            : request.status === "In Progress"
                              ? "bg-blue-100 text-blue-600"
                              : request.status === "Completed"
                                ? "bg-green-100 text-green-600"
                                : "bg-red-100 text-red-600"
                        }`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateHelpRequest(request.id, "Completed")}
                          className="text-green-500 hover:text-green-700"
                          disabled={request.status === "Completed" || request.status === "Rejected"}
                        >
                          <CheckCircle size={20} />
                        </button>
                        <button
                          onClick={() => handleUpdateHelpRequest(request.id, "Rejected")}
                          className="text-red-500 hover:text-red-700"
                          disabled={request.status === "Completed" || request.status === "Rejected"}
                        >
                          <XCircle size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Active Teams */}
      <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-xl font-semibold mb-4">Active Teams</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-gray-500 text-sm border-b">
                <th className="px-4 py-2">Team ID</th>
                <th className="px-4 py-2">Team Name</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Members</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team, index) => (
                <tr key={index} className="border-b">
                  <td className="px-4 py-3">{team.id}</td>
                  <td className="px-4 py-3 font-medium">{team.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <MapPin size={16} className="text-gray-400" />
                      {team.location}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        team.status === "Active"
                          ? "bg-green-100 text-green-600"
                          : team.status === "On Call"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {team.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex -space-x-2">
                      {team.members.slice(0, 5).map((member, i) => (
                        <img
                          key={i}
                          src={member.profileImage || "/placeholder.svg"}
                          alt={`Team Member ${i + 1}`}
                          className="w-8 h-8 rounded-full border-2 border-white"
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button className="px-3 py-1 border border-blue-500 text-blue-500 rounded hover:bg-blue-50">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Team Modal */}
      {showAssignTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Assign Team</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Team</label>
              <select
                className="w-full p-2 border rounded-lg"
                value={selectedTeamId || ""}
                onChange={(e) => setSelectedTeamId(e.target.value)}
              >
                <option value="">Select a team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAssignTeamModal(false)} className="px-4 py-2 border rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleAssignTeam}
                disabled={!selectedTeamId}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Send Emergency Broadcast</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Broadcast Message</label>
              <textarea
                className="w-full p-2 border rounded-lg h-32"
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Enter emergency broadcast message..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowBroadcastModal(false)} className="px-4 py-2 border rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleSendBroadcast}
                disabled={!broadcastMessage.trim()}
                className="px-4 py-2 bg-red-500 text-white rounded-lg disabled:opacity-50"
              >
                Send Broadcast
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

