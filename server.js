const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { Client } = require("@googlemaps/google-maps-services-js");
const { 
  calculateConvenienceScore, 
  getScoreInterpretation, 
  PLACE_WEIGHTS,
  calculateDistance 
} = require('./convenienceScoring');

require("dotenv").config();


// const corsOptions = {
//   origin: process.env.FRONTEND_URL || 'http://localhost:3000',
//   credentials: true,
//   optionsSuccessStatus: 200
// };

const app = express();
app.use(cors());



app.use(express.json());

// 4. Add error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const client = new Client({});

// Test route to check backend status
app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// 3. Add health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Route to fetch nearby places
app.get("/nearby", async (req, res) => {
  const { location, radius = 5000, type = "store" } = req.query;

  // Input validation
  if (!location) {
    return res.status(400).json({ 
      success: false, 
      error: "Location is required. Format: 'latitude,longitude'" 
    });
  }

  if (isNaN(radius) || radius <= 0) {
    return res.status(400).json({ 
      success: false, 
      error: "Radius must be a positive number." 
    });
  }

  try {
    // Construct the Google Maps Places API URL
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location}&radius=${radius}&type=${type}&key=${API_KEY}`;

    // Fetch data from Google Maps API
    const response = await axios.get(url);
    const places = response.data.results;

    // Check if the response contains any places
    if (!places || places.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No places found for the given criteria.",
      });
    }

    // Add distance to each place
    const placesWithDistance = places.map(place => ({
      ...place,
      distance: calculateDistance(location, place.geometry.location)
    }));

    // Calculate convenience score
    const convenienceScore = calculateConvenienceScore(placesWithDistance, type, location);
    const interpretation = getScoreInterpretation(convenienceScore);

    // Sort places by distance
    placesWithDistance.sort((a, b) => a.distance - b.distance);

    // Return the results
    res.json({ 
      success: true, 
      places: placesWithDistance,
      convenienceScore,
      interpretation,
      metadata: {
        totalPlaces: places.length,
        searchRadius: radius,
        placeType: type,
        weights: PLACE_WEIGHTS[type] || PLACE_WEIGHTS.store // fallback to store weights
      }
    });
  } catch (error) {
    console.error("Error fetching nearby places:", error.message);

    // Handle specific Google Maps API errors
    if (error.response && error.response.data) {
      return res.status(500).json({
        success: false,
        error: error.response.data.error_message || "Failed to fetch nearby places from Google Maps API.",
      });
    }

    res.status(500).json({ 
      success: false, 
      error: "Internal server error." 
    });
  }
});

app.get("/geocode", async (req, res) => {
  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ 
      success: false, 
      error: "Address is required." 
    });
  }

  try {
    const response = await client.geocode({
      params: {
        address,
        key: API_KEY,
      },
    });

    if (!response.data.results || response.data.results.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Address not found."
      });
    }

    const location = response.data.results[0].geometry.location;
    res.json({ 
      success: true, 
      location,
      formattedAddress: response.data.results[0].formatted_address
    });
  } catch (error) {
    console.error("Geocoding error:", error.message);
    res.status(500).json({ 
      success: false, 
      error: "Failed to geocode address.",
      details: error.message
    });
  }
});


app.get("/custom-places", async (req, res) => {
  const { location, radius = 5000, customKeywords } = req.query;
  
  if (!location || !customKeywords) {
    return res.status(400).json({
      success: false,
      error: "Location and customKeywords are required"
    });
  }

  try {
    const keywords = customKeywords.split(',').join('|');
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location}&radius=${radius}&keyword=${keywords}&key=${API_KEY}`;
    
    const response = await axios.get(url);
    const places = response.data.results;

    const placesWithDistance = places.map(place => ({
      ...place,
      distance: calculateDistance(location, place.geometry.location)
    }));

    res.json({ 
      success: true, 
      places: placesWithDistance,
      metadata: {
        totalPlaces: places.length,
        searchRadius: radius,
        keywords: customKeywords
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch custom places"
    });
  }
});

// New route for filtering by ratings
app.get("/places-with-ratings", async (req, res) => {
  const { location, radius = 5000, type = "store", minRating = 4.0 } = req.query;

  if (!location) {
    return res.status(400).json({
      success: false,
      error: "Location is required"
    });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location}&radius=${radius}&type=${type}&key=${API_KEY}`;
    const response = await axios.get(url);
    
    const filteredPlaces = response.data.results
      .filter(place => place.rating >= minRating)
      .map(place => ({
        ...place,
        distance: calculateDistance(location, place.geometry.location)
      }));

    res.json({
      success: true,
      places: filteredPlaces,
      metadata: {
        totalPlaces: filteredPlaces.length,
        minRating,
        averageRating: filteredPlaces.reduce((acc, place) => acc + place.rating, 0) / filteredPlaces.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch rated places"
    });
  }
});

// New route for public transportation
app.get("/public-transport", async (req, res) => {
  const { location, radius = 1000 } = req.query;

  if (!location) {
    return res.status(400).json({
      success: false,
      error: "Location is required"
    });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location}&radius=${radius}&type=transit_station&key=${API_KEY}`;
    const response = await axios.get(url);
    
    const stations = response.data.results.map(station => ({
      ...station,
      distance: calculateDistance(location, station.geometry.location)
    }));

    res.json({
      success: true,
      stations,
      metadata: {
        totalStations: stations.length,
        averageDistance: stations.reduce((acc, station) => acc + station.distance, 0) / stations.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch transit stations"
    });
  }
});

// New route for cost estimation
app.get("/cost-estimation", async (req, res) => {
  const { location, radius = 5000, type = "restaurant" } = req.query;

  if (!location) {
    return res.status(400).json({
      success: false,
      error: "Location is required"
    });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location}&radius=${radius}&type=${type}&key=${API_KEY}`;
    const response = await axios.get(url);
    
    const places = response.data.results.map(place => ({
      name: place.name,
      price_level: place.price_level || 0,
      estimated_cost: place.price_level ? `${"$".repeat(place.price_level)}` : "N/A",
      distance: calculateDistance(location, place.geometry.location)
    }));

    const averagePriceLevel = places
      .filter(place => place.price_level)
      .reduce((acc, place) => acc + place.price_level, 0) / places.length;

    res.json({
      success: true,
      places,
      metadata: {
        totalPlaces: places.length,
        averagePriceLevel,
        priceDistribution: places.reduce((acc, place) => {
          acc[place.price_level] = (acc[place.price_level] || 0) + 1;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch cost estimates"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});