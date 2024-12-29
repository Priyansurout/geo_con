import { MapPin, Navigation } from 'lucide-react';

const PlacesList = ({ places, userLocation, onPlaceSelect, placeType }) => {
  const formatPlaceType = (type) => {
    return type.charAt(0).toUpperCase() + type.slice(1) + 's';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">
          Nearby {formatPlaceType(placeType)}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Click on a location to see the route
        </p>
      </div>

      <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
        {places.map((place, index) => (
          <div
            key={place.place_id || index}
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
            onClick={() => onPlaceSelect(place)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-start">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium text-gray-900">{place.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{place.vicinity}</p>
                  </div>
                </div>
              </div>
              
              {place.distance && (
                <div className="ml-4 flex items-center space-x-1">
                  <Navigation className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-600">
                    {place.distance.toFixed(1)} km
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlacesList;