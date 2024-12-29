const PLACE_WEIGHTS = {
  hospital: {
    weight: 10,
    idealCount: 3,
    maxDistance: 5 // in km
  },
  pharmacy: {
    weight: 8,
    idealCount: 4,
    maxDistance: 2
  },
  restaurant: {
    weight: 6,
    idealCount: 10,
    maxDistance: 3
  },
  store: {
    weight: 7,
    idealCount: 5,
    maxDistance: 2
  },
  atm: {
    weight: 5,
    idealCount: 4,
    maxDistance: 1
  },
  school: {
    weight: 8,
    idealCount: 3,
    maxDistance: 3
  }
};

// Shared utility function to calculate distance between coordinates
function calculateDistance(location1, location2) {
const toRad = (value) => (value * Math.PI) / 180;
const R = 6371; // Earth's radius in km

const [lat1, lng1] = typeof location1 === 'string' ? 
  location1.split(",").map(Number) : 
  [location1.lat, location1.lng];
  
const [lat2, lng2] = typeof location2 === 'string' ? 
  location2.split(",").map(Number) : 
  [location2.lat, location2.lng];

const dLat = toRad(lat2 - lat1);
const dLng = toRad(lng2 - lng1);

const a =
  Math.sin(dLat / 2) * Math.sin(dLat / 2) +
  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
  Math.sin(dLng / 2) * Math.sin(dLng / 2);

const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
return R * c;
}

function calculateDistanceScore(distance, maxDistance) {
if (distance <= maxDistance / 3) return 1;
if (distance <= maxDistance) {
  return 1 - (distance - maxDistance / 3) / (maxDistance * 2/3);
}
return 0;
}

function calculateDensityScore(count, idealCount) {
return Math.min(count / idealCount, 1);
}

function calculateConvenienceScore(places, placeType, userLocation) {
const typeConfig = PLACE_WEIGHTS[placeType] || {
  weight: 5,
  idealCount: 5,
  maxDistance: 3
};

// Calculate distance scores
const distanceScores = places.map(place => {
  const distance = calculateDistance(userLocation, place.geometry.location);
  return calculateDistanceScore(distance, typeConfig.maxDistance);
});

// Calculate average distance score
const avgDistanceScore = distanceScores.reduce((sum, score) => sum + score, 0) / 
  Math.max(distanceScores.length, 1);

// Calculate density score
const densityScore = calculateDensityScore(places.length, typeConfig.idealCount);

// Calculate variety score (if places have different subtypes)
const subtypes = new Set(places.flatMap(place => place.types || []));
const varietyScore = Math.min(subtypes.size / 5, 1); // Normalize to max of 5 different subtypes

// Calculate final convenience score
const rawScore = (
  avgDistanceScore * 0.4 +    // 40% weight to distance
  densityScore * 0.4 +        // 40% weight to density
  varietyScore * 0.2          // 20% weight to variety
) * typeConfig.weight;        // Multiply by place type importance

// Normalize to 0-10 scale
return Math.round(rawScore * 10) / 10;
}

function getScoreInterpretation(score) {
if (score >= 9) return "Excellent convenience - Exceptional access to amenities";
if (score >= 7) return "Very Good - Great access to most amenities";
if (score >= 5) return "Good - Reasonable access to basic amenities";
if (score >= 3) return "Fair - Limited access to some amenities";
return "Poor - Minimal access to amenities";
}

module.exports = {
calculateConvenienceScore,
getScoreInterpretation,
PLACE_WEIGHTS,
calculateDistance  // Export the shared distance calculation function
};