"use client"
import React from "react"
import { useEffect, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CornerDownLeft,
  CornerDownRight,
  CornerUpLeft,
  CornerUpRight,
  Home,
  Navigation2,
  Shield,
  X,
} from "lucide-react"
import { type RouteInstructions, formatDistance, formatDuration } from "../services/routingservice"

interface NavigationPanelProps {
  route: RouteInstructions
  onClose: () => void
  destination?: string
  isSafeShelter?: boolean
}

export default function NavigationPanel({ route, onClose, destination, isSafeShelter = false }: NavigationPanelProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [showSafetyInfo, setShowSafetyInfo] = useState(false)

  useEffect(() => {
    // Ensure the panel becomes visible with a slight delay for animation
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const getDirectionIcon = (instruction: string) => {
    if (instruction.includes("right")) {
      return instruction.includes("slight") ? <CornerUpRight size={18} /> : <ArrowRight size={18} />
    } else if (instruction.includes("left")) {
      return instruction.includes("slight") ? <CornerUpLeft size={18} /> : <ArrowLeft size={18} />
    } else if (instruction.includes("uturn")) {
      return <CornerDownLeft size={18} />
    } else if (instruction.includes("roundabout")) {
      return <CornerDownRight size={18} />
    } else {
      return <ArrowUp size={18} />
    }
  }

  if (!route || !route.steps || route.steps.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold flex items-center">
            <Navigation2 className="mr-2" size={20} />
            Navigation
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <p>No route information available. Please try again.</p>
      </div>
    )
  }

  return (
    <div
      className={`bg-white rounded-lg shadow-lg p-4 max-h-[80vh] overflow-y-auto transition-opacity duration-300 ${isVisible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Navigation2 className="mr-2" size={20} />
          {destination ? `To: ${destination}` : "Navigation"}
        </h3>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
          <X size={18} />
        </button>
      </div>

      {isSafeShelter && (
        <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-100">
          <div className="flex items-start gap-2">
            <Shield className="text-green-500 mt-0.5" size={18} />
            <div>
              <p className="font-medium text-green-700">Safe Shelter Destination</p>
              <p className="text-sm text-green-600">This shelter is located outside the flood risk zone.</p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Total Distance</p>
            <p className="font-medium">{formatDistance(route.distance)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Estimated Time</p>
            <p className="font-medium">{formatDuration(route.duration)}</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowSafetyInfo(!showSafetyInfo)}
        className="w-full mb-4 p-2 bg-yellow-50 rounded-lg border border-yellow-100 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-yellow-500" size={18} />
          <span className="text-sm font-medium text-yellow-700">Safety Information</span>
        </div>
        <span className="text-xs text-yellow-600">{showSafetyInfo ? "Hide" : "Show"}</span>
      </button>

      {showSafetyInfo && (
        <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
          <ul className="text-sm text-yellow-700 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-yellow-500 mt-1">•</span>
              <span>This route avoids known flood zones and blocked roads where possible.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-500 mt-1">•</span>
              <span>Road conditions may change rapidly during flooding. Stay alert for new hazards.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-500 mt-1">•</span>
              <span>Never drive through flooded roads. Just 6 inches of water can cause loss of control.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-500 mt-1">•</span>
              <span>If you encounter a flooded area, turn around and find an alternative route.</span>
            </li>
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {route.steps.map((step, index) => (
          <div key={index} className="flex items-start p-2 border-b last:border-b-0">
            <div className="bg-blue-100 p-2 rounded-full mr-3">{getDirectionIcon(step.instruction)}</div>
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

      {destination && destination.includes("shelter") && (
        <div className="mt-4 pt-3 border-t">
          <div className="flex items-center gap-2 text-blue-600">
            <Home size={16} />
            <p className="text-sm font-medium">Navigating to shelter</p>
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t">
        <p className="text-xs text-gray-500">
          Navigation data provided by OpenStreetMap. Routes are calculated to avoid flood zones and blocked roads when
          possible.
        </p>
      </div>
    </div>
  )
}

