import React, { useState, useCallback, useMemo } from "react";
import {
  GoogleMap,
  useLoadScript,
  Marker,
  DirectionsRenderer,
  Autocomplete,
  Circle
} from "@react-google-maps/api";
import { RadiusSelector, PlacesList } from "./RadiusSelector";
import axios from "axios";

const PLACE_TYPES = {
  hospital: "Hospitals",
  restaurant: "Restaurants",
  store: "Stores",
  atm: "ATMs",
  school: "Schools",
  pharmacy: "Pharmacies",
  transit_station: "Transit Stations"
};

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';


const DEFAULT_CENTER = { lat: 20.2961, lng: 85.8245 }; // Bhubaneswar
const DEFAULT_RADIUS = 5000;

const mapContainerStyle = {
  width: "100%",
  height: "calc(100vh - 180px)",
  minHeight: "500px",
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: true,
  streetViewControl: true,
  fullscreenControl: true,
};

const circleOptions = {
  fillColor: "#4299e1",
  fillOpacity: 0.1,
  strokeColor: "#4299e1",
  strokeOpacity: 0.8,
  strokeWeight: 2,
};

const directionsOptions = {
  suppressMarkers: true,
  polylineOptions: {
    strokeColor: "#4A90E2",
    strokeWeight: 4,
  },
};

function App() {
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState(null);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [type, setType] = useState("hospital");
  const [places, setPlaces] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [error, setError] = useState("");
  const [autocomplete, setAutocomplete] = useState(null);
  const [convenienceScore, setConvenienceScore] = useState(null);
  const [scoreInterpretation, setScoreInterpretation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchMetadata, setSearchMetadata] = useState(null);
  const [customKeywords, setCustomKeywords] = useState("");
  const [minRating, setMinRating] = useState(4.0);
  const [showTransit, setShowTransit] = useState(false);
  const [costEstimates, setCostEstimates] = useState(null);


  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
  });

  const handleTypeChange = useCallback(async (e) => {
    const newType = e.target.value;
    setType(newType);
    if (location) {
      await searchNearbyPlaces(location, newType, radius);
    }
  }, [location, radius]);

  const handleRadiusChange = useCallback(async (newRadius) => {
    setRadius(newRadius);
    if (location) {
      await searchNearbyPlaces(location, type, newRadius);
    }
  }, [location, type]);

  const searchWithCustomKeywords = async () => {
    setIsLoading(true);
    try {
      
      const response = await axios.get(`${API_URL}/custom-places`, {
        params: {
          location: `${location.lat},${location.lng}`,
          radius,
          customKeywords
        }
      });
      if (response.data.success) {
        setPlaces(places);
        setSearchMetadata({
          totalPlaces: places.length,
          searchRadius: radius,
          searchType: 'custom',
          keywords: customKeywords,
          ...(response.data.metadata || {})
        });
      }
    } catch (error) {
      setError("Failed to search with custom keywords");
    } finally {
      setIsLoading(false);
    }
  };

  const searchWithRatings = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/places-with-ratings`, {
        params: {
          location: `${location.lat},${location.lng}`,
          radius,
          type,
          minRating
        }
      });
      if (response.data.success) {
        const { places } = response.data;
        setPlaces(places);
        setSearchMetadata({
          totalPlaces: places.length,
          searchRadius: radius,
          searchType: 'rated',
          minRating,
          ...(response.data.metadata || {})
        });
      }
    } catch (error) {
      setError("Failed to fetch highly-rated places");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransitStations = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/public-transport`, {
        params: {
          location: `${location.lat},${location.lng}`,
          radius
        }
      });
      if (response.data.success) {
        const { stations } = response.data;
        setPlaces(stations);
        setSearchMetadata({
          totalPlaces: stations.length,
          searchRadius: radius,
          searchType: 'transit',
          ...(response.data.metadata || {})
        });
      }
    } catch (error) {
      setError("Failed to fetch transit stations");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCostEstimates = async () => {
    try {
      const response = await axios.get(`${API_URL}/cost-estimation`, {
        params: {
          location: `${location.lat},${location.lng}`,
          radius,
          type
        }
      });
      if (response.data.success) {
        setCostEstimates(response.data);
      }
    } catch (error) {
      setError("Failed to fetch cost estimates");
    }
  };

  const onPlaceSelected = useCallback(async () => {
    if (!autocomplete) return;

    const place = autocomplete.getPlace();

    if (!place.geometry) {
      setError("Please select a valid address from the dropdown");
      return;
    }

    const newLocation = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };

    console.log(`${API_URL}/geocode`)

    try {
      const geocodeResponse = await axios.get(`${API_URL}/geocode`, {
        params: { address: place.formatted_address },
      });

      if (geocodeResponse.data.success) {
        setAddress(geocodeResponse.data.formattedAddress);
        setLocation(geocodeResponse.data.location);
        await searchNearbyPlaces(geocodeResponse.data.location, type, radius);
      } else {
        setError("Failed to validate address. Please try again.");
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      setError("Error validating address. Please try again.");
    }
  }, [autocomplete, type, radius]);

  const searchNearbyPlaces = async (loc, placeType, searchRadius) => {
    setIsLoading(true);
    setError("");

    try {
      if (showTransit) {
        await fetchTransitStations();
      } else {
        const response = await axios.get(`${API_URL}/nearby`, {
          params: {
            location: `${loc.lat},${loc.lng}`,
            radius: searchRadius,
            type: placeType,
          },
        });

        if (response.data.success) {
          const { places, convenienceScore, interpretation } = response.data;
        
          // Create consistent metadata structure
          const updatedMetadata = {
            totalPlaces: places.length,
            searchRadius: searchRadius,
            placeType: placeType,
            ...(response.data.metadata || {}) // Include any additional metadata from the response
          };

          setPlaces(places);
          setConvenienceScore(convenienceScore);
          setScoreInterpretation(interpretation);
          setSearchMetadata(updatedMetadata);
          setSelectedRoute(null);
          
          // Fetch cost estimates for applicable place types
          if (["restaurant", "store"].includes(placeType)) {
            await fetchCostEstimates();
          }
        }
      }
    } catch (err) {
      setError(`Failed to find nearby ${PLACE_TYPES[placeType]}. Please try again.`);
      resetState();
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setPlaces([]);
    setConvenienceScore(null);
    setScoreInterpretation("");
    setSearchMetadata(null);
    setCostEstimates(null);
  };

  const showRoute = useCallback(async (place) => {
    if (!window.google || !location) return;

    try {
      const directionsService = new window.google.maps.DirectionsService();
      const result = await directionsService.route({
        origin: location,
        destination: place.geometry.location,
        travelMode: window.google.maps.TravelMode.DRIVING,
      });

      setSelectedRoute(result);
    } catch (error) {
      setError("Could not calculate route to this location");
    }
  }, [location]);

  const mapCenter = useMemo(() => location || DEFAULT_CENTER, [location]);

  if (loadError) return <div className="text-red-600 p-4">Error loading maps</div>;
  if (!isLoaded) return <div className="p-4">Loading maps...</div>;

  return (
    <div className="flex flex-col items-center justify-start h-screen bg-gray-50">
      {/* Centered Header */}
      <header className="w-full bg-white shadow-md p-4 flex items-center justify-center">
        <h1 className="text-2xl font-semibold text-gray-800">The Loop</h1>
      </header>

  {/* Main Content */}
  <main className="flex-1 w-full max-w-7xl mx-auto p-6">
    <div className="flex gap-8">
      {/* Sidebar */}
      <div className="w-96 flex-shrink-0 bg-white rounded-xl shadow-lg p-6 space-y-6">

        {/* Results Section */}
        {!isLoading && (convenienceScore !== null || searchMetadata) && (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Area Analysis</h2>
              {convenienceScore !== null && (
                <div className="bg-blue-500 px-4 py-2 rounded-full">
                  <span className="text-lg font-bold text-white">
                    {convenienceScore.toFixed(1)}/10
                  </span>
                </div>
              )}
            </div>
            
            {scoreInterpretation && (
              <p className="block text-gray-800 mt-3 font-semibold leading-relaxed">{scoreInterpretation}</p>
            )}
            
            {searchMetadata && (
              <div className="mt-4 space-y-2 mb-5">
                <div className="block text-sm font-semibold text-gray-700 mb-2">
                  Found {searchMetadata.totalPlaces} places within {searchMetadata.searchRadius}m
                </div>
                {searchMetadata.searchType === 'rated' && (
                  <div className="block text-sm font-semibold text-gray-700 mb-2">
                    Minimum rating: {searchMetadata.minRating}⭐
                  </div>
                )}
                {searchMetadata.searchType === 'custom' && (
                  <div className="block text-sm font-semibold text-gray-700 mb-2">
                    Keywords: {searchMetadata.keywords}
                  </div>
                )}
              </div>
            )}
            <PlacesList places={places} showRoute={showRoute} placeType={type} />

          </div>
          
        )}
        


        
        {/* Search Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="space-y-4">
            {/* Location Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Your Location</label>
              <div className="relative">
                <Autocomplete
                  onLoad={setAutocomplete}
                  onPlaceChanged={onPlaceSelected}
                  restrictions={{ country: "in" }}
                >
                  <input
                    type="text"
                    placeholder="Enter your address"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </Autocomplete>
              </div>
            </div>

            {/* Place Type Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Place Type</label>
              <select
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                value={type}
                onChange={handleTypeChange}
                disabled={isLoading}
              >
                {Object.entries(PLACE_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Radius Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Search Radius</label>
              <div className="px-2">
                <RadiusSelector
                  radius={radius}
                  setRadius={setRadius}
                  onRadiusChange={handleRadiusChange}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Search</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Custom Keywords</label>
                  <input
                    type="text"
                    value={customKeywords}
                    onChange={(e) => setCustomKeywords(e.target.value)}
                    placeholder="e.g., coffee, gym, park"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                  <button
                    onClick={searchWithCustomKeywords}
                    className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    disabled={!location || !customKeywords}
                  >
                    Search Custom Places
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Minimum Rating</label>
                  <input
                    type="number"
                    value={minRating}
                    onChange={(e) => setMinRating(parseFloat(e.target.value))}
                    min="1"
                    max="5"
                    step="0.1"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                  <button
                    onClick={searchWithRatings}
                    className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    disabled={!location}
                  >
                    Search by Rating
                  </button>
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={showTransit}
                      onChange={(e) => {
                        setShowTransit(e.target.checked);
                        if (e.target.checked && location) {
                          fetchTransitStations();
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Show Transit Stations</span>
                  </label>
                </div>
              </div>
            </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-gray-500">Searching nearby places...</div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
            <div className="flex items-center space-x-2">
              <div className="flex-shrink-0 text-red-400">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-sm text-red-600 font-medium">{error}</div>
            </div>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="flex-1 relative bg-white rounded-xl shadow-lg p-6">
        <div className="h-full rounded-xl overflow-hidden shadow-lg border border-gray-200">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            zoom={location ? 14 : 12}
            center={mapCenter}
            options={{
              ...mapOptions,
              styles: [
                {
                  featureType: "all",
                  elementType: "geometry",
                  stylers: [{ gamma: 0.9 }]
                },
                {
                  featureType: "water",
                  elementType: "geometry",
                  stylers: [{ color: "#E3F2FD" }]
                },
                {
                  featureType: "poi.park",
                  elementType: "geometry",
                  stylers: [{ color: "#E8F5E9" }]
                }
              ]
            }}
          >
            {location && <Marker position={location} />}
            {selectedRoute && <DirectionsRenderer directions={selectedRoute} options={directionsOptions} />}
            {location && <Circle center={location} radius={radius} options={circleOptions} />}
            {places.map((place) => (
              <Marker
                key={place.place_id}
                position={{
                  lat: place.geometry.location.lat,
                  lng: place.geometry.location.lng,
                }}
                onClick={() => showRoute(place)}
              />
            ))}
          </GoogleMap>
        </div>
      </div>
    </div>
  </main>
</div>

  );
}

export default App;
