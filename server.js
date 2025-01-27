const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Define geographic bounds
const GEO_BOUNDS = {
  southwest: { lat: 50.917, lng: 6.844 },
  northeast: { lat: 50.972, lng: 7.08 },
};

// Initialize vehicles with 12 telemetry data points
const vehicles = Array.from({ length: 10 }, (_, i) => ({
  id: (i + 1).toString(),
  name: `Vehicle #${i + 1}`,
  attributes: {
    speed: getRandomInRange(30, 60),
    batteryLevel: getRandomInRange(50, 100),
    temperature: getRandomInRange(20, 40),
    tirePressure: getRandomInRange(30, 35),
    motorEfficiency: getRandomInRange(85, 95),
    regenerativeBraking: Math.random() > 0.5,
    oilLevel: getRandomInRange(50, 100),
    brakeFluid: getRandomInRange(50, 100),
    coolantLevel: getRandomInRange(50, 100),
    fuelLevel: getRandomInRange(20, 70),
    engineLoad: getRandomInRange(50, 80),
    gpsAccuracy: getRandomInRange(5, 10),
  },
  position: getRandomPosition(),
  pathIndex: 0,
  pathDirection: 1, // 1 for forward, -1 for reverse
  hasIssue: false,
  errorMessage: "",
  issueTimer: 0, // Tracks how long the vehicle has had an issue
  status: "moving", // Initial status is moving
}));

// Predefined random paths for vehicles
const PATHS = Array.from({ length: 10 }, () => generateRandomPath());

function generateRandomPath() {
  const path = [];
  const steps = 20; // Number of steps in the path
  let currentPosition = getRandomPosition();

  for (let i = 0; i < steps; i++) {
    currentPosition = {
      lat: Math.max(
        GEO_BOUNDS.southwest.lat,
        Math.min(
          GEO_BOUNDS.northeast.lat,
          currentPosition.lat + (Math.random() * 0.002 - 0.001)
        )
      ),
      lng: Math.max(
        GEO_BOUNDS.southwest.lng,
        Math.min(
          GEO_BOUNDS.northeast.lng,
          currentPosition.lng + (Math.random() * 0.002 - 0.001)
        )
      ),
    };
    path.push(currentPosition);
  }

  return path;
}

// Generate a random position within the specified geographic bounds
function getRandomPosition() {
  const lat = getRandomInRange(GEO_BOUNDS.southwest.lat, GEO_BOUNDS.northeast.lat);
  const lng = getRandomInRange(GEO_BOUNDS.southwest.lng, GEO_BOUNDS.northeast.lng);
  return { lat, lng };
}

// Utility function to get a random number within a range
function getRandomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

// Function to determine if a vehicle has an issue
function determineIssue(vehicle) {
  const issues = [];

  if (vehicle.hasIssue && vehicle.issueTimer > 0) {
    // Vehicle is already in an issue state, decrement issue timer
    vehicle.issueTimer--;
    if (vehicle.issueTimer === 0) {
      // Clear the issue if timer reaches 0
      vehicle.hasIssue = false;
      vehicle.errorMessage = "";
    }
    return vehicle;
  }

  if (!vehicle.hasIssue && Math.random() > 0.9) { // 10% chance a vehicle gets an issue
    if (vehicle.attributes.batteryLevel < 15) issues.push("Low battery level");
    if (vehicle.attributes.tirePressure < 26 || vehicle.attributes.tirePressure > 38) issues.push("Tire pressure out of range");
    if (vehicle.attributes.temperature > 55) issues.push("Overheating");
    if (!vehicle.attributes.regenerativeBraking && Math.random() > 0.5) issues.push("Regenerative braking disabled");

    if (issues.length > 0) {
      vehicle.hasIssue = true;
      vehicle.errorMessage = issues.join(", ");
      vehicle.issueTimer = Math.floor(getRandomInRange(120, 180)); // Issue lasts for 2-3 minutes
    }
  } else if (vehicle.hasIssue) {
    // Ensure the error message is retained if vehicle still has an issue
    vehicle.errorMessage = vehicle.errorMessage || "Unknown issue";
  }

  return vehicle;
}

// Generate random updates for vehicle attributes
function getRandomUpdate(vehicle, index) {
  const path = PATHS[index];
  const updatedVehicle = {
    ...vehicle,
    attributes: {
      ...vehicle.attributes,
      speed: Math.max(15, Math.min(100, vehicle.attributes.speed + (Math.random() * 6 - 3))), // Moderate speed changes
      batteryLevel: Math.max(10, vehicle.attributes.batteryLevel - Math.random() * 0.5), // Slower battery drain
      temperature: Math.max(18, Math.min(50, vehicle.attributes.temperature + (Math.random() * 1.5 - 0.75))), // Slower temp variation
      tirePressure: Math.max(28, Math.min(36, vehicle.attributes.tirePressure + (Math.random() * 0.3 - 0.15))), // Narrower range
      motorEfficiency: Math.max(80, Math.min(95, vehicle.attributes.motorEfficiency + (Math.random() * 0.3 - 0.15))),
      regenerativeBraking: Math.random() > 0.05, // 95% chance to remain enabled
      oilLevel: Math.max(20, vehicle.attributes.oilLevel - Math.random() * 0.2), // Slower oil drain
      brakeFluid: Math.max(20, vehicle.attributes.brakeFluid - Math.random() * 0.2), // Slower fluid drain
      coolantLevel: Math.max(20, vehicle.attributes.coolantLevel - Math.random() * 0.2), // Slower coolant drain
      fuelLevel: Math.max(10, vehicle.attributes.fuelLevel - Math.random() * 0.5), // Slower fuel consumption
      engineLoad: Math.max(50, Math.min(85, vehicle.attributes.engineLoad + (Math.random() * 1.5 - 0.75))),
      gpsAccuracy: Math.max(4, Math.min(12, vehicle.attributes.gpsAccuracy + (Math.random() * 0.2 - 0.1))),
    },
    position: path[vehicle.pathIndex],
    pathIndex:
      vehicle.pathIndex + vehicle.pathDirection >= path.length ||
      vehicle.pathIndex + vehicle.pathDirection < 0
        ? vehicle.pathIndex - vehicle.pathDirection // Reverse direction
        : vehicle.pathIndex + vehicle.pathDirection,
    pathDirection:
      vehicle.pathIndex + vehicle.pathDirection >= path.length ||
      vehicle.pathIndex + vehicle.pathDirection < 0
        ? -vehicle.pathDirection
        : vehicle.pathDirection,
    status: vehicle.attributes.speed > 0 ? "moving" : "not", // Update status based on speed
  };

  // Occasionally improve attributes for vehicles without issues
  if (!updatedVehicle.hasIssue && Math.random() > 0.8) { // 20% chance of recovery
    updatedVehicle.attributes.batteryLevel = Math.min(100, updatedVehicle.attributes.batteryLevel + Math.random() * 5);
    updatedVehicle.attributes.tirePressure = Math.max(30, Math.min(35, updatedVehicle.attributes.tirePressure + Math.random() * 0.5));
    updatedVehicle.attributes.coolantLevel = Math.min(100, updatedVehicle.attributes.coolantLevel + Math.random() * 1);
  }

  return determineIssue(updatedVehicle);
}

// Set up Socket.IO connection
io.on('connection', (socket) => {
  console.log('Client connected');

  // Emit initial vehicles list to the client
  socket.emit('vehicles', vehicles);

  // Update vehicles at regular intervals
  setInterval(() => {
    vehicles.forEach((vehicle, index) => {
      if (Math.random() > 0.5) { // 50% chance to send data for a vehicle
        const updatedVehicle = getRandomUpdate(vehicle, index);
        vehicles[index] = updatedVehicle;

        // Emit updates for the selected vehicle
        socket.emit('vehicleUpdate', updatedVehicle);
      }
    });
  }, 1000); // Update every 1 second

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
