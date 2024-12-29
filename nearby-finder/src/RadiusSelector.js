// Replace your existing radius selection dropdown with this slider component
const RadiusSelector = ({ radius, setRadius, onRadiusChange }) => {
    const handleChange = (e) => {
      const newRadius = Number(e.target.value);
      setRadius(newRadius);
      onRadiusChange(newRadius);
    };
  
    return (
      <div className="mt-4">
        <label className="block text-sm font-medium mb-1">
          Search Radius: {(radius / 1000).toFixed(1)} km
        </label>
        <input
          type="range"
          min="1000"
          max="50000"
          step="1000"
          value={radius}
          onChange={handleChange}
          className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    );
  };
  
  // Enhanced place listing component with real-time distance updates
 // Enhanced PlacesList component with synchronized type display
 const PlacesList = ({ places, userLocation, onPlaceSelect, placeType }) => {
    const calculateDistance = (place) => {
      if (!userLocation || !place.geometry?.location) return null;
      
      const R = 6371; // Earth's radius in km
      const lat1 = userLocation.lat;
      const lon1 = userLocation.lng;
      const lat2 = place.geometry.location.lat;
      const lon2 = place.geometry.location.lng;
      
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };
  
    const toRad = (value) => (value * Math.PI) / 180;
  
    // Format place type for display with null check
    const formatPlaceType = (type) => {
      if (!type) return 'Places';  // Default fallback
      
      // Handle special cases
      const specialTypes = {
        'atm': 'ATMs',
        'pharmacy': 'Pharmacies'
      };
      
      if (specialTypes[type]) {
        return specialTypes[type];
      }
      
      // Regular formatting for other types
      return type.charAt(0).toUpperCase() + type.slice(1) + 's';
    };
  
    return (
      <div className="bg-white p-4 rounded-lg shadow max-h-96 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          Nearby {formatPlaceType(placeType)}
        </h2>
        {places.length === 0 ? (
          <p className="text-gray-500">
            No {placeType ? formatPlaceType(placeType) : 'places'} found in this area
          </p>
        ) : (
          places.map((place, index) => {
            const distance = calculateDistance(place);
            return (
              <div
                key={place.place_id || index}
                className="p-3 border-b cursor-pointer hover:bg-gray-50 last:border-b-0"
                onClick={() => onPlaceSelect(place)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{place.name}</h3>
                    <p className="text-sm text-gray-600">{place.vicinity}</p>
                  </div>
                  {distance !== null && (
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                      {distance.toFixed(1)} km
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };


export { RadiusSelector, PlacesList };
